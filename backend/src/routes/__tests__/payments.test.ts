import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { PaymentProcessingService } from '../../services/paymentProcessing';
import { PaymentGateway } from '../../models/types';
import { initializePaymentRoutes } from '../payments';
import { authenticateToken } from '../../middleware/auth';
import { handleValidationErrors } from '../../middleware/validation';

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'user_123', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: jest.requireActual('../../middleware/auth').AuthenticatedRequest
}));

jest.mock('../../middleware/validation', () => ({
  handleValidationErrors: jest.fn((req, res, next) => next())
}));

// Mock services
jest.mock('../../services/googleSheets');
jest.mock('../../services/paymentProcessing');

describe('Payment Routes', () => {
  let app: express.Application;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockPaymentService: jest.Mocked<PaymentProcessingService>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock services
    mockSheetsService = new GoogleSheetsService({
      spreadsheetId: 'mock-id',
      serviceAccountEmail: 'mock@example.com',
      privateKey: 'mock-key'
    }) as jest.Mocked<GoogleSheetsService>;
    
    mockPaymentService = new PaymentProcessingService(
      mockSheetsService
    ) as jest.Mocked<PaymentProcessingService>;
    
    // Create express app
    app = express();
    app.use(express.json());
    
    // Initialize routes
    const paymentRoutes = initializePaymentRoutes(mockSheetsService, mockPaymentService);
    app.use('/api/payments', paymentRoutes);
  });
  
  describe('POST /api/payments/generate-link', () => {
    it('should generate a payment link for an invoice', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR',
        client_id: 'client_123',
        isPaid: () => false
      };
      
      // Mock client data
      const mockClient = {
        id: 'client_123',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Mock service responses
      mockSheetsService.read = jest.fn()
        .mockImplementation((sheetName, id) => {
          if (sheetName === 'Invoices' && id === 'inv_123') return [mockInvoice];
          if (sheetName === 'Clients' && id === 'client_123') return [mockClient];
          return [];
        });
      
      mockPaymentService.generatePaymentLink = jest.fn()
        .mockResolvedValue('https://rzp.io/i/mock-payment-link');
      
      const response = await request(app)
        .post('/api/payments/generate-link')
        .send({
          invoice_id: 'inv_123',
          gateway: 'razorpay',
          description: 'Test payment',
          expires_in_days: 7
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment_link).toBe('https://rzp.io/i/mock-payment-link');
      expect(mockPaymentService.generatePaymentLink).toHaveBeenCalledWith(
        'inv_123',
        PaymentGateway.RAZORPAY,
        expect.objectContaining({
          description: 'Test payment',
          expiresInDays: 7
        })
      );
    });
    
    it('should return 404 for non-existent invoice', async () => {
      // Mock empty invoice response
      mockSheetsService.read = jest.fn().mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/payments/generate-link')
        .send({
          invoice_id: 'non_existent',
          gateway: 'razorpay'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });
  });
  
  describe('POST /api/payments/record', () => {
    it('should record a payment for an invoice', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR'
      };
      
      // Mock payment data
      const mockPayment = {
        id: 'payment_123',
        invoice_id: 'inv_123',
        amount: 1000,
        currency: 'INR',
        gateway: PaymentGateway.STRIPE,
        gateway_payment_id: 'pi_123456',
        status: 'completed',
        payment_date: new Date(),
        payment_method: 'card',
        transaction_fee: 20,
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Mock service responses
      mockSheetsService.read = jest.fn().mockResolvedValue([mockInvoice]);
      mockPaymentService.processPayment = jest.fn().mockResolvedValue(mockPayment);
      
      const response = await request(app)
        .post('/api/payments/record')
        .send({
          invoice_id: 'inv_123',
          amount: 1000,
          gateway: 'stripe',
          gateway_payment_id: 'pi_123456',
          payment_method: 'card',
          transaction_fee: 20
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment_id).toBe('payment_123');
      expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
        'inv_123',
        expect.objectContaining({
          amount: 1000,
          gateway: PaymentGateway.STRIPE,
          gateway_payment_id: 'pi_123456',
          payment_method: 'card',
          transaction_fee: 20
        })
      );
    });
  });
  
  describe('GET /api/payments/history/:invoiceId', () => {
    it('should return payment history for an invoice', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR',
        status: 'paid'
      };
      
      // Mock payments data
      const mockPayments = [
        {
          id: 'payment_123',
          invoice_id: 'inv_123',
          amount: 1000,
          currency: 'INR',
          gateway: PaymentGateway.STRIPE,
          gateway_payment_id: 'pi_123456',
          status: 'completed',
          payment_date: new Date(),
          payment_method: 'card',
          transaction_fee: 20,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      // Mock service responses
      mockSheetsService.read = jest.fn().mockResolvedValue([mockInvoice]);
      mockPaymentService.getPaymentHistory = jest.fn().mockResolvedValue(mockPayments);
      
      const response = await request(app)
        .get('/api/payments/history/inv_123');
      
      expect(response.status).toBe(200);
      expect(response.body.invoice_id).toBe('inv_123');
      expect(response.body.payments).toHaveLength(1);
      expect(response.body.total_paid).toBe(1000);
      expect(mockPaymentService.getPaymentHistory).toHaveBeenCalledWith('inv_123');
    });
  });
  
  describe('POST /api/payments/check-overdue', () => {
    it('should check for overdue invoices and apply late fees', async () => {
      // Mock service response
      mockPaymentService.checkOverdueInvoicesAndApplyLateFees = jest.fn()
        .mockResolvedValue({
          checked: 10,
          overdue: 2,
          feesApplied: 1
        });
      
      const response = await request(app)
        .post('/api/payments/check-overdue')
        .send({
          apply_late_fees: true,
          send_reminders: false
        });
      
      expect(response.status).toBe(200);
      expect(response.body.overdue_check.total_checked).toBe(10);
      expect(response.body.overdue_check.overdue_found).toBe(2);
      expect(response.body.overdue_check.late_fees_applied).toBe(1);
      expect(mockPaymentService.checkOverdueInvoicesAndApplyLateFees).toHaveBeenCalled();
    });
    
    it('should send reminders if requested', async () => {
      // Mock service responses
      mockPaymentService.checkOverdueInvoicesAndApplyLateFees = jest.fn()
        .mockResolvedValue({
          checked: 10,
          overdue: 2,
          feesApplied: 1
        });
      
      mockPaymentService.sendPaymentReminders = jest.fn()
        .mockResolvedValue({
          total: 2,
          sent: 2,
          failed: 0,
          details: []
        });
      
      const response = await request(app)
        .post('/api/payments/check-overdue')
        .send({
          apply_late_fees: true,
          send_reminders: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body.reminders.total).toBe(2);
      expect(response.body.reminders.sent).toBe(2);
      expect(mockPaymentService.sendPaymentReminders).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/payments/late-fee-config', () => {
    it('should update late fee configuration', async () => {
      // Mock service methods
      mockPaymentService.setLateFeeConfig = jest.fn();
      mockPaymentService.getLateFeeConfig = jest.fn().mockReturnValue({
        enabled: true,
        gracePeriodDays: 5,
        feeType: 'percentage',
        feeAmount: 2,
        maxFeeAmount: 10,
        compoundingPeriodDays: 30
      });
      
      const response = await request(app)
        .post('/api/payments/late-fee-config')
        .send({
          enabled: true,
          grace_period_days: 5,
          fee_type: 'percentage',
          fee_amount: 2,
          max_fee_amount: 10,
          compounding_period_days: 30
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockPaymentService.setLateFeeConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          gracePeriodDays: 5,
          feeType: 'percentage',
          feeAmount: 2
        })
      );
    });
  });
  
  describe('GET /api/payments/late-fee-config', () => {
    it('should return late fee configuration', async () => {
      // Mock service method
      mockPaymentService.getLateFeeConfig = jest.fn().mockReturnValue({
        enabled: true,
        gracePeriodDays: 5,
        feeType: 'percentage',
        feeAmount: 2,
        maxFeeAmount: 10,
        compoundingPeriodDays: 30
      });
      
      const response = await request(app)
        .get('/api/payments/late-fee-config');
      
      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
      expect(response.body.fee_type).toBe('percentage');
      expect(response.body.fee_amount).toBe(2);
      expect(mockPaymentService.getLateFeeConfig).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/payments/send-reminders', () => {
    it('should send payment reminders for overdue invoices', async () => {
      // Mock service response
      mockPaymentService.sendPaymentReminders = jest.fn()
        .mockResolvedValue({
          total: 3,
          sent: 2,
          failed: 1,
          details: []
        });
      
      const response = await request(app)
        .post('/api/payments/send-reminders')
        .send({
          days_overdue: 7,
          include_payment_link: true
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.total).toBe(3);
      expect(response.body.sent).toBe(2);
      expect(response.body.failed).toBe(1);
      expect(mockPaymentService.sendPaymentReminders).toHaveBeenCalledWith({
        daysOverdue: 7,
        includePaymentLink: true
      });
    });
  });
  
  describe('POST /api/payments/webhook/:gateway', () => {
    it('should handle webhook events from payment gateways', async () => {
      const response = await request(app)
        .post('/api/payments/webhook/stripe')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123456',
              amount: 1000,
              currency: 'inr',
              status: 'succeeded'
            }
          }
        });
      
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
    
    it('should reject invalid gateway names', async () => {
      const response = await request(app)
        .post('/api/payments/webhook/invalid')
        .send({});
      
      expect(response.status).toBe(404);
    });
  });
});