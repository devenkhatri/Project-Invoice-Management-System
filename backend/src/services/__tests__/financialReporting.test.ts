import { FinancialReportingService, ReportType, ReportPeriod } from '../financialReporting';
import { GoogleSheetsService } from '../googleSheets';
import { Expense, ExpenseCategory } from '../../models/Expense';
import { Invoice, InvoiceStatus } from '../../models/Invoice';
import { TimeEntry } from '../../models/TimeEntry';
import { Project, ProjectStatus } from '../../models/Project';

// Mock GoogleSheetsService
jest.mock('../googleSheets');

describe('FinancialReportingService', () => {
  let financialReportingService: FinancialReportingService;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  
  // Mock data
  const mockExpenses = [
    {
      id: 'exp_1',
      project_id: 'proj_1',
      category: ExpenseCategory.EQUIPMENT,
      amount: 500,
      description: 'New laptop',
      date: '2025-06-15T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt1.pdf',
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2025-06-15T10:00:00.000Z'
    },
    {
      id: 'exp_2',
      project_id: 'proj_1',
      category: ExpenseCategory.SOFTWARE,
      amount: 100,
      description: 'Software license',
      date: '2025-06-16T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt2.pdf',
      created_at: '2025-06-16T10:00:00.000Z',
      updated_at: '2025-06-16T10:00:00.000Z'
    },
    {
      id: 'exp_3',
      project_id: 'proj_2',
      category: ExpenseCategory.TRAVEL,
      amount: 200,
      description: 'Client meeting travel',
      date: '2025-06-17T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt3.pdf',
      created_at: '2025-06-17T10:00:00.000Z',
      updated_at: '2025-06-17T10:00:00.000Z'
    }
  ];
  
  const mockInvoices = [
    {
      id: 'inv_1',
      invoice_number: 'INV-202506-123456',
      client_id: 'client_1',
      project_id: 'proj_1',
      amount: 1000,
      tax_amount: 180,
      total_amount: 1180,
      status: InvoiceStatus.PAID,
      due_date: '2025-06-30T00:00:00.000Z',
      currency: 'INR',
      tax_rate: 18,
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2025-06-15T10:00:00.000Z'
    },
    {
      id: 'inv_2',
      invoice_number: 'INV-202506-234567',
      client_id: 'client_1',
      project_id: 'proj_2',
      amount: 2000,
      tax_amount: 360,
      total_amount: 2360,
      status: InvoiceStatus.SENT,
      due_date: '2025-07-15T00:00:00.000Z',
      currency: 'INR',
      tax_rate: 18,
      created_at: '2025-06-16T10:00:00.000Z',
      updated_at: '2025-06-16T10:00:00.000Z'
    },
    {
      id: 'inv_3',
      invoice_number: 'INV-202506-345678',
      client_id: 'client_2',
      project_id: 'proj_3',
      amount: 3000,
      tax_amount: 540,
      total_amount: 3540,
      status: InvoiceStatus.OVERDUE,
      due_date: '2025-06-10T00:00:00.000Z',
      currency: 'INR',
      tax_rate: 18,
      created_at: '2025-05-25T10:00:00.000Z',
      updated_at: '2025-06-11T10:00:00.000Z'
    }
  ];
  
  const mockTimeEntries = [
    {
      id: 'time_1',
      task_id: 'task_1',
      project_id: 'proj_1',
      hours: 5,
      description: 'Development work',
      date: '2025-06-15T00:00:00.000Z',
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2025-06-15T10:00:00.000Z'
    },
    {
      id: 'time_2',
      task_id: 'task_2',
      project_id: 'proj_1',
      hours: 3,
      description: 'Design work',
      date: '2025-06-16T00:00:00.000Z',
      created_at: '2025-06-16T10:00:00.000Z',
      updated_at: '2025-06-16T10:00:00.000Z'
    },
    {
      id: 'time_3',
      task_id: 'task_3',
      project_id: 'proj_2',
      hours: 4,
      description: 'Client meeting',
      date: '2025-06-17T00:00:00.000Z',
      created_at: '2025-06-17T10:00:00.000Z',
      updated_at: '2025-06-17T10:00:00.000Z'
    }
  ];
  
  const mockProjects = [
    {
      id: 'proj_1',
      name: 'Website Development',
      client_id: 'client_1',
      status: ProjectStatus.ACTIVE,
      start_date: '2025-06-01T00:00:00.000Z',
      end_date: '2025-07-31T00:00:00.000Z',
      budget: 5000,
      description: 'Website development project',
      created_at: '2025-06-01T10:00:00.000Z',
      updated_at: '2025-06-01T10:00:00.000Z'
    },
    {
      id: 'proj_2',
      name: 'Mobile App',
      client_id: 'client_1',
      status: ProjectStatus.ACTIVE,
      start_date: '2025-06-15T00:00:00.000Z',
      end_date: '2025-08-15T00:00:00.000Z',
      budget: 8000,
      description: 'Mobile app development',
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2025-06-15T10:00:00.000Z'
    },
    {
      id: 'proj_3',
      name: 'Logo Design',
      client_id: 'client_2',
      status: ProjectStatus.COMPLETED,
      start_date: '2025-05-15T00:00:00.000Z',
      end_date: '2025-06-05T00:00:00.000Z',
      budget: 1500,
      description: 'Logo design project',
      created_at: '2025-05-15T10:00:00.000Z',
      updated_at: '2025-06-05T10:00:00.000Z'
    }
  ];
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock GoogleSheetsService
    mockSheetsService = {
      read: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      query: jest.fn(),
      aggregate: jest.fn(),
      testConnection: jest.fn(),
      getSpreadsheetInfo: jest.fn(),
      createSheet: jest.fn(),
      readSheet: jest.fn(),
      appendToSheet: jest.fn(),
      initializeProjectSheets: jest.fn()
    } as unknown as jest.Mocked<GoogleSheetsService>;
    
    // Initialize service with mock
    financialReportingService = new FinancialReportingService(mockSheetsService);
    
    // Setup default mock responses
    mockSheetsService.read.mockImplementation((sheetName: string) => {
      switch (sheetName) {
        case 'Expenses':
          return Promise.resolve(mockExpenses);
        case 'Invoices':
          return Promise.resolve(mockInvoices);
        case 'Time_Entries':
          return Promise.resolve(mockTimeEntries);
        case 'Projects':
          return Promise.resolve(mockProjects);
        default:
          return Promise.resolve([]);
      }
    });
  });
  
  describe('calculateProfitLoss', () => {
    it('should calculate profit/loss correctly', async () => {
      const result = await financialReportingService.calculateProfitLoss();
      
      expect(result).toEqual({
        revenue: 1180, // Only the PAID invoice
        expenses: 800, // Sum of all expenses
        profit: 380, // Revenue - Expenses
        profitMargin: (380 / 1180) * 100 // (Profit / Revenue) * 100
      });
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses');
    });
    
    it('should apply filters correctly', async () => {
      const filters = {
        projectId: 'proj_1',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-30')
      };
      
      const result = await financialReportingService.calculateProfitLoss(filters);
      
      expect(result).toEqual({
        revenue: 1180, // Only the PAID invoice for proj_1
        expenses: 600, // Sum of expenses for proj_1
        profit: 580, // Revenue - Expenses
        profitMargin: (580 / 1180) * 100 // (Profit / Revenue) * 100
      });
    });
  });
  
  describe('calculateExpenseSummary', () => {
    it('should calculate expense summary by category', async () => {
      const result = await financialReportingService.calculateExpenseSummary();
      
      // Sort by amount descending to match the expected output
      const sortedResult = result.sort((a, b) => b.amount - a.amount);
      
      expect(sortedResult).toEqual([
        {
          category: ExpenseCategory.EQUIPMENT,
          amount: 500,
          percentage: (500 / 800) * 100
        },
        {
          category: ExpenseCategory.TRAVEL,
          amount: 200,
          percentage: (200 / 800) * 100
        },
        {
          category: ExpenseCategory.SOFTWARE,
          amount: 100,
          percentage: (100 / 800) * 100
        },
        {
          category: ExpenseCategory.MARKETING,
          amount: 0,
          percentage: 0
        },
        {
          category: ExpenseCategory.OFFICE,
          amount: 0,
          percentage: 0
        },
        {
          category: ExpenseCategory.OTHER,
          amount: 0,
          percentage: 0
        }
      ]);
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses');
    });
  });
  
  describe('calculateProjectProfitability', () => {
    it('should calculate project profitability correctly', async () => {
      const result = await financialReportingService.calculateProjectProfitability();
      
      // Sort by profit margin descending to match the expected output
      const sortedResult = result.sort((a, b) => b.profitMargin - a.profitMargin);
      
      expect(sortedResult).toEqual([
        {
          projectId: 'proj_3',
          projectName: 'Logo Design',
          revenue: 0, // No PAID invoices for proj_3
          expenses: 0, // No expenses for proj_3
          profit: 0,
          profitMargin: 0,
          status: ProjectStatus.COMPLETED
        },
        {
          projectId: 'proj_2',
          projectName: 'Mobile App',
          revenue: 0, // No PAID invoices for proj_2
          expenses: 200, // Expenses for proj_2
          profit: -200,
          profitMargin: 0,
          status: ProjectStatus.ACTIVE
        },
        {
          projectId: 'proj_1',
          projectName: 'Website Development',
          revenue: 1180, // PAID invoice for proj_1
          expenses: 600, // Expenses for proj_1
          profit: 580,
          profitMargin: (580 / 1180) * 100,
          status: ProjectStatus.ACTIVE
        }
      ]);
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('Projects');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses');
    });
  });
  
  describe('calculateTimeUtilization', () => {
    it('should calculate time utilization metrics correctly', async () => {
      const result = await financialReportingService.calculateTimeUtilization();
      
      // Sort by revenue per hour descending to match the expected output
      const sortedResult = result.sort((a, b) => b.revenuePerHour - a.revenuePerHour);
      
      expect(sortedResult).toEqual([
        {
          projectId: 'proj_1',
          projectName: 'Website Development',
          totalHours: 8, // Sum of hours for proj_1
          billableHours: 8, // Assuming all hours are billable
          billablePercentage: 100,
          revenue: 1180, // PAID invoice for proj_1
          revenuePerHour: 1180 / 8
        },
        {
          projectId: 'proj_2',
          projectName: 'Mobile App',
          totalHours: 4, // Hours for proj_2
          billableHours: 4, // Assuming all hours are billable
          billablePercentage: 100,
          revenue: 0, // No PAID invoices for proj_2
          revenuePerHour: 0
        },
        {
          projectId: 'proj_3',
          projectName: 'Logo Design',
          totalHours: 0, // No time entries for proj_3
          billableHours: 0,
          billablePercentage: 0,
          revenue: 0, // No PAID invoices for proj_3
          revenuePerHour: 0
        }
      ]);
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('Projects');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Time_Entries');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices');
    });
  });
  
  describe('calculateDashboardMetrics', () => {
    it('should calculate dashboard metrics correctly', async () => {
      const result = await financialReportingService.calculateDashboardMetrics();
      
      expect(result).toEqual({
        totalRevenue: 1180, // Sum of PAID invoices
        totalExpenses: 800, // Sum of all expenses
        netProfit: 380, // Revenue - Expenses
        profitMargin: (380 / 1180) * 100, // (Profit / Revenue) * 100
        outstandingInvoices: 2360, // Sum of SENT invoices
        overdueInvoices: 3540 // Sum of OVERDUE invoices
      });
      
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses');
    });
  });
  
  describe('generateReport', () => {
    it('should generate profit/loss report', async () => {
      const result = await financialReportingService.generateReport(ReportType.PROFIT_LOSS);
      
      expect(result).toEqual({
        revenue: 1180,
        expenses: 800,
        profit: 380,
        profitMargin: (380 / 1180) * 100
      });
    });
    
    it('should generate expense summary report', async () => {
      const result = await financialReportingService.generateReport(ReportType.EXPENSE_SUMMARY);
      
      expect(result.length).toBe(6); // All expense categories
      expect(result[0].category).toBe(ExpenseCategory.EQUIPMENT); // Highest amount
    });
    
    it('should generate project profitability report', async () => {
      const result = await financialReportingService.generateReport(ReportType.PROJECT_PROFITABILITY);
      
      expect(result.length).toBe(3); // All projects
    });
    
    it('should generate time utilization report', async () => {
      const result = await financialReportingService.generateReport(ReportType.TIME_UTILIZATION);
      
      expect(result.length).toBe(3); // All projects
    });
    
    it('should generate revenue summary report', async () => {
      const result = await financialReportingService.generateReport(ReportType.REVENUE_SUMMARY);
      
      expect(result).toEqual({
        paid: {
          count: 1,
          amount: 1180
        },
        pending: {
          count: 1,
          amount: 2360
        },
        overdue: {
          count: 1,
          amount: 3540
        },
        draft: {
          count: 0,
          amount: 0
        },
        total: {
          count: 3,
          amount: 7080
        }
      });
    });
    
    it('should throw error for unsupported report type', async () => {
      await expect(financialReportingService.generateReport('invalid_type' as ReportType))
        .rejects.toThrow('Unsupported report type: invalid_type');
    });
  });
  
  describe('exportReport', () => {
    it('should export report as JSON', async () => {
      const data = { test: 'data' };
      const result = await financialReportingService.exportReport(data, ReportFormat.JSON);
      
      expect(result).toBe(JSON.stringify(data, null, 2));
    });
    
    it('should export report as CSV', async () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      const result = await financialReportingService.exportReport(data, ReportFormat.CSV);
      
      expect(result).toBe('name,age\nJohn,30\nJane,25');
    });
    
    it('should handle CSV export for single object', async () => {
      const data = { name: 'John', age: 30 };
      const result = await financialReportingService.exportReport(data, ReportFormat.CSV);
      
      expect(result).toBe('name,John\nage,30');
    });
  });
});