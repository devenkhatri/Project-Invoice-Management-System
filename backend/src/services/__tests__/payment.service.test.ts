import { PaymentService } from '../payment.service';
import { SheetsService } from '../sheets.service';
import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../../types/payment';

// Mock SheetsService
jest.mock('../sheets.service');

// Mock payment gateway for testing
class MockPaymentGateway implements PaymentGateway {
  public readonly name = 'mock';

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    return {
      id: 'mock_payment_link_123',
      url: 'https://mock-gateway.com/pay/123',
      expiresAt: params.expiresAt,
      status: 'active'
    };
  }

  async processWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    return {
      eventType: 'payment_completed',
      paymentId: payload.paymentId || 'mock_payment_123',
      status: 'completed',
      amount: payload.amount || 100,
      paidAmount: payload.amount || 100,
      metadata: payload.metadata || {}
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    return {
      id: paymentId,
      status: 'completed',
      amount: 100,
      currency: 'usd',
      paidAmount: 100,
      paymentMethod: 'card',
      transactionId: 'txn_123',
      paidAt: new Date(),
      metadata: {}
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    return {
      id: 'refund_123',
      status: 'completed',
      amount: amount || 100,
      reason: 'requested_by_customer'
    };
  }
}

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockSheetsService: jest.Mocked<SheetsService>;
  let mockGateway: MockPaymentGateway;

  beforeEach(() => {
    mockSheetsService = new SheetsService('test-sheet-id', {}) as jest.Mocked<SheetsService>;
    paymentService = new PaymentService(mockSheetsService);
    mockGateway = new MockPaymentGateway();
    
    // Setup mock implementations
    mockSheetsService.create = jest.fn().mockResolvedValue('created_id');
    mockSheetsService.update = jest.fn().mockResolvedValue(true);
    mockSheetsService.query = jest.fn().mockResolvedValue([]);
    
    paymentService.registerGateway(mockGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Gateway Management', () => {
    it('should register a payment gateway', () => {
      const gateways = paymentService.getAvailableGateways();
      expect(gateways).toContain('mock');
    });

    it('should get a registered gateway', () => {
      const gateway = paymentService.getGateway('mock');
      expect(gateway).toBe(mockGateway);
    });

    it('should return undefined for unregistered gateway', () => {
      const gateway = paymentService.getGateway('nonexistent');
      expect(gateway).toBeUndefined();
    });
  });

  describe('Payment Link Creation', () => {
    const mockParams: CreatePaymentLinkParams = {
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      invoiceId: 'inv_123',
      clientEmail: 'test@example.com',
      clientName: 'Test Client',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      allowPartialPayments: false,
      metadata: { test: 'data' }
    };

    it('should create a payment link successfully', async () => {
      const paymentLink = await paymentService.createPaymentLink('mock', mockParams);

      expect(paymentLink).toEqual({
        id: 'mock_payment_link_123',
        url: 'https://mock-gateway.com/pay/123',
        expiresAt: undefined,
        status: 'active'
      });

      expect(mockSheetsService.create).toHaveBeenCalledWith('Payment_Links', expect.objectContaining({
        id: 'mock_payment_link_123',
        gateway: 'mock',
        url: 'https://mock-gateway.com/pay/123',
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        invoice_id: 'inv_123',
        client_email: 'test@example.com',
        client_name: 'Test Client',
        status: 'active'
      }));
    });

    it('should throw error for unknown gateway', async () => {
      await expect(
        paymentService.createPaymentLink('unknown', mockParams)
      ).rejects.toThrow("Payment gateway 'unknown' not found");
    });

    it('should perform fraud detection', async () => {
      // Mock high-risk scenario
      const highRiskParams = {
        ...mockParams,
        amount: 200000, // High amount
        clientEmail: 'temp@disposable.com' // Suspicious email
      };

      await expect(
        paymentService.createPaymentLink('mock', highRiskParams)
      ).rejects.toThrow('Payment declined due to fraud detection');
    });
  });

  describe('Webhook Processing', () => {
    it('should process webhook successfully', async () => {
      const mockPayload = {
        paymentId: 'payment_123',
        amount: 100,
        metadata: { invoice_id: 'inv_123' }
      };

      const result = await paymentService.processWebhook('mock', mockPayload);

      expect(result).toEqual({
        eventType: 'payment_completed',
        paymentId: 'payment_123',
        status: 'completed',
        amount: 100,
        paidAmount: 100,
        metadata: { invoice_id: 'inv_123' }
      });

      expect(mockSheetsService.update).toHaveBeenCalledWith(
        'Payment_Links',
        'payment_123',
        expect.objectContaining({
          status: 'completed',
          paid_amount: 100
        })
      );
    });

    it('should update invoice status on payment completion', async () => {
      mockSheetsService.query.mockResolvedValueOnce([{
        id: 'payment_123',
        invoice_id: 'inv_123'
      }]);

      const mockPayload = {
        paymentId: 'payment_123',
        amount: 100
      };

      await paymentService.processWebhook('mock', mockPayload);

      expect(mockSheetsService.update).toHaveBeenCalledWith(
        'Invoices',
        'inv_123',
        expect.objectContaining({
          status: 'paid'
        })
      );
    });
  });

  describe('Payment Status', () => {
    it('should get payment status', async () => {
      const status = await paymentService.getPaymentStatus('mock', 'payment_123');

      expect(status).toEqual({
        id: 'payment_123',
        status: 'completed',
        amount: 100,
        currency: 'usd',
        paidAmount: 100,
        paymentMethod: 'card',
        transactionId: 'txn_123',
        paidAt: expect.any(Date),
        metadata: {}
      });
    });

    it('should throw error for unknown gateway', async () => {
      await expect(
        paymentService.getPaymentStatus('unknown', 'payment_123')
      ).rejects.toThrow("Payment gateway 'unknown' not found");
    });
  });

  describe('Refunds', () => {
    it('should process refund successfully', async () => {
      const refund = await paymentService.refundPayment('mock', 'payment_123', 50);

      expect(refund).toEqual({
        id: 'refund_123',
        status: 'completed',
        amount: 50,
        reason: 'requested_by_customer'
      });

      expect(mockSheetsService.update).toHaveBeenCalledWith(
        'Payment_Links',
        'payment_123',
        expect.objectContaining({
          status: 'partially_refunded'
        })
      );
    });

    it('should handle full refund', async () => {
      await paymentService.refundPayment('mock', 'payment_123');

      expect(mockSheetsService.update).toHaveBeenCalledWith(
        'Payment_Links',
        'payment_123',
        expect.objectContaining({
          status: 'refunded'
        })
      );
    });
  });

  describe('Payment Analytics', () => {
    beforeEach(() => {
      const mockPayments = [
        {
          id: 'payment_1',
          gateway: 'mock',
          amount: 100,
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          paid_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 'payment_2',
          gateway: 'mock',
          amount: 200,
          status: 'failed',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'payment_3',
          gateway: 'stripe',
          amount: 150,
          status: 'completed',
          created_at: '2024-01-01T00:00:00Z',
          paid_at: '2024-01-01T12:00:00Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockPayments);
    });

    it('should calculate payment analytics', async () => {
      const analytics = await paymentService.getPaymentAnalytics();

      expect(analytics).toHaveLength(2); // mock and stripe gateways

      const mockAnalytics = analytics.find(a => a.gateway === 'mock');
      expect(mockAnalytics).toEqual({
        gateway: 'mock',
        totalTransactions: 2,
        successfulTransactions: 1,
        failedTransactions: 1,
        successRate: 50,
        totalAmount: 300,
        averagePaymentTime: 1, // 1 day
        averageTransactionAmount: 150,
        period: expect.any(Object)
      });
    });

    it('should filter analytics by gateway', async () => {
      const analytics = await paymentService.getPaymentAnalytics('mock');

      expect(mockSheetsService.query).toHaveBeenCalledWith('Payment_Links', {
        gateway: 'mock'
      });
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await paymentService.getPaymentAnalytics(undefined, startDate, endDate);

      expect(mockSheetsService.query).toHaveBeenCalledWith('Payment_Links', {
        created_at: {
          '>=': startDate.toISOString(),
          '<=': endDate.toISOString()
        }
      });
    });
  });

  describe('Fraud Detection', () => {
    it('should detect high amount transactions', async () => {
      const highAmountParams: CreatePaymentLinkParams = {
        amount: 150000, // $1500
        currency: 'USD',
        description: 'High value payment',
        invoiceId: 'inv_123',
        clientEmail: 'test@example.com',
        clientName: 'Test Client'
      };

      await expect(
        paymentService.createPaymentLink('mock', highAmountParams)
      ).rejects.toThrow('Payment declined due to fraud detection');
    });

    it('should detect suspicious email patterns', async () => {
      const suspiciousParams: CreatePaymentLinkParams = {
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        invoiceId: 'inv_123',
        clientEmail: 'temp@disposable.com',
        clientName: 'Test Client'
      };

      await expect(
        paymentService.createPaymentLink('mock', suspiciousParams)
      ).rejects.toThrow('Payment declined due to fraud detection');
    });

    it('should detect rapid successive payments', async () => {
      // Mock recent payments from same client
      mockSheetsService.query.mockResolvedValueOnce(
        Array(6).fill({
          client_email: 'test@example.com',
          created_at: new Date().toISOString()
        })
      );

      const rapidParams: CreatePaymentLinkParams = {
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        invoiceId: 'inv_123',
        clientEmail: 'test@example.com',
        clientName: 'Test Client'
      };

      await expect(
        paymentService.createPaymentLink('mock', rapidParams)
      ).rejects.toThrow('Payment declined due to fraud detection');
    });

    it('should allow low-risk transactions', async () => {
      const lowRiskParams: CreatePaymentLinkParams = {
        amount: 50,
        currency: 'USD',
        description: 'Low risk payment',
        invoiceId: 'inv_123',
        clientEmail: 'legitimate@company.com',
        clientName: 'Legitimate Client'
      };

      const result = await paymentService.createPaymentLink('mock', lowRiskParams);
      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });
  });
});