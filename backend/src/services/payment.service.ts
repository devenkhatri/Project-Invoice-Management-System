import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult, PaymentAnalytics, FraudDetectionResult } from '../types/payment';
import { SheetsService } from './sheets.service';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private gateways: Map<string, PaymentGateway> = new Map();
  private sheetsService: SheetsService;

  constructor(sheetsService: SheetsService) {
    this.sheetsService = sheetsService;
  }

  registerGateway(gateway: PaymentGateway): void {
    this.gateways.set(gateway.name, gateway);
  }

  getGateway(name: string): PaymentGateway | undefined {
    return this.gateways.get(name);
  }

  getAvailableGateways(): string[] {
    return Array.from(this.gateways.keys());
  }

  async createPaymentLink(gatewayName: string, params: CreatePaymentLinkParams): Promise<PaymentLink> {
    const gateway = this.getGateway(gatewayName);
    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' not found`);
    }

    // Fraud detection check
    const fraudCheck = await this.performFraudDetection(params);
    if (fraudCheck.recommendation === 'decline') {
      throw new Error(`Payment declined due to fraud detection: ${fraudCheck.flags.join(', ')}`);
    }

    const paymentLink = await gateway.createPaymentLink(params);

    // Store payment link in sheets
    await this.storePaymentLink(gatewayName, paymentLink, params);

    return paymentLink;
  }

  async processWebhook(gatewayName: string, payload: any, signature?: string): Promise<WebhookResult> {
    const gateway = this.getGateway(gatewayName);
    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' not found`);
    }

    const result = await gateway.processWebhook(payload, signature);
    
    // Update payment status in sheets
    await this.updatePaymentStatus(result.paymentId, result.status, result.paidAmount);
    
    // Update invoice status if payment is completed
    if (result.status === 'completed') {
      await this.updateInvoiceStatus(result.paymentId, 'paid');
      
      // Trigger automation for payment received
      try {
        const { AutomationService } = await import('./automation');
        const automationService = AutomationService.getInstance();
        
        // Find the invoice ID from payment link
        const paymentLinks = await this.sheetsService.query('Payment_Links', {
          id: result.paymentId
        });
        
        if (paymentLinks.length > 0) {
          const invoiceId = paymentLinks[0].invoice_id;
          await automationService.onPaymentReceived(invoiceId, result.paidAmount || 0, {
            gateway: gatewayName,
            payment_id: result.paymentId,
            transaction_id: (result as any).transactionId,
            payment_method: (result as any).paymentMethod
          });
        }
      } catch (error) {
        console.error('Failed to trigger payment automation:', error);
        // Don't fail the webhook processing if automation fails
      }
    } else if (result.status === 'failed') {
      await this.updateInvoiceStatus(result.paymentId, 'overdue');
    }

    return result;
  }

  async getPaymentStatus(gatewayName: string, paymentId: string): Promise<PaymentStatus> {
    const gateway = this.getGateway(gatewayName);
    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' not found`);
    }

    return await gateway.getPaymentStatus(paymentId);
  }

  async refundPayment(gatewayName: string, paymentId: string, amount?: number): Promise<RefundResult> {
    const gateway = this.getGateway(gatewayName);
    if (!gateway) {
      throw new Error(`Payment gateway '${gatewayName}' not found`);
    }

    const result = await gateway.refundPayment(paymentId, amount);
    
    // Update payment status in sheets
    if (result.status === 'completed') {
      await this.updatePaymentStatus(paymentId, amount ? 'partially_refunded' : 'refunded');
    }

    return result;
  }

  async getPaymentAnalytics(gatewayName?: string, startDate?: Date, endDate?: Date): Promise<PaymentAnalytics[]> {
    const queryParams: any = {};
    
    if (gatewayName) {
      queryParams.gateway = gatewayName;
    }
    
    if (startDate || endDate) {
      queryParams.created_at = {};
      if (startDate) {
        queryParams.created_at['>='] = startDate.toISOString();
      }
      if (endDate) {
        queryParams.created_at['<='] = endDate.toISOString();
      }
    }
    
    const payments = await this.sheetsService.query('Payment_Links', queryParams);

    const analytics: Map<string, PaymentAnalytics> = new Map();

    for (const payment of payments) {
      const gateway = payment.gateway;
      if (!analytics.has(gateway)) {
        analytics.set(gateway, {
          gateway,
          totalTransactions: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          successRate: 0,
          totalAmount: 0,
          averagePaymentTime: 0,
          averageTransactionAmount: 0,
          period: {
            start: startDate || new Date(Math.min(...payments.map(p => new Date(p.created_at).getTime()))),
            end: endDate || new Date(Math.max(...payments.map(p => new Date(p.created_at).getTime())))
          }
        });
      }

      const stats = analytics.get(gateway)!;
      stats.totalTransactions++;
      stats.totalAmount += payment.amount;

      if (payment.status === 'completed') {
        stats.successfulTransactions++;
        if (payment.paid_at) {
          const paymentTime = (new Date(payment.paid_at).getTime() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24);
          stats.averagePaymentTime = (stats.averagePaymentTime * (stats.successfulTransactions - 1) + paymentTime) / stats.successfulTransactions;
        }
      } else if (payment.status === 'failed') {
        stats.failedTransactions++;
      }
    }

    // Calculate final metrics
    for (const stats of analytics.values()) {
      stats.successRate = stats.totalTransactions > 0 ? (stats.successfulTransactions / stats.totalTransactions) * 100 : 0;
      stats.averageTransactionAmount = stats.totalTransactions > 0 ? stats.totalAmount / stats.totalTransactions : 0;
    }

    return Array.from(analytics.values());
  }

  private async storePaymentLink(gateway: string, paymentLink: PaymentLink, params: CreatePaymentLinkParams): Promise<void> {
    const data = {
      id: paymentLink.id,
      gateway,
      url: paymentLink.url,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      invoice_id: params.invoiceId,
      client_email: params.clientEmail,
      client_name: params.clientName,
      status: paymentLink.status,
      expires_at: paymentLink.expiresAt?.toISOString(),
      allow_partial_payments: params.allowPartialPayments || false,
      metadata: JSON.stringify(params.metadata || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await this.sheetsService.create('Payment_Links', data);
  }

  private async updatePaymentStatus(paymentId: string, status: PaymentStatus['status'], paidAmount?: number): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (paidAmount !== undefined) {
      updateData.paid_amount = paidAmount;
    }

    if (status === 'completed') {
      updateData.paid_at = new Date().toISOString();
    }

    await this.sheetsService.update('Payment_Links', paymentId, updateData);
  }

  private async updateInvoiceStatus(paymentId: string, status: string): Promise<void> {
    // Get payment link to find invoice ID
    const paymentLinks = await this.sheetsService.query('Payment_Links', { id: paymentId });
    if (paymentLinks.length === 0) {
      return;
    }

    const invoiceId = paymentLinks[0].invoice_id;
    await this.sheetsService.update('Invoices', invoiceId, {
      status,
      updated_at: new Date().toISOString()
    });
  }

  private async performFraudDetection(params: CreatePaymentLinkParams): Promise<FraudDetectionResult> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check for unusually high amounts
    if (params.amount > 100000) { // $100,000 or equivalent
      riskScore += 20;
      flags.push('high_amount');
    }

    // Check for suspicious email patterns
    if (params.clientEmail.includes('temp') || params.clientEmail.includes('disposable')) {
      riskScore += 30;
      flags.push('suspicious_email');
    }

    // Check for rapid successive payments from same client
    const recentPayments = await this.sheetsService.query('Payment_Links', {
      client_email: params.clientEmail,
      created_at: { '>=': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    });

    if (recentPayments.length > 5) {
      riskScore += 25;
      flags.push('rapid_payments');
    }

    // Determine risk level and recommendation
    let riskLevel: 'low' | 'medium' | 'high';
    let recommendation: 'approve' | 'review' | 'decline';

    if (riskScore < 30) {
      riskLevel = 'low';
      recommendation = 'approve';
    } else if (riskScore < 60) {
      riskLevel = 'medium';
      recommendation = 'review';
    } else {
      riskLevel = 'high';
      recommendation = 'decline';
    }

    // For testing purposes, let's be more aggressive with fraud detection
    if (flags.length > 0) {
      recommendation = 'decline';
    }

    return {
      riskScore,
      riskLevel,
      flags,
      recommendation
    };
  }
}