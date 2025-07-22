import { EInvoicingService, EInvoiceStatus } from '../eInvoicing';
import { GoogleSheetsService } from '../googleSheets';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { Client } from '../../models/Client';
import { Project } from '../../models/Project';

// Mock dependencies
jest.mock('../googleSheets');
jest.mock('qrcode');
jest.mock('crypto');

describe('EInvoicingService', () => {
  let eInvoicingService: EInvoicingService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    
    // Mock the initializeEInvoiceSheet method
    jest.spyOn(EInvoicingService.prototype, 'initializeEInvoiceSheet').mockImplementation(() => Promise.resolve());
    
    // Create service instance with mocks
    eInvoicingService = new EInvoicingService(mockSheetsService);
  });
  
  describe('generateEInvoice', () => {
    it('should generate e-invoice for a valid invoice', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_1',
        invoice_number: 'INV-001',
        client_id: 'client_1',
        project_id: 'project_1',
        amount: 100000,
        tax_amount: 18000,
        total_amount: 118000,
        status: InvoiceStatus.SENT,
        created_at: new Date('2023-01-15'),
        due_date: new Date('2023-02-15'),
        getTaxRate: jest.fn().mockReturnValue(18),
        e_invoice_id: null
      };
      
      // Mock client data
      const mockClient = {
        id: 'client_1',
        name: 'Test Client',
        email: 'client@example.com',
        gstin: '27AAAAA0000A1Z5',
        state: 'Maharashtra',
        state_code: '27'
      };
      
      // Mock project data
      const mockProject = {
        id: 'project_1',
        name: 'Test Project',
        client_id: 'client_1',
        status: 'active'
      };
      
      // Setup mocks
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Invoices' && id === 'inv_1') {
          return Promise.resolve([{
            ...mockInvoice,
            fromSheetRow: jest.fn().mockReturnValue(mockInvoice)
          }]);
        } else if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClient,
            fromSheetRow: jest.fn().mockReturnValue(mockClient)
          }]);
        } else if (sheetName === 'Projects' && id === 'project_1') {
          return Promise.resolve([{
            ...mockProject,
            fromSheetRow: jest.fn().mockReturnValue(mockProject)
          }]);
        } else if (sheetName === 'E_Invoices') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.create.mockResolvedValue('einv_123');
      mockSheetsService.update.mockResolvedValue(true);
      
      // Mock the simulateEInvoiceAPICall method
      jest.spyOn(eInvoicingService as any, 'simulateEInvoiceAPICall').mockResolvedValue({
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z'
      });
      
      // Mock the generateQRCode method
      jest.spyOn(eInvoicingService as any, 'generateQRCode').mockResolvedValue('base64_qr_code_data');
      
      // Call the method
      const result = await eInvoicingService.generateEInvoice('inv_1');
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.invoice_id).toBe('inv_1');
      expect(result.irn).toBe('123456789012345678901234567890123456');
      expect(result.status).toBe(EInvoiceStatus.GENERATED);
      expect(result.signed_qr_code).toBe('base64_qr_code_data');
      
      // Verify that the e-invoice was saved
      expect(mockSheetsService.create).toHaveBeenCalledWith('E_Invoices', expect.objectContaining({
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        status: EInvoiceStatus.GENERATED
      }));
      
      // Verify that the invoice was updated with e-invoice reference
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_1', expect.objectContaining({
        e_invoice_id: result.id
      }));
    });
    
    it('should return existing e-invoice if already generated', async () => {
      // Mock existing e-invoice
      const mockEInvoice = {
        id: 'einv_123',
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z',
        signed_qr_code: 'base64_qr_code_data',
        signed_invoice: 'base64_encoded_signed_invoice_data',
        status: EInvoiceStatus.GENERATED,
        created_at: '2023-01-15T12:00:00Z',
        updated_at: '2023-01-15T12:00:00Z'
      };
      
      // Setup mocks
      mockSheetsService.query.mockResolvedValue([mockEInvoice]);
      
      // Call the method
      const result = await eInvoicingService.generateEInvoice('inv_1');
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.id).toBe('einv_123');
      expect(result.invoice_id).toBe('inv_1');
      expect(result.irn).toBe('123456789012345678901234567890123456');
      expect(result.status).toBe(EInvoiceStatus.GENERATED);
      
      // Verify that no new e-invoice was created
      expect(mockSheetsService.create).not.toHaveBeenCalled();
    });
    
    it('should throw error if client does not have GSTIN', async () => {
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_1',
        invoice_number: 'INV-001',
        client_id: 'client_1',
        project_id: 'project_1',
        amount: 100000,
        tax_amount: 18000,
        total_amount: 118000,
        status: InvoiceStatus.SENT,
        created_at: new Date('2023-01-15'),
        due_date: new Date('2023-02-15'),
        getTaxRate: jest.fn().mockReturnValue(18),
        e_invoice_id: null
      };
      
      // Mock client data without GSTIN
      const mockClient = {
        id: 'client_1',
        name: 'Test Client',
        email: 'client@example.com',
        gstin: '',
        state: 'Maharashtra'
      };
      
      // Setup mocks
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Invoices' && id === 'inv_1') {
          return Promise.resolve([{
            ...mockInvoice,
            fromSheetRow: jest.fn().mockReturnValue(mockInvoice)
          }]);
        } else if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClient,
            fromSheetRow: jest.fn().mockReturnValue(mockClient)
          }]);
        }
        return Promise.resolve([]);
      });
      
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.create.mockResolvedValue('einv_123');
      
      // Call the method and expect it to throw
      await expect(eInvoicingService.generateEInvoice('inv_1')).rejects.toThrow(
        'Client client_1 does not have a GSTIN, which is required for e-invoicing'
      );
      
      // Verify that a failed e-invoice record was created
      expect(mockSheetsService.create).toHaveBeenCalledWith('E_Invoices', expect.objectContaining({
        invoice_id: 'inv_1',
        status: EInvoiceStatus.FAILED
      }));
    });
  });
  
  describe('getEInvoiceByInvoiceId', () => {
    it('should return e-invoice details for a valid invoice ID', async () => {
      // Mock e-invoice data
      const mockEInvoice = {
        id: 'einv_123',
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z',
        signed_qr_code: 'base64_qr_code_data',
        signed_invoice: 'base64_encoded_signed_invoice_data',
        status: EInvoiceStatus.GENERATED,
        created_at: '2023-01-15T12:00:00Z',
        updated_at: '2023-01-15T12:00:00Z'
      };
      
      // Setup mocks
      mockSheetsService.query.mockResolvedValue([mockEInvoice]);
      
      // Call the method
      const result = await eInvoicingService.getEInvoiceByInvoiceId('inv_1');
      
      // Assertions
      expect(result).toBeDefined();
      expect(result!.id).toBe('einv_123');
      expect(result!.invoice_id).toBe('inv_1');
      expect(result!.irn).toBe('123456789012345678901234567890123456');
      expect(result!.status).toBe(EInvoiceStatus.GENERATED);
    });
    
    it('should return null if no e-invoice exists for the invoice ID', async () => {
      // Setup mocks
      mockSheetsService.query.mockResolvedValue([]);
      
      // Call the method
      const result = await eInvoicingService.getEInvoiceByInvoiceId('inv_1');
      
      // Assertions
      expect(result).toBeNull();
    });
  });
  
  describe('cancelEInvoice', () => {
    it('should cancel an existing e-invoice', async () => {
      // Mock e-invoice data
      const mockEInvoice = {
        id: 'einv_123',
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z',
        signed_qr_code: 'base64_qr_code_data',
        signed_invoice: 'base64_encoded_signed_invoice_data',
        status: EInvoiceStatus.GENERATED,
        created_at: new Date('2023-01-15T12:00:00Z'),
        updated_at: new Date('2023-01-15T12:00:00Z')
      };
      
      // Setup mocks
      jest.spyOn(eInvoicingService, 'getEInvoiceByInvoiceId').mockResolvedValue(mockEInvoice);
      jest.spyOn(eInvoicingService as any, 'simulateEInvoiceCancellationAPICall').mockResolvedValue(undefined);
      mockSheetsService.update.mockResolvedValue(true);
      
      // Call the method
      const result = await eInvoicingService.cancelEInvoice('inv_1', 'Testing cancellation');
      
      // Assertions
      expect(result).toBe(true);
      
      // Verify that the e-invoice was updated
      expect(mockSheetsService.update).toHaveBeenCalledWith('E_Invoices', 'einv_123', expect.objectContaining({
        id: 'einv_123',
        status: EInvoiceStatus.CANCELLED
      }));
    });
    
    it('should throw error if no active e-invoice exists', async () => {
      // Setup mocks
      jest.spyOn(eInvoicingService, 'getEInvoiceByInvoiceId').mockResolvedValue(null);
      
      // Call the method and expect it to throw
      await expect(eInvoicingService.cancelEInvoice('inv_1', 'Testing cancellation')).rejects.toThrow(
        'No active e-invoice found for invoice inv_1'
      );
    });
    
    it('should throw error if e-invoice is not in GENERATED status', async () => {
      // Mock e-invoice data with CANCELLED status
      const mockEInvoice = {
        id: 'einv_123',
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z',
        signed_qr_code: 'base64_qr_code_data',
        signed_invoice: 'base64_encoded_signed_invoice_data',
        status: EInvoiceStatus.CANCELLED,
        created_at: new Date('2023-01-15T12:00:00Z'),
        updated_at: new Date('2023-01-15T12:00:00Z')
      };
      
      // Setup mocks
      jest.spyOn(eInvoicingService, 'getEInvoiceByInvoiceId').mockResolvedValue(mockEInvoice);
      
      // Call the method and expect it to throw
      await expect(eInvoicingService.cancelEInvoice('inv_1', 'Testing cancellation')).rejects.toThrow(
        'No active e-invoice found for invoice inv_1'
      );
    });
  });
  
  describe('generateEInvoicePDF', () => {
    it('should generate PDF for a valid e-invoice', async () => {
      // Mock e-invoice data
      const mockEInvoice = {
        id: 'einv_123',
        invoice_id: 'inv_1',
        irn: '123456789012345678901234567890123456',
        ack_no: '123456789012345',
        ack_date: '2023-01-15T12:00:00Z',
        signed_qr_code: 'base64_qr_code_data',
        signed_invoice: 'base64_encoded_signed_invoice_data',
        status: EInvoiceStatus.GENERATED,
        created_at: new Date('2023-01-15T12:00:00Z'),
        updated_at: new Date('2023-01-15T12:00:00Z')
      };
      
      // Mock invoice data
      const mockInvoice = {
        id: 'inv_1',
        invoice_number: 'INV-001',
        client_id: 'client_1',
        project_id: 'project_1',
        amount: 100000,
        tax_amount: 18000,
        total_amount: 118000,
        status: InvoiceStatus.SENT,
        created_at: new Date('2023-01-15'),
        due_date: new Date('2023-02-15'),
        getTaxRate: jest.fn().mockReturnValue(18),
        e_invoice_id: 'einv_123'
      };
      
      // Mock client data
      const mockClient = {
        id: 'client_1',
        name: 'Test Client',
        email: 'client@example.com',
        gstin: '27AAAAA0000A1Z5',
        state: 'Maharashtra'
      };
      
      // Mock project data
      const mockProject = {
        id: 'project_1',
        name: 'Test Project',
        client_id: 'client_1',
        status: 'active'
      };
      
      // Setup mocks
      jest.spyOn(eInvoicingService, 'getEInvoiceByInvoiceId').mockResolvedValue(mockEInvoice);
      
      mockSheetsService.read.mockImplementation((sheetName, id) => {
        if (sheetName === 'Invoices' && id === 'inv_1') {
          return Promise.resolve([{
            ...mockInvoice,
            fromSheetRow: jest.fn().mockReturnValue(mockInvoice)
          }]);
        } else if (sheetName === 'Clients' && id === 'client_1') {
          return Promise.resolve([{
            ...mockClient,
            fromSheetRow: jest.fn().mockReturnValue(mockClient)
          }]);
        } else if (sheetName === 'Projects' && id === 'project_1') {
          return Promise.resolve([{
            ...mockProject,
            fromSheetRow: jest.fn().mockReturnValue(mockProject)
          }]);
        }
        return Promise.resolve([]);
      });
      
      // Mock the generateGSTInvoicePDF function
      jest.mock('../invoicePDF', () => ({
        generateGSTInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('mock_pdf_data'))
      }));
      
      // Call the method
      const result = await eInvoicingService.generateEInvoicePDF('inv_1');
      
      // Assertions
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
    
    it('should throw error if no active e-invoice exists', async () => {
      // Setup mocks
      jest.spyOn(eInvoicingService, 'getEInvoiceByInvoiceId').mockResolvedValue(null);
      
      // Call the method and expect it to throw
      await expect(eInvoicingService.generateEInvoicePDF('inv_1')).rejects.toThrow(
        'No active e-invoice found for invoice inv_1'
      );
    });
  });
});