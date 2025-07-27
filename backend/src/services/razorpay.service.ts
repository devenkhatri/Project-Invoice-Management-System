import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../types/payment';

export class RazorpayPaymentGateway implements PaymentGateway {
  public readonly name = 'razorpay';
  private razorpay: Razorpay;
  private webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret?: string) {
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    this.webhookSecret = webhookSecret || keySecret;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    try {
      // Convert amount to paise (smallest currency unit for INR)
      const amountInPaise = Math.round(params.amount * 100);
      
      const paymentLinkData = {
        amount: amountInPaise,
        currency: params.currency.toUpperCase(),
        description: params.description,
        customer: {
          name: params.clientName,
          email: params.clientEmail
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes: {
          invoice_id: params.invoiceId,
          client_email: params.clientEmail,
          ...params.metadata
        },
        callback_url: params.successUrl || `${process.env.FRONTEND_URL}/payment/success`,
        callback_method: 'get',
        ...(params.expiresAt && {
          expire_by: Math.floor(params.expiresAt.getTime() / 1000)
        })
      };

      const paymentLink = await this.razorpay.paymentLink.create(paymentLinkData);

      return {
        id: paymentLink.id,
        url: paymentLink.short_url,
        expiresAt: params.expiresAt,
        status: 'active'
      };
    } catch (error: any) {
      throw new Error(`Razorpay payment link creation failed: ${error.error?.description || error.message || 'Unknown error'}`);
    }
  }

  async processWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    if (!signature) {
      throw new Error('Webhook signature is required for Razorpay');
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }

    const event = payload;
    
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        return {
          eventType: 'payment_completed',
          paymentId: payment.id,
          status: 'completed',
          amount: payment.amount / 100,
          paidAmount: payment.amount / 100,
          metadata: payment.notes || {}
        };
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        return {
          eventType: 'payment_failed',
          paymentId: payment.id,
          status: 'failed',
          amount: payment.amount / 100,
          metadata: payment.notes || {}
        };
      }

      case 'payment_link.paid': {
        const paymentLink = event.payload.payment_link.entity;
        return {
          eventType: 'payment_link_paid',
          paymentId: paymentLink.id,
          status: 'completed',
          amount: paymentLink.amount / 100,
          paidAmount: paymentLink.amount_paid / 100,
          metadata: paymentLink.notes || {}
        };
      }

      case 'payment_link.expired': {
        const paymentLink = event.payload.payment_link.entity;
        return {
          eventType: 'payment_link_expired',
          paymentId: paymentLink.id,
          status: 'cancelled',
          amount: paymentLink.amount / 100,
          metadata: paymentLink.notes || {}
        };
      }

      case 'refund.created': {
        const refund = event.payload.refund.entity;
        return {
          eventType: 'refund_created',
          paymentId: refund.payment_id,
          status: 'refunded',
          amount: refund.amount / 100,
          metadata: refund.notes || {}
        };
      }

      default:
        throw new Error(`Unhandled Razorpay webhook event type: ${event.event}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      // Check if it's a payment link ID or payment ID
      if (paymentId.startsWith('plink_')) {
        const paymentLink = await this.razorpay.paymentLink.fetch(paymentId);
        return this.mapPaymentLinkToStatus(paymentLink);
      } else {
        const payment = await this.razorpay.payments.fetch(paymentId);
        return this.mapPaymentToStatus(payment);
      }
    } catch (error: any) {
      throw new Error(`Failed to get Razorpay payment status: ${error.error?.description || error.message || 'Unknown error'}`);
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      // If paymentId is a payment link, we need to get the actual payment ID
      let actualPaymentId = paymentId;
      
      if (paymentId.startsWith('plink_')) {
        const paymentLink = await this.razorpay.paymentLink.fetch(paymentId);
        const payments = (paymentLink.payments as unknown as any[]) || [];
        if (payments.length === 0) {
          throw new Error('No payments found for this payment link');
        }
        actualPaymentId = payments[0].id;
      }

      const refundData: any = {
        payment_id: actualPaymentId
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await this.razorpay.payments.refund(actualPaymentId, refundData);

      return {
        id: refund.id,
        status: refund.status === 'processed' ? 'completed' : 'pending',
        amount: (refund.amount || 0) / 100,
        reason: typeof refund.notes?.reason === 'string' ? refund.notes.reason : undefined
      };
    } catch (error: any) {
      throw new Error(`Razorpay refund failed: ${error.error?.description || error.message || 'Unknown error'}`);
    }
  }

  private mapPaymentLinkToStatus(paymentLink: any): PaymentStatus {
    let status: PaymentStatus['status'];
    
    switch (paymentLink.status) {
      case 'paid':
        status = 'completed';
        break;
      case 'expired':
        status = 'cancelled';
        break;
      case 'created':
        status = 'pending';
        break;
      case 'cancelled':
        status = 'cancelled';
        break;
      default:
        status = 'pending';
    }

    return {
      id: paymentLink.id,
      status,
      amount: paymentLink.amount / 100,
      currency: paymentLink.currency.toLowerCase(),
      paidAmount: paymentLink.amount_paid ? paymentLink.amount_paid / 100 : 0,
      paymentMethod: 'razorpay',
      transactionId: paymentLink.id,
      paidAt: status === 'completed' && paymentLink.paid_at ? new Date(paymentLink.paid_at * 1000) : undefined,
      metadata: paymentLink.notes || {}
    };
  }

  private mapPaymentToStatus(payment: any): PaymentStatus {
    let status: PaymentStatus['status'];
    
    switch (payment.status) {
      case 'captured':
        status = 'completed';
        break;
      case 'authorized':
        status = 'processing';
        break;
      case 'created':
        status = 'pending';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'refunded':
        status = 'refunded';
        break;
      default:
        status = 'pending';
    }

    return {
      id: payment.id,
      status,
      amount: payment.amount / 100,
      currency: payment.currency.toLowerCase(),
      paidAmount: status === 'completed' ? payment.amount / 100 : 0,
      paymentMethod: payment.method,
      transactionId: payment.id,
      paidAt: status === 'completed' && payment.created_at ? new Date(payment.created_at * 1000) : undefined,
      failureReason: payment.error_description,
      metadata: payment.notes || {}
    };
  }
}