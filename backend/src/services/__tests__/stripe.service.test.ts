import { StripePaymentGateway } from '../stripe.service';
import { CreatePaymentLinkParams } from '../../types/payment';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');

describe('StripePaymentGateway', () => {
  let stripeGateway: StripePaymentGateway;
  let mockStripe: any;

  beforeEach(() => {
    mockStripe = {
      paymentLinks: {
        create: jest.fn(),
        retrieve: jest.fn()
      },
      webhooks: {
        constructEvent: jest.fn()
      },
      checkout: {
        sessions: {
          list: jest.fn()
        }
      },
      paymentIntents: {
        retrieve: jest.fn()
      },
      refunds: {
        create: jest.fn()
      }
    };

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe);

    stripeGateway = new StripePaymentGateway('sk_test_123', 'whsec_123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentLink', () => {
    const mockParams: CreatePaymentLinkParams = {
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      invoiceId: 'inv_123',
      clientEmail: 'test@example.com',
      clientName: 'Test Client',
      successUrl: 'https://example.com/success',
      expiresAt: new Date('2024-12-31')
    };

    it('should create payment link successfully', async () => {
      const mockPaymentLink = {
        id: 'plink_123',
        url: 'https://checkout.stripe.com/pay/plink_123'
      };

      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);

      const result = await stripeGateway.createPaymentLink(mockParams);

      expect(result).toEqual({
        id: 'plink_123',
        url: 'https://checkout.stripe.com/pay/plink_123',
        expiresAt: mockParams.expiresAt,
        status: 'active'
      });

      expect(mockStripe.paymentLinks.create).toHaveBeenCalledWith({
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test payment',
              metadata: {
                invoice_id: 'inv_123',
                client_email: 'test@example.com'
              }
            },
            unit_amount: 10000 // $100 in cents
          },
          quantity: 1
        }],
        metadata: {
          invoice_id: 'inv_123',
          client_email: 'test@example.com',
          client_name: 'Test Client'
        },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: 'https://example.com/success'
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN', 'SG']
        },
        expires_at: Math.floor(mockParams.expiresAt!.getTime() / 1000)
      });
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.paymentLinks.create.mockRejectedValue(new Error('Stripe API error'));

      await expect(stripeGateway.createPaymentLink(mockParams))
        .rejects.toThrow('Stripe payment link creation failed: Stripe API error');
    });
  });

  describe('processWebhook', () => {
    const mockPayload = Buffer.from('webhook payload');
    const mockSignature = 'stripe_signature';

    it('should process checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            payment_link: 'plink_123',
            amount_total: 10000,
            metadata: { invoice_id: 'inv_123' }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = await stripeGateway.processWebhook(mockPayload, mockSignature);

      expect(result).toEqual({
        eventType: 'payment_completed',
        paymentId: 'plink_123',
        status: 'completed',
        amount: 100,
        paidAmount: 100,
        metadata: { invoice_id: 'inv_123' }
      });
    });

    it('should process checkout.session.expired event', async () => {
      const mockEvent = {
        type: 'checkout.session.expired',
        data: {
          object: {
            payment_link: 'plink_123',
            metadata: { invoice_id: 'inv_123' }
          }
        }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = await stripeGateway.processWebhook(mockPayload, mockSignature);

      expect(result).toEqual({
        eventType: 'payment_expired',
        paymentId: 'plink_123',
        status: 'cancelled',
        metadata: { invoice_id: 'inv_123' }
      });
    });

    it('should handle webhook signature verification failure', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(stripeGateway.processWebhook(mockPayload, mockSignature))
        .rejects.toThrow('Webhook signature verification failed: Invalid signature');
    });

    it('should require signature', async () => {
      await expect(stripeGateway.processWebhook(mockPayload))
        .rejects.toThrow('Webhook signature is required for Stripe');
    });

    it('should handle unhandled event types', async () => {
      const mockEvent = {
        type: 'unknown.event.type',
        data: { object: {} }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      await expect(stripeGateway.processWebhook(mockPayload, mockSignature))
        .rejects.toThrow('Unhandled webhook event type: unknown.event.type');
    });
  });

  describe('getPaymentStatus', () => {
    it('should get status from payment link', async () => {
      const mockPaymentLink = {
        id: 'plink_123'
      };

      const mockSession = {
        payment_link: 'plink_123',
        status: 'complete',
        amount_total: 10000,
        currency: 'usd',
        payment_intent: 'pi_123',
        payment_method_types: ['card'],
        metadata: { invoice_id: 'inv_123' }
      };

      mockStripe.paymentLinks.retrieve.mockResolvedValue(mockPaymentLink as any);
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [mockSession]
      } as any);

      const result = await stripeGateway.getPaymentStatus('plink_123');

      expect(result).toEqual({
        id: 'plink_123',
        status: 'completed',
        amount: 100,
        currency: 'usd',
        paidAmount: 100,
        paymentMethod: 'card',
        transactionId: 'pi_123',
        paidAt: expect.any(Date),
        metadata: { invoice_id: 'inv_123' }
      });
    });

    it('should get status from payment intent if not payment link', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 10000,
        currency: 'usd',
        payment_method_types: ['card'],
        created: Math.floor(Date.now() / 1000),
        metadata: { invoice_id: 'inv_123' }
      };

      mockStripe.paymentLinks.retrieve.mockRejectedValue(new Error('Not found'));
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent as any);

      const result = await stripeGateway.getPaymentStatus('pi_123');

      expect(result).toEqual({
        id: 'pi_123',
        status: 'completed',
        amount: 100,
        currency: 'usd',
        paidAmount: 100,
        paymentMethod: 'card',
        transactionId: 'pi_123',
        paidAt: expect.any(Date),
        metadata: { invoice_id: 'inv_123' }
      });
    });

    it('should handle no sessions found', async () => {
      const mockPaymentLink = {
        id: 'plink_123'
      };

      mockStripe.paymentLinks.retrieve.mockResolvedValue(mockPaymentLink as any);
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: []
      } as any);

      const result = await stripeGateway.getPaymentStatus('plink_123');

      expect(result).toEqual({
        id: 'plink_123',
        status: 'pending',
        amount: 0,
        currency: 'usd'
      });
    });
  });

  describe('refundPayment', () => {
    it('should process refund successfully', async () => {
      const mockSession = {
        payment_intent: 'pi_123'
      };

      const mockRefund = {
        id: 'ref_123',
        status: 'succeeded',
        amount: 5000,
        reason: 'requested_by_customer'
      };

      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [mockSession]
      } as any);
      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeGateway.refundPayment('plink_123', 50);

      expect(result).toEqual({
        id: 'ref_123',
        status: 'completed',
        amount: 50,
        reason: 'requested_by_customer'
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 5000
      });
    });

    it('should handle full refund', async () => {
      const mockSession = {
        payment_intent: 'pi_123'
      };

      const mockRefund = {
        id: 'ref_123',
        status: 'succeeded',
        amount: 10000
      };

      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [mockSession]
      } as any);
      mockStripe.refunds.create.mockResolvedValue(mockRefund as any);

      const result = await stripeGateway.refundPayment('plink_123');

      expect(result).toEqual({
        id: 'ref_123',
        status: 'completed',
        amount: 100,
        reason: undefined
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123'
      });
    });

    it('should handle no payment session found', async () => {
      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: []
      } as any);

      await expect(stripeGateway.refundPayment('plink_123'))
        .rejects.toThrow('No payment session found for this payment link');
    });

    it('should handle no payment intent found', async () => {
      const mockSession = {
        payment_intent: null
      };

      mockStripe.checkout.sessions.list.mockResolvedValue({
        data: [mockSession]
      } as any);

      await expect(stripeGateway.refundPayment('plink_123'))
        .rejects.toThrow('No payment intent found for this session');
    });
  });
});