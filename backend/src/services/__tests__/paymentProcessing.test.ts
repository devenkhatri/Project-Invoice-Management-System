import { PaymentProcessingService } from '../paymentProcessing';
import { GoogleSheetsService } from '../googleSheets';
import { Invoice } from '../../models/Invoice';
import { InvoiceStatus, PaymentGateway, PaymentStatus } from '../../models/types';

// Mock GoogleSheetsService
jest.mock('../googleSheets');

describe('PaymentProcessingService', () => {
  let paymentService: PaymentProcessingService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock sheets service
    mockSheetsService = new GoogleSheetsService({
      spreadsheetId: 'mock-id',
      serviceAccountEmail: 'mock@example.com',
      privateKey: 'mock-key'
    }) as jest.Mocked<GoogleSheetsService>;
    
    // Initialize payment service with mock sheets service
    paymentService = new PaymentProcessingService(mockSheetsService);
  });
  
  describe('initializePaymentsSheet', () => {
    it('should create Payments sheet if it does not exist', async () => {
      // Mock getSpreadsheetInfo to return no Payments sheet
      mockSheetsService.getSpreadsheetInfo = jest.fn().mockResolvedValue({
        sheets: [{ properties: { title: 'Invoices' } }]
      });
      
      // Mock createSheet to return success
      mockSheetsService.createSheet = jest.fn().mockResolvedValue(true);
      
      const result = await paymentService.initializePaymentsSheet();
      
      expect(result).toBe(true);
      expect(mockSheetsService.createSheet).toHaveBeenCalledWith('Payments', expect.any(Array));
    });
    
    it('should not create Payments sheet if it already exists', async () => {
      // Mock getSpreadsheetInfo to return Payments sheet
      mockSheetsService.getSpreadsheetInfo = jest.fn().mockResolvedValue({
        sheets: [
          { properties: { title: 'Invoices' } },
          { properties: { title: 'Payments' } }
        ]
      });
      
      const result = await paymentService.initializePaymentsSheet();
      
      expect(result).toBe(true);
      expect(mockSheetsService.createSheet).not.toHaveBeenCalled();
    });
  });
  
  describe('generatePaymentLink', () => {
    it('should generate a payment link for an invoice', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR',
        status: InvoiceStatus.SENT,
        isPaid: () => false,
        setPaymentLink: jest.fn(),
        toSheetRow: jest.fn().mockReturnValue({})
      };
      
      // Mock read to return invoice
      mockSheetsService.read = jest.fn().mockResolvedValue([mockInvoice]);
      
      // Mock update to succeed
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      const result = await paymentService.generatePaymentLink(
        'inv_123',
        PaymentGateway.RAZORPAY
      );
      
      expect(result).toContain('https://rzp.io/i/');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices', 'inv_123');
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_123', expect.any(Object));
    });
    
    it('should throw an error for paid invoices', async () => {
      // Mock invoice data for a paid invoice
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR',
        status: InvoiceStatus.PAID,
        isPaid: () => true
      };
      
      // Mock read to return invoice
      mockSheetsService.read = jest.fn().mockResolvedValue([mockInvoice]);
      
      await expect(paymentService.generatePaymentLink(
        'inv_123',
        PaymentGateway.STRIPE
      )).rejects.toThrow('Cannot generate payment link for paid invoices');
    });
  });
  
  describe('processPayment', () => {
    it('should process a payment and update invoice status', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_123',
        invoice_number: 'INV-2024-001',
        total_amount: 1000,
        currency: 'INR',
        status: InvoiceStatus.SENT,
        markAsPaid: jest.fn(),
        toSheetRow: jest.fn().mockReturnValue({})
      };
      
      // Mock read to return invoice
      mockSheetsService.read = jest.fn().mockResolvedValue([mockInvoice]);
      
      // Mock initializePaymentsSheet to succeed
      jest.spyOn(paymentService, 'initializePaymentsSheet').mockResolvedValue(true);
      
      // Mock create to return payment ID
      mockSheetsService.create = jest.fn().mockResolvedValue('payment_123');
      
      // Mock update to succeed
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      const result = await paymentService.processPayment('inv_123', {
        amount: 1000,
        gateway: PaymentGateway.STRIPE,
        gateway_payment_id: 'pi_123456',
        payment_method: 'card'
      });
      
      expect(result.id).toBeDefined();
      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(mockInvoice.markAsPaid).toHaveBeenCalled();
      expect(mockSheetsService.create).toHaveBeenCalledWith('Payments', expect.any(Object));
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_123', expect.any(Object));
    });
  });
  
  describe('getPaymentHistory', () => {
    it('should return payment history for an invoice', async () => {
      // Mock payment data
      const mockPayments = [
        {
          id: 'payment_123',
          invoice_id: 'inv_123',
          amount: '1000',
          currency: 'INR',
          gateway: 'stripe',
          gateway_payment_id: 'pi_123456',
          status: 'completed',
          payment_date: '2024-02-15T10:30:00Z',
          payment_method: 'card',
          transaction_fee: '20',
          metadata: '{}',
          created_at: '2024-02-15T10:30:00Z',
          updated_at: '2024-02-15T10:30:00Z'
        }
      ];
      
      // Mock query to return payments
      mockSheetsService.query = jest.fn().mockResolvedValue(mockPayments);
      
      const result = await paymentService.getPaymentHistory('inv_123');
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('payment_123');
      expect(result[0].amount).toBe(1000);
      expect(result[0].status).toBe(PaymentStatus.COMPLETED);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Payments', { invoice_id: 'inv_123' });
    });
  });
  
  describe('checkOverdueInvoicesAndApplyLateFees', () => {
    it('should check for overdue invoices and apply late fees', async () => {
      // Mock invoice data
      const mockInvoices = [
        {
          id: 'inv_123',
          invoice_number: 'INV-2024-001',
          total_amount: 1000,
          amount: 1000,
          status: InvoiceStatus.SENT,
          due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          isPaid: () => false,
          isOverdue: () => true,
          getDaysOverdue: () => 10,
          markAsOverdue: jest.fn(),
          toSheetRow: jest.fn().mockReturnValue({})
        },
        {
          id: 'inv_456',
          invoice_number: 'INV-2024-002',
          total_amount: 2000,
          status: InvoiceStatus.PAID,
          due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          isPaid: () => true,
          isOverdue: () => false
        }
      ];
      
      // Mock read to return invoices
      mockSheetsService.read = jest.fn().mockResolvedValue(mockInvoices);
      
      // Mock update to succeed
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      // Mock query to return no existing late fee items
      mockSheetsService.query = jest.fn().mockResolvedValue([]);
      
      // Mock create to succeed
      mockSheetsService.create = jest.fn().mockResolvedValue('item_123');
      
      const result = await paymentService.checkOverdueInvoicesAndApplyLateFees();
      
      expect(result.checked).toBe(2);
      expect(result.overdue).toBe(1);
      expect(result.feesApplied).toBe(1);
      expect(mockInvoices[0].markAsOverdue).toHaveBeenCalled();
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_123', expect.any(Object));
      expect(mockSheetsService.create).toHaveBeenCalledWith('Invoice_Items', expect.any(Object));
    });
  });
  
  describe('sendPaymentReminders', () => {
    it('should send payment reminders for overdue invoices', async () => {
      // Mock invoice data
      const mockInvoices = [
        {
          id: 'inv_123',
          invoice_number: 'INV-2024-001',
          client_id: 'client_123',
          project_id: 'project_123',
          total_amount: 1000,
          status: InvoiceStatus.OVERDUE,
          getDaysOverdue: () => 10,
          payment_link: 'https://pay.example.com/inv_123'
        }
      ];
      
      // Mock client data
      const mockClient = {
        id: 'client_123',
        name: 'Test Client',
        email: 'client@example.com'
      };
      
      // Mock read to return invoices and client
      mockSheetsService.read = jest.fn()
        .mockImplementation((sheetName, id) => {
          if (sheetName === 'Invoices') return mockInvoices;
          if (sheetName === 'Clients' && id === 'client_123') return [mockClient];
          return [];
        });
      
      // Mock create to succeed for communication record
      mockSheetsService.create = jest.fn().mockResolvedValue('comm_123');
      
      const result = await paymentService.sendPaymentReminders();
      
      expect(result.total).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockSheetsService.create).toHaveBeenCalledWith('Communications', expect.any(Object));
    });
  });
  
  describe('Late fee configuration', () => {
    it('should set and get late fee configuration', () => {
      const newConfig = {
        enabled: false,
        gracePeriodDays: 5,
        feeType: 'fixed' as const,
        feeAmount: 100
      };
      
      paymentService.setLateFeeConfig(newConfig);
      const config = paymentService.getLateFeeConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.gracePeriodDays).toBe(5);
      expect(config.feeType).toBe('fixed');
      expect(config.feeAmount).toBe(100);
    });
  });
});