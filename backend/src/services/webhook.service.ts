import crypto from 'crypto';
import { SheetsService } from './sheets.service';

export interface WebhookEvent {
  id: string;
  event: string;
  data: any;
  timestamp: string;
  attempts: number;
  maxAttempts: number;
  nextRetry?: string;
  status: 'pending' | 'delivered' | 'failed' | 'cancelled';
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  created_at: string;
  last_delivery?: string;
  delivery_success_rate?: number;
}

export class WebhookService {
  private sheetsService: SheetsService;
  private retryDelays = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    this.sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
  }

  async registerWebhook(url: string, events: string[], secret?: string): Promise<string> {
    try {
      const webhookData: WebhookEndpoint = {
        id: this.generateId(),
        url,
        events,
        secret: secret || this.generateSecret(),
        active: true,
        created_at: new Date().toISOString(),
        delivery_success_rate: 100
      };

      const webhookId = await this.sheetsService.create('Webhooks', webhookData);
      return webhookId;
    } catch (error) {
      throw new Error(`Failed to register webhook: ${error.message}`);
    }
  }

  async updateWebhook(webhookId: string, updates: Partial<WebhookEndpoint>): Promise<boolean> {
    try {
      return await this.sheetsService.update('Webhooks', webhookId, {
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    try {
      // Deactivate instead of delete to maintain audit trail
      return await this.sheetsService.update('Webhooks', webhookId, {
        active: false,
        deleted_at: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }

  async triggerWebhook(event: string, data: any): Promise<void> {
    try {
      // Get all active webhooks that listen to this event
      const webhooks = await this.sheetsService.query('Webhooks', {
        active: true,
        events: { contains: event }
      });

      const webhookEvent: WebhookEvent = {
        id: this.generateId(),
        event,
        data,
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 5,
        status: 'pending'
      };

      // Store the event
      await this.sheetsService.create('Webhook_Events', webhookEvent);

      // Send to all matching webhooks
      for (const webhook of webhooks) {
        await this.deliverWebhook(webhook, webhookEvent);
      }
    } catch (error) {
      console.error('Webhook trigger error:', error);
    }
  }

  private async deliverWebhook(webhook: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    try {
      const payload = {
        id: event.id,
        event: event.event,
        data: event.data,
        timestamp: event.timestamp
      };

      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.event,
          'X-Webhook-ID': event.id,
          'User-Agent': 'ProjectInvoiceManager-Webhook/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (response.ok) {
        // Success
        await this.updateEventStatus(event.id, 'delivered');
        await this.updateWebhookStats(webhook.id, true);
      } else {
        // HTTP error
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Webhook delivery failed for ${webhook.url}:`, error);
      await this.handleDeliveryFailure(webhook, event, error.message);
    }
  }

  private async handleDeliveryFailure(webhook: WebhookEndpoint, event: WebhookEvent, error: string): Promise<void> {
    event.attempts++;
    
    if (event.attempts >= event.maxAttempts) {
      // Max attempts reached, mark as failed
      await this.updateEventStatus(event.id, 'failed');
      await this.updateWebhookStats(webhook.id, false);
      
      // Log the failure
      await this.sheetsService.create('Webhook_Failures', {
        webhook_id: webhook.id,
        event_id: event.id,
        error,
        failed_at: new Date().toISOString()
      });
    } else {
      // Schedule retry
      const retryDelay = this.retryDelays[event.attempts - 1] || this.retryDelays[this.retryDelays.length - 1];
      event.nextRetry = new Date(Date.now() + retryDelay).toISOString();
      
      await this.sheetsService.update('Webhook_Events', event.id, {
        attempts: event.attempts,
        next_retry: event.nextRetry,
        last_error: error
      });

      // Schedule retry (in a real implementation, you'd use a job queue)
      setTimeout(() => {
        this.deliverWebhook(webhook, event);
      }, retryDelay);
    }
  }

  private async updateEventStatus(eventId: string, status: WebhookEvent['status']): Promise<void> {
    await this.sheetsService.update('Webhook_Events', eventId, {
      status,
      updated_at: new Date().toISOString()
    });
  }

  private async updateWebhookStats(webhookId: string, success: boolean): Promise<void> {
    const webhook = await this.sheetsService.query('Webhooks', { id: webhookId });
    if (!webhook.length) return;

    const currentWebhook = webhook[0];
    const deliveries = await this.sheetsService.query('Webhook_Events', { webhook_id: webhookId });
    
    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 100;

    await this.sheetsService.update('Webhooks', webhookId, {
      last_delivery: new Date().toISOString(),
      delivery_success_rate: successRate
    });
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getWebhooks(): Promise<WebhookEndpoint[]> {
    return await this.sheetsService.read('Webhooks');
  }

  async getWebhookEvents(webhookId?: string): Promise<WebhookEvent[]> {
    if (webhookId) {
      return await this.sheetsService.query('Webhook_Events', { webhook_id: webhookId });
    }
    return await this.sheetsService.read('Webhook_Events');
  }

  async getWebhookStats(webhookId: string): Promise<any> {
    const events = await this.sheetsService.query('Webhook_Events', { webhook_id: webhookId });
    
    const stats = {
      totalEvents: events.length,
      deliveredEvents: events.filter(e => e.status === 'delivered').length,
      failedEvents: events.filter(e => e.status === 'failed').length,
      pendingEvents: events.filter(e => e.status === 'pending').length,
      averageAttempts: 0,
      lastDelivery: null as string | null,
      deliveryRate: 0
    };

    if (events.length > 0) {
      stats.averageAttempts = events.reduce((sum, e) => sum + e.attempts, 0) / events.length;
      stats.deliveryRate = (stats.deliveredEvents / events.length) * 100;
      
      const sortedEvents = events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      stats.lastDelivery = sortedEvents[0]?.timestamp || null;
    }

    return stats;
  }

  async retryFailedWebhooks(): Promise<void> {
    try {
      const failedEvents = await this.sheetsService.query('Webhook_Events', {
        status: 'pending',
        next_retry: { lessThan: new Date().toISOString() }
      });

      for (const event of failedEvents) {
        const webhooks = await this.sheetsService.query('Webhooks', {
          active: true,
          events: { contains: event.event }
        });

        for (const webhook of webhooks) {
          await this.deliverWebhook(webhook, event);
        }
      }
    } catch (error) {
      console.error('Failed to retry webhooks:', error);
    }
  }

  async validateWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Predefined webhook events
  static readonly EVENTS = {
    INVOICE_CREATED: 'invoice.created',
    INVOICE_UPDATED: 'invoice.updated',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_OVERDUE: 'invoice.overdue',
    PROJECT_CREATED: 'project.created',
    PROJECT_COMPLETED: 'project.completed',
    TASK_CREATED: 'task.created',
    TASK_COMPLETED: 'task.completed',
    CLIENT_CREATED: 'client.created',
    PAYMENT_RECEIVED: 'payment.received',
    PAYMENT_FAILED: 'payment.failed',
    TIME_ENTRY_ADDED: 'time_entry.added',
    EXPENSE_ADDED: 'expense.added'
  };
}