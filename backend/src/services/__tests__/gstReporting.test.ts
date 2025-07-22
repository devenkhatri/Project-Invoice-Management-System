import { GSTReportingService, GSTReportType } from '../gstReporting';
import { FinancialReportingService, ReportFormat } from '../financialReporting';
import { GoogleSheetsService } from '../googleSheets';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { Client } from '../../models/Client';

// Mock dependencies
jest.mock('../googleSheets');
jest.mock('../financialReporting');

describe('GSTReportingService', () => {
  let gstReportingService: GSTReportingService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockFinancialReportingService: jest.Mocked<FinancialReportingService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    mockFinancialReportingService = new FinancialReportingService(mockSheetsService) as jest.Mocked<FinancialReportingService>;
    
    // Create service instance with mocks
    gstReportingService = new GSTReportingService(mockSheetsService, mockFinancialReportingService);
  });
  
  describe('generateGSTR1Report', () => {
    it('should generate GSTR1 report with B2B invoices', async () => {
      // Mock invoice data
      const mockInvoices = [
        {
          id: 'inv_1',
          invoice_number: 'INV-001',
          client_id: 'client_1',
          amount: 10000,
          tax_amount: 1800,
          total_amount: 11800,
          status: InvoiceStatus.PAID,
          created_at: new Date('2023-01-15'),
          due_date: new Date('2023-02-15'),
          getTaxRate: jest.fn().mockReturnValue(18)
        },
        {
          id: 'inv_2',
          invoice_number: 'INV-002',
          client_id: 'client_2',
          amount: 20000,
          tax_amount: 3600,
          total_amount: 23600,
          status: InvoiceStatus.PAID,
          created_at: new Date('2023-01-20'),
          due_date: new Date('2023-02-20'),
          getTaxRate: jest.fn().mockReturnValue(18)
        }
      ];
      
      // Mock client data
      const mockClients = [
        {
          id: 'client_1',
          name: 'Test Client 1',
          email: 'client1@example.com',
          gstin: '27AAAAA0000A1Z5',
          state: 'Maharashtra'
        },
        {
          id: 'client_2',
          name: 'Test Client 2',
          email: 'client2@example.com',
          gstin: '29BBBBB0000B1Z3',
          state: 'Karnataka'
        }
      ];
      
      // Setup mocks
      mockSheetsService.read.mockImplementation((sheetName) => {
        if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices.map(inv => ({
            ...inv,
            fromSheetRow: jest.fn().mockReturnValue(inv)
          })));
        } else if (sheetName === 'Clients') {
          return Promise.resolve(mockClients.map(client => ({
            ...client,
            fromSheetRow: jest.fn().mockReturnValue(client)
          })));
        }
        return Promise.resolve([]);
      });
      
      // Call the method
      const filters = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };
      
      const result = await gstReportingService.generateGSTR1Report(filters);
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.b2b).toHaveLength(2);
      expect(result.b2b[0].gstin).toBe('27AAAAA0000A1Z5');
      expect(result.b2b[0].invoiceNumber).toBe('INV-001');
      expect(result.b2b[0].taxableValue).toBe(10000);
      expect(result.b2b[1].gstin).toBe('29BBBBB0000B1Z3');
      expect(result.b2b[1].invoiceNumber).toBe('INV-002');
      expect(result.b2b[1].taxableValue).toBe(20000);
      
      // First client is in same state (intra-state), so CGST+SGST
      expect(result.b2b[0].cgstAmount).toBeDefined();
      expect(result.b2b[0].sgstAmount).toBeDefined();
      expect(result.b2b[0].igstAmount).toBeUndefined();
      
      // Second client is in different state (inter-state), so IGST
      expect(result.b2b[1].igstAmount).toBeDefined();
      expect(result.b2b[1].cgstAmount).toBeUndefined();
      expect(result.b2b[1].sgstAmount).toBeUndefined();
      
      // HSN summary should be generated
      expect(result.hsn).toHaveLength(1);
      expect(result.hsn[0].hsnCode).toBe('998314');
      expect(result.hsn[0].taxableValue).toBe(30000);
    });
    
    it('should generate GSTR1 report with B2C invoices', async () => {
      // Mock invoice data
      const mockInvoices = [
        {
          id: 'inv_3',
          invoice_number: 'INV-003',
          client_id: 'client_3',
          amount: 5000,
          tax_amount: 900,
          total_amount: 5900,
          status: InvoiceStatus.PAID,
          created_at: new Date('2023-01-25'),
          due_date: new Date('2023-02-25'),
          getTaxRate: jest.fn().mockReturnValue(18)
        },
        {
          id: 'inv_4',
          invoice_number: 'INV-004',
          client_id: 'client_4',
          amount: 300000,
          tax_amount: 54000,
          total_amount: 354000,
          status: InvoiceStatus.PAID,
          created_at: new Date('2023-01-28'),
          due_date: new Date('2023-02-28'),
          getTaxRate: jest.fn().mockReturnValue(18)
        }
      ];
      
      // Mock client data (without GSTIN for B2C)
      const mockClients = [
        {
          id: 'client_3',
          name: 'Test Client 3',
          email: 'client3@example.com',
          gstin: '',
          state: 'Maharashtra'
        },
        {
          id: 'client_4',
          name: 'Test Client 4',
          email: 'client4@example.com',
          gstin: '',
          state: 'Karnataka'
        }
      ];
      
      // Setup mocks
      mockSheetsService.read.mockImplementation((sheetName) => {
        if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices.map(inv => ({
            ...inv,
            fromSheetRow: jest.fn().mockReturnValue(inv)
          })));
        } else if (sheetName === 'Clients') {
          return Promise.resolve(mockClients.map(client => ({
            ...client,
            fromSheetRow: jest.fn().mockReturnValue(client)
          })));
        }
        return Promise.resolve([]);
      });
      
      // Call the method
      const filters = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };
      
      const result = await gstReportingService.generateGSTR1Report(filters);
      
      // Assertions
      expect(result).toBeDefined();
      
      // Small B2C invoice should be in b2cs (aggregated)
      expect(result.b2cs).toHaveLength(2);
      
      // Large B2C invoice (>= 2.5 lakhs) should be in b2c (individual)
      expect(result.b2c).toHaveLength(1);
      expect(result.b2c[0].invoiceNumber).toBe('INV-004');
      expect(result.b2c[0].taxableValue).toBe(300000);
      
      // HSN summary should be generated
      expect(result.hsn).toHaveLength(1);
      expect(result.hsn[0].hsnCode).toBe('998314');
      expect(result.hsn[0].taxableValue).toBe(305000);
    });
  });
  
  describe('generateGSTR3BReport', () => {
    it('should generate GSTR3B report based on GSTR1 data', async () => {
      // Mock GSTR1 data
      const mockGSTR1Data = {
        b2b: [
          {
            gstin: '27AAAAA0000A1Z5',
            receiverName: 'Test Client 1',
            invoiceNumber: 'INV-001',
            invoiceDate: '2023-01-15',
            invoiceValue: 11800,
            placeOfSupply: 'Maharashtra',
            reverseCharge: 'N',
            applicableRate: 18,
            taxableValue: 10000,
            cgstAmount: 900,
            sgstAmount: 900
          },
          {
            gstin: '29BBBBB0000B1Z3',
            receiverName: 'Test Client 2',
            invoiceNumber: 'INV-002',
            invoiceDate: '2023-01-20',
            invoiceValue: 23600,
            placeOfSupply: 'Karnataka',
            reverseCharge: 'N',
            applicableRate: 18,
            taxableValue: 20000,
            igstAmount: 3600
          }
        ],
        b2c: [],
        b2cs: [],
        hsn: []
      };
      
      // Mock generateGSTR1Report method
      jest.spyOn(gstReportingService, 'generateGSTR1Report').mockResolvedValue(mockGSTR1Data);
      
      // Call the method
      const filters = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31')
      };
      
      const result = await gstReportingService.generateGSTR3BReport(filters);
      
      // Assertions
      expect(result).toBeDefined();
      expect(result.gstin).toBeDefined();
      expect(result.period).toEqual({
        month: filters.startDate.getMonth() + 1,
        year: filters.startDate.getFullYear()
      });
      
      // Check outward supplies
      expect(result.outwardSupplies).toBeDefined();
      expect(result.outwardSupplies.taxableValue).toBe(30000);
      expect(result.outwardSupplies.igstAmount).toBe(3600);
      expect(result.outwardSupplies.cgstAmount).toBe(900);
      expect(result.outwardSupplies.sgstAmount).toBe(900);
      
      // Check tax payable
      expect(result.taxPayable).toBeDefined();
      expect(result.taxPayable.igstAmount).toBe(3600);
      expect(result.taxPayable.cgstAmount).toBe(900);
      expect(result.taxPayable.sgstAmount).toBe(900);
    });
  });
  
  describe('exportGSTReport', () => {
    it('should export GSTR1 report as JSON', async () => {
      // Mock data
      const mockGSTR1Data = {
        b2b: [
          {
            gstin: '27AAAAA0000A1Z5',
            receiverName: 'Test Client 1',
            invoiceNumber: 'INV-001',
            invoiceDate: '2023-01-15',
            invoiceValue: 11800,
            placeOfSupply: 'Maharashtra',
            reverseCharge: 'N',
            applicableRate: 18,
            taxableValue: 10000,
            cgstAmount: 900,
            sgstAmount: 900
          }
        ],
        b2c: [],
        b2cs: [],
        hsn: []
      };
      
      // Call the method
      const result = await gstReportingService.exportGSTReport(
        GSTReportType.GSTR1,
        mockGSTR1Data,
        ReportFormat.JSON
      );
      
      // Assertions
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult).toEqual(mockGSTR1Data);
    });
    
    it('should export GSTR1 report as CSV', async () => {
      // Mock data
      const mockGSTR1Data = {
        b2b: [
          {
            gstin: '27AAAAA0000A1Z5',
            receiverName: 'Test Client 1',
            invoiceNumber: 'INV-001',
            invoiceDate: '2023-01-15',
            invoiceValue: 11800,
            placeOfSupply: 'Maharashtra',
            reverseCharge: 'N',
            applicableRate: 18,
            taxableValue: 10000,
            cgstAmount: 900,
            sgstAmount: 900
          }
        ],
        b2c: [],
        b2cs: [],
        hsn: []
      };
      
      // Call the method
      const result = await gstReportingService.exportGSTReport(
        GSTReportType.GSTR1,
        mockGSTR1Data,
        ReportFormat.CSV
      );
      
      // Assertions
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result as string).toContain('B2B Invoices');
      expect(result as string).toContain('GSTIN,Receiver Name,Invoice Number');
      expect(result as string).toContain('27AAAAA0000A1Z5,Test Client 1,INV-001');
    });
  });
});