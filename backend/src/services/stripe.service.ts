import Stripe from 'stripe';
import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../types/payment';

export class StripePaymentGateway implements PaymentGateway {
  public readonly name = 'stripe';
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-06-30.basil'
    });
    this.webhookSecret = webhookSecret;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    try {
      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: {
                name: params.description,
                metadata: {
                  invoice_id: params.invoiceId,
                  client_email: params.clientEmail
                }
              },
              unit_amount: Math.round(params.amount * 100), // Convert to cents
            },
            quantity: 1,
          } as any,
        ],
        metadata: {
          invoice_id: params.invoiceId,
          client_email: params.clientEmail,
          client_name: params.clientName,
          ...params.metadata
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: params.successUrl || `${process.env.FRONTEND_URL}/payment/success`
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN', 'SG']
        },
        ...(params.expiresAt && {
          expires_at: Math.floor(params.expiresAt.getTime() / 1000)
        })
      });

      return {
        id: paymentLink.id,
        url: paymentLink.url,
        expiresAt: params.expiresAt,
        status: 'active'
      };
    } catch (error) {
      throw new Error(`Stripe payment link creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    if (!signature) {
      throw new Error('Webhook signature is required for Stripe');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          eventType: 'payment_completed',
          paymentId: session.payment_link as string,
          status: 'completed',
          amount: session.amount_total ? session.amount_total / 100 : 0,
          paidAmount: session.amount_total ? session.amount_total / 100 : 0,
          metadata: session.metadata || {}
        };
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          eventType: 'payment_expired',
          paymentId: session.payment_link as string,
          status: 'cancelled',
          metadata: session.metadata || {}
        };
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          eventType: 'payment_failed',
          paymentId: paymentIntent.id,
          status: 'failed',
          amount: paymentIntent.amount / 100,
          metadata: paymentIntent.metadata || {}
        };
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        return {
          eventType: 'payment_disputed',
          paymentId: dispute.charge as string,
          status: 'failed',
          amount: dispute.amount / 100,
          metadata: {}
        };
      }

      default:
        throw new Error(`Unhandled webhook event type: ${event.type}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      // First try to get as payment link
      let paymentLink: Stripe.PaymentLink;
      try {
        paymentLink = await this.stripe.paymentLinks.retrieve(paymentId);
      } catch {
        // If not found as payment link, try as payment intent
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
        return this.mapPaymentIntentToStatus(paymentIntent);
      }

      // Get associated checkout sessions
      const sessions = await this.stripe.checkout.sessions.list({
        payment_link: paymentId,
        limit: 1
      });

      if (sessions.data.length === 0) {
        return {
          id: paymentId,
          status: 'pending',
          amount: 0,
          currency: 'usd'
        };
      }

      const session = sessions.data[0];
      return this.mapSessionToStatus(session);
    } catch (error) {
      throw new Error(`Failed to get payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      // Get the payment intent from the session
      const sessions = await this.stripe.checkout.sessions.list({
        payment_link: paymentId,
        limit: 1
      });

      if (sessions.data.length === 0) {
        throw new Error('No payment session found for this payment link');
      }

      const session = sessions.data[0];
      if (!session.payment_intent) {
        throw new Error('No payment intent found for this session');
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: session.payment_intent as string,
        ...(amount && { amount: Math.round(amount * 100) })
      });

      return {
        id: refund.id,
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        amount: refund.amount / 100,
        reason: refund.reason || undefined
      };
    } catch (error) {
      throw new Error(`Refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapSessionToStatus(session: Stripe.Checkout.Session): PaymentStatus {
    let status: PaymentStatus['status'];
    
    switch (session.status) {
      case 'complete':
        status = 'completed';
        break;
      case 'expired':
        status = 'cancelled';
        break;
      case 'open':
        status = 'pending';
        break;
      default:
        status = 'pending';
    }

    return {
      id: session.payment_link as string,
      status,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || 'usd',
      paidAmount: session.amount_total ? session.amount_total / 100 : 0,
      paymentMethod: session.payment_method_types?.[0],
      transactionId: session.payment_intent as string,
      paidAt: status === 'completed' ? new Date() : undefined,
      metadata: session.metadata || {}
    };
  }

  private mapPaymentIntentToStatus(paymentIntent: Stripe.PaymentIntent): PaymentStatus {
    let status: PaymentStatus['status'];
    
    switch (paymentIntent.status) {
      case 'succeeded':
        status = 'completed';
        break;
      case 'canceled':
        status = 'cancelled';
        break;
      case 'processing':
        status = 'processing';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        status = 'pending';
        break;
      default:
        status = 'failed';
    }

    return {
      id: paymentIntent.id,
      status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      paidAmount: status === 'completed' ? paymentIntent.amount / 100 : 0,
      paymentMethod: paymentIntent.payment_method_types?.[0],
      transactionId: paymentIntent.id,
      paidAt: status === 'completed' ? new Date(paymentIntent.created * 1000) : undefined,
      metadata: paymentIntent.metadata || {}
    };
  }
}