import request from 'supertest';
import express from 'express';
import { createGoogleSheetsService } from '../../services/googleSheets';
import { createFinancialReportingService, ReportType, ReportFormat } from '../../services/financialReporting';
import financialReportingRoutes from '../financialReporting';
import { authMiddleware } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../services/financialReporting');
jest.mock('../../middleware/auth');

describe('Financial Reporting Routes', () => {
  let app: express.Application;
  let mockFinancialReportingService: any;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through
    (authMiddleware as jest.Mock).mockImplementation((req, res, next) => next());
    
    // Create mock services
    const mockSheetsService = {};
    mockFinancialReportingService = {
      calculateDashboardMetrics: jest.fn(),
      generateReport: jest.fn(),
      exportReport: jest.fn()
    };
    
    // Mock service creation functions
    (createGoogleSheetsService as jest.Mock).mockReturnValue(mockSheetsService);
    (createFinancialReportingService as jest.Mock).mockReturnValue(mockFinancialReportingService);
    
    // Setup default mock responses
    mockFinancialReportingService.calculateDashboardMetrics.mockResolvedValue({
      totalRevenue: 10000,
      totalExpenses: 5000,
      netProfit: 5000,
      profitMargin: 50,
      outstandingInvoices: 2000,
      overdueInvoices: 1000
    });
    
    mockFinancialReportingService.generateReport.mockImplementation((reportType) => {
      switch (reportType) {
        case ReportType.PROFIT_LOSS:
          return Promise.resolve({
            revenue: 10000,
            expenses: 5000,
            profit: 5000,
            profitMargin: 50
          });
        case ReportType.EXPENSE_SUMMARY:
          return Promise.resolve([
            { category: 'equipment', amount: 2000, percentage: 40 },
            { category: 'software', amount: 1500, percentage: 30 },
            { category: 'travel', amount: 1000, percentage: 20 },
            { category: 'office', amount: 500, percentage: 10 }
          ]);
        case ReportType.PROJECT_PROFITABILITY:
          return Promise.resolve([
            { projectId: 'proj_1', projectName: 'Project 1', revenue: 5000, expenses: 2000, profit: 3000, profitMargin: 60, status: 'active' },
            { projectId: 'proj_2', projectName: 'Project 2', revenue: 3000, expenses: 1500, profit: 1500, profitMargin: 50, status: 'active' },
            { projectId: 'proj_3', projectName: 'Project 3', revenue: 2000, expenses: 1500, profit: 500, profitMargin: 25, status: 'completed' }
          ]);
        case ReportType.TIME_UTILIZATION:
          return Promise.resolve([
            { projectId: 'proj_1', projectName: 'Project 1', totalHours: 100, billableHours: 90, billablePercentage: 90, revenue: 5000, revenuePerHour: 55.56 },
            { projectId: 'proj_2', projectName: 'Project 2', totalHours: 80, billableHours: 70, billablePercentage: 87.5, revenue: 3000, revenuePerHour: 42.86 }
          ]);
        case ReportType.REVENUE_SUMMARY:
          return Promise.resolve({
            paid: { count: 10, amount: 10000 },
            pending: { count: 5, amount: 2000 },
            overdue: { count: 2, amount: 1000 },
            draft: { count: 3, amount: 1500 },
            total: { count: 20, amount: 14500 }
          });
        default:
          return Promise.resolve({});
      }
    });
    
    mockFinancialReportingService.exportReport.mockImplementation((data, format) => {
      switch (format) {
        case ReportFormat.CSV:
          return Promise.resolve('header1,header2\nvalue1,value2');
        case ReportFormat.PDF:
          return Promise.resolve(Buffer.from('PDF content'));
        case ReportFormat.EXCEL:
          return Promise.resolve(Buffer.from('Excel content'));
        default:
          return Promise.resolve(JSON.stringify(data));
      }
    });
    
    // Create express app and mount routes
    app = express();
    app.use(express.json());
    app.use('/api/financial', financialReportingRoutes);
  });
  
  describe('GET /api/financial/dashboard', () => {
    it('should return dashboard metrics', async () => {
      const response = await request(app).get('/api/financial/dashboard');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        totalRevenue: 10000,
        totalExpenses: 5000,
        netProfit: 5000,
        profitMargin: 50,
        outstandingInvoices: 2000,
        overdueInvoices: 1000
      });
      expect(mockFinancialReportingService.calculateDashboardMetrics).toHaveBeenCalled();
    });
    
    it('should apply filters from query parameters', async () => {
      await request(app).get('/api/financial/dashboard?startDate=2025-01-01&endDate=2025-12-31&projectId=proj_1');
      
      expect(mockFinancialReportingService.calculateDashboardMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          projectId: 'proj_1'
        })
      );
    });
    
    it('should handle errors', async () => {
      mockFinancialReportingService.calculateDashboardMetrics.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/financial/dashboard');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('GET /api/financial/profit-loss', () => {
    it('should return profit/loss report in JSON format', async () => {
      const response = await request(app).get('/api/financial/profit-loss');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        revenue: 10000,
        expenses: 5000,
        profit: 5000,
        profitMargin: 50
      });
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.PROFIT_LOSS,
        expect.any(Object)
      );
    });
    
    it('should return profit/loss report in CSV format', async () => {
      const response = await request(app).get('/api/financial/profit-loss?format=csv');
      
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('text/csv');
      expect(response.header['content-disposition']).toContain('attachment; filename=profit-loss-report.csv');
      expect(response.text).toBe('header1,header2\nvalue1,value2');
      expect(mockFinancialReportingService.exportReport).toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      mockFinancialReportingService.generateReport.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/financial/profit-loss');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('GET /api/financial/expenses', () => {
    it('should return expense summary report', async () => {
      const response = await request(app).get('/api/financial/expenses');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.EXPENSE_SUMMARY,
        expect.any(Object)
      );
    });
    
    it('should apply category filters', async () => {
      await request(app).get('/api/financial/expenses?categories=equipment,software');
      
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.EXPENSE_SUMMARY,
        expect.objectContaining({
          expenseCategories: ['equipment', 'software']
        })
      );
    });
  });
  
  describe('GET /api/financial/projects', () => {
    it('should return project profitability report', async () => {
      const response = await request(app).get('/api/financial/projects');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.PROJECT_PROFITABILITY,
        expect.any(Object)
      );
    });
  });
  
  describe('GET /api/financial/time', () => {
    it('should return time utilization report', async () => {
      const response = await request(app).get('/api/financial/time');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.TIME_UTILIZATION,
        expect.any(Object)
      );
    });
  });
  
  describe('GET /api/financial/revenue', () => {
    it('should return revenue summary report', async () => {
      const response = await request(app).get('/api/financial/revenue');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('paid');
      expect(response.body.data).toHaveProperty('pending');
      expect(response.body.data).toHaveProperty('overdue');
      expect(response.body.data).toHaveProperty('draft');
      expect(response.body.data).toHaveProperty('total');
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.REVENUE_SUMMARY,
        expect.any(Object)
      );
    });
    
    it('should apply invoice status filters', async () => {
      await request(app).get('/api/financial/revenue?statuses=paid,overdue');
      
      expect(mockFinancialReportingService.generateReport).toHaveBeenCalledWith(
        ReportType.REVENUE_SUMMARY,
        expect.objectContaining({
          invoiceStatus: ['paid', 'overdue']
        })
      );
    });
  });
});