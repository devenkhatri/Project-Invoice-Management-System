import request from 'supertest';
import express from 'express';
import paymentRoutes from '../payments';
import { PaymentService } from '../../services/payment.service';
import { PaymentReminderService } from '../../services/payment-reminder.service';

// Mock services
jest.mock('../../services/payment.service');
jest.mock('../../services/payment-reminder.service');
jest.mock('../../services/sheets.service');
jest.mock('../../services/stripe.service');
jest.mock('../../services/paypal.service');
jest.mock('../../services/razorpay.service');

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user_123', email: 'test@example.com' };
    next();
  }
}));

describe('Payment Routes', () => {
  let app: express.Application;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockReminderService: jest.Mocked<PaymentReminderService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentRoutes);

    mockPaymentService = {
      getAvailableGateways: jest.fn(),
      createPaymentLink: jest.fn(),
      getPaymentStatus: jest.fn(),
      refundPayment: jest.fn(),
      processWebhook: jest.fn(),
      getPaymentAnalytics: jest.fn()
    } as any;

    mockReminderService = {
      createReminderRule: jest.fn(),
      createLateFeeRule: jest.fn(),
      processScheduledReminders: jest.fn(),
      processLateFees: jest.fn()
    } as any;

    // Mock the service instances
    (PaymentService as jest.MockedClass<typeof PaymentService>).mockImplementation(() => mockPaymentService);
    (PaymentReminderService as jest.MockedClass<typeof PaymentReminderService>).mockImplementation(() => mockReminderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gateways', () => {
    it('should return available payment gateways', async () => {
      mockPaymentService.getAvailableGateways.mockReturnValue(['stripe', 'paypal', 'razorpay']);

      const response = await request(app)
        .get('/api/payments/gateways')
        .expect(200);

      expect(response.body).toEqual({
        gateways: ['stripe', 'paypal', 'razorpay']
      });
    });

    it('should handle service errors', async () => {
      mockPaymentService.getAvailableGateways.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/payments/gateways')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get payment gateways',
        message: 'Service error'
      });
    });
  });

  describe('POST /links', () => {
    const validPaymentLinkData = {
      gateway: 'stripe',
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      invoiceId: 'inv_123',
      clientEmail: 'client@example.com',
      clientName: 'Test Client',
      successUrl: 'https://example.com/success',
      allowPartialPayments: false
    };

    it('should create payment link successfully', async () => {
      const mockPaymentLink = {
        id: 'plink_123',
        url: 'https://checkout.stripe.com/pay/plink_123',
        status: 'active' as const
      };

      mockPaymentService.createPaymentLink.mockResolvedValue(mockPaymentLink);

      const response = await request(app)
        .post('/api/payments/links')
        .send(validPaymentLinkData)
        .expect(201);

      expect(response.body).toEqual(mockPaymentLink);
      expect(mockPaymentService.createPaymentLink).toHaveBeenCalledWith('stripe', {
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        invoiceId: 'inv_123',
        clientEmail: 'client@example.com',
        clientName: 'Test Client',
        successUrl: 'https://example.com/success',
        allowPartialPayments: false
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/payments/links')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/payments/links')
        .send({
          ...validPaymentLinkData,
          clientEmail: 'invalid-email'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate amount is positive', async () => {
      const response = await request(app)
        .post('/api/payments/links')
        .send({
          ...validPaymentLinkData,
          amount: -10
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle service errors', async () => {
      mockPaymentService.createPaymentLink.mockRejectedValue(new Error('Payment gateway error'));

      const response = await request(app)
        .post('/api/payments/links')
        .send(validPaymentLinkData)
        .expect(400);

      expect(response.body).toEqual({
        error: 'Failed to create payment link',
        message: 'Payment gateway error'
      });
    });
  });

  describe('GET /status/:gateway/:paymentId', () => {
    it('should get payment status successfully', async () => {
      const mockStatus = {
        id: 'payment_123',
        status: 'completed' as const,
        amount: 100,
        currency: 'usd',
        paidAmount: 100
      };

      mockPaymentService.getPaymentStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/payments/status/stripe/payment_123')
        .expect(200);

      expect(response.body).toEqual(mockStatus);
      expect(mockPaymentService.getPaymentStatus).toHaveBeenCalledWith('stripe', 'payment_123');
    });

    it('should handle service errors', async () => {
      mockPaymentService.getPaymentStatus.mockRejectedValue(new Error('Payment not found'));

      const response = await request(app)
        .get('/api/payments/status/stripe/payment_123')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Failed to get payment status',
        message: 'Payment not found'
      });
    });
  });

  describe('POST /refund', () => {
    const validRefundData = {
      gateway: 'stripe',
      paymentId: 'payment_123',
      amount: 50
    };

    it('should process refund successfully', async () => {
      const mockRefund = {
        id: 'refund_123',
        status: 'completed' as const,
        amount: 50
      };

      mockPaymentService.refundPayment.mockResolvedValue(mockRefund);

      const response = await request(app)
        .post('/api/payments/refund')
        .send(validRefundData)
        .expect(200);

      expect(response.body).toEqual(mockRefund);
      expect(mockPaymentService.refundPayment).toHaveBeenCalledWith('stripe', 'payment_123', 50);
    });

    it('should handle full refund', async () => {
      const fullRefundData = {
        gateway: 'stripe',
        paymentId: 'payment_123'
      };

      const mockRefund = {
        id: 'refund_123',
        status: 'completed' as const,
        amount: 100
      };

      mockPaymentService.refundPayment.mockResolvedValue(mockRefund);

      const response = await request(app)
        .post('/api/payments/refund')
        .send(fullRefundData)
        .expect(200);

      expect(response.body).toEqual(mockRefund);
      expect(mockPaymentService.refundPayment).toHaveBeenCalledWith('stripe', 'payment_123', undefined);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/payments/refund')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Webhook Endpoints', () => {
    describe('POST /webhooks/stripe', () => {
      it('should process Stripe webhook successfully', async () => {
        const mockResult = {
          eventType: 'payment_completed',
          paymentId: 'payment_123',
          status: 'completed' as const,
          amount: 100
        };

        mockPaymentService.processWebhook.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/payments/webhooks/stripe')
          .set('stripe-signature', 'test_signature')
          .send({ test: 'payload' })
          .expect(200);

        expect(response.body).toEqual({
          received: true,
          result: mockResult
        });

        expect(mockPaymentService.processWebhook).toHaveBeenCalledWith(
          'stripe',
          expect.any(Buffer),
          'test_signature'
        );
      });

      it('should handle webhook processing errors', async () => {
        mockPaymentService.processWebhook.mockRejectedValue(new Error('Invalid signature'));

        const response = await request(app)
          .post('/api/payments/webhooks/stripe')
          .set('stripe-signature', 'invalid_signature')
          .send({ test: 'payload' })
          .expect(400);

        expect(response.body).toEqual({
          error: 'Webhook processing failed',
          message: 'Invalid signature'
        });
      });
    });

    describe('POST /webhooks/paypal', () => {
      it('should process PayPal webhook successfully', async () => {
        const mockResult = {
          eventType: 'payment_completed',
          paymentId: 'payment_123',
          status: 'completed' as const,
          amount: 100
        };

        mockPaymentService.processWebhook.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/payments/webhooks/paypal')
          .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED' })
          .expect(200);

        expect(response.body).toEqual({
          received: true,
          result: mockResult
        });
      });
    });

    describe('POST /webhooks/razorpay', () => {
      it('should process Razorpay webhook successfully', async () => {
        const mockResult = {
          eventType: 'payment_completed',
          paymentId: 'payment_123',
          status: 'completed' as const,
          amount: 100
        };

        mockPaymentService.processWebhook.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/payments/webhooks/razorpay')
          .set('x-razorpay-signature', 'test_signature')
          .send({ event: 'payment.captured' })
          .expect(200);

        expect(response.body).toEqual({
          received: true,
          result: mockResult
        });
      });
    });
  });

  describe('GET /analytics', () => {
    it('should get payment analytics', async () => {
      const mockAnalytics = [
        {
          gateway: 'stripe',
          totalTransactions: 10,
          successfulTransactions: 8,
          failedTransactions: 2,
          successRate: 80,
          totalAmount: 1000,
          averagePaymentTime: 2,
          averageTransactionAmount: 100,
          period: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        }
      ];

      mockPaymentService.getPaymentAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/payments/analytics')
        .expect(200);

      expect(response.body).toEqual(mockAnalytics);
    });

    it('should filter analytics by gateway', async () => {
      const mockAnalytics = [
        {
          gateway: 'stripe',
          totalTransactions: 5,
          successfulTransactions: 4,
          failedTransactions: 1,
          successRate: 80,
          totalAmount: 500,
          averagePaymentTime: 1.5,
          averageTransactionAmount: 100,
          period: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          }
        }
      ];

      mockPaymentService.getPaymentAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/payments/analytics?gateway=stripe')
        .expect(200);

      expect(mockPaymentService.getPaymentAnalytics).toHaveBeenCalledWith(
        'stripe',
        undefined,
        undefined
      );
    });

    it('should filter analytics by date range', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      await request(app)
        .get(`/api/payments/analytics?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(mockPaymentService.getPaymentAnalytics).toHaveBeenCalledWith(
        undefined,
        new Date(startDate),
        new Date(endDate)
      );
    });
  });

  describe('Payment Reminder Routes', () => {
    describe('POST /reminders', () => {
      const validReminderData = {
        invoiceId: 'inv_123',
        type: 'before_due',
        daysOffset: 3,
        template: 'Payment due in 3 days',
        method: 'email'
      };

      it('should create reminder successfully', async () => {
        mockReminderService.createReminderRule.mockResolvedValue('reminder_123');

        const response = await request(app)
          .post('/api/payments/reminders')
          .send(validReminderData)
          .expect(201);

        expect(response.body).toEqual({ id: 'reminder_123' });
        expect(mockReminderService.createReminderRule).toHaveBeenCalledWith(
          'inv_123',
          'before_due',
          3,
          'Payment due in 3 days',
          'email'
        );
      });

      it('should validate reminder type', async () => {
        const response = await request(app)
          .post('/api/payments/reminders')
          .send({
            ...validReminderData,
            type: 'invalid_type'
          })
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });

      it('should validate reminder method', async () => {
        const response = await request(app)
          .post('/api/payments/reminders')
          .send({
            ...validReminderData,
            method: 'invalid_method'
          })
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });
    });

    describe('POST /late-fee-rules', () => {
      const validLateFeeData = {
        name: 'Standard Late Fee',
        type: 'percentage',
        amount: 5,
        gracePeriodDays: 7,
        maxAmount: 100,
        isActive: true
      };

      it('should create late fee rule successfully', async () => {
        mockReminderService.createLateFeeRule.mockResolvedValue('rule_123');

        const response = await request(app)
          .post('/api/payments/late-fee-rules')
          .send(validLateFeeData)
          .expect(201);

        expect(response.body).toEqual({ id: 'rule_123' });
        expect(mockReminderService.createLateFeeRule).toHaveBeenCalledWith({
          name: 'Standard Late Fee',
          type: 'percentage',
          amount: 5,
          gracePeriodDays: 7,
          maxAmount: 100,
          compoundingFrequency: undefined,
          isActive: true
        });
      });

      it('should validate late fee type', async () => {
        const response = await request(app)
          .post('/api/payments/late-fee-rules')
          .send({
            ...validLateFeeData,
            type: 'invalid_type'
          })
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });

      it('should validate amount is non-negative', async () => {
        const response = await request(app)
          .post('/api/payments/late-fee-rules')
          .send({
            ...validLateFeeData,
            amount: -5
          })
          .expect(400);

        expect(response.body.errors).toBeDefined();
      });
    });

    describe('POST /reminders/process', () => {
      it('should process reminders manually', async () => {
        mockReminderService.processScheduledReminders.mockResolvedValue();

        const response = await request(app)
          .post('/api/payments/reminders/process')
          .expect(200);

        expect(response.body).toEqual({
          message: 'Reminders processed successfully'
        });

        expect(mockReminderService.processScheduledReminders).toHaveBeenCalled();
      });

      it('should handle processing errors', async () => {
        mockReminderService.processScheduledReminders.mockRejectedValue(new Error('Processing error'));

        const response = await request(app)
          .post('/api/payments/reminders/process')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Failed to process reminders',
          message: 'Processing error'
        });
      });
    });

    describe('POST /late-fees/process', () => {
      it('should process late fees manually', async () => {
        mockReminderService.processLateFees.mockResolvedValue();

        const response = await request(app)
          .post('/api/payments/late-fees/process')
          .expect(200);

        expect(response.body).toEqual({
          message: 'Late fees processed successfully'
        });

        expect(mockReminderService.processLateFees).toHaveBeenCalled();
      });

      it('should handle processing errors', async () => {
        mockReminderService.processLateFees.mockRejectedValue(new Error('Processing error'));

        const response = await request(app)
          .post('/api/payments/late-fees/process')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Failed to process late fees',
          message: 'Processing error'
        });
      });
    });
  });
});