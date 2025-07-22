import express, { Request, Response } from 'express';
import { createGoogleSheetsService } from '../services/googleSheets';
import { 
  createFinancialReportingService, 
  ReportType, 
  ReportPeriod, 
  ReportFormat,
  ReportFilters
} from '../services/financialReporting';
import { ExpenseCategory } from '../models/Expense';
import { InvoiceStatus } from '../models/types';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';
import { z } from 'zod';

const router = express.Router();

// Initialize services
const sheetsService = createGoogleSheetsService();
if (!sheetsService) {
  throw new Error('Failed to initialize Google Sheets service');
}
const financialReportingService = createFinancialReportingService(sheetsService);

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.nativeEnum(ReportPeriod).optional(),
  projectId: z.string().optional(),
  clientId: z.string().optional()
});

const reportRequestSchema = dateRangeSchema.extend({
  format: z.nativeEnum(ReportFormat).optional().default(ReportFormat.JSON)
});

const expenseFilterSchema = dateRangeSchema.extend({
  categories: z.array(z.nativeEnum(ExpenseCategory)).optional()
});

const invoiceFilterSchema = dateRangeSchema.extend({
  statuses: z.array(z.nativeEnum(InvoiceStatus)).optional()
});

/**
 * Parse filters from request
 */
function parseFilters(req: Request): ReportFilters {
  const filters: ReportFilters = {};
  
  if (req.query.startDate) {
    filters.startDate = new Date(req.query.startDate as string);
  }
  
  if (req.query.endDate) {
    filters.endDate = new Date(req.query.endDate as string);
  }
  
  if (req.query.period) {
    filters.period = req.query.period as ReportPeriod;
  }
  
  if (req.query.projectId) {
    filters.projectId = req.query.projectId as string;
  }
  
  if (req.query.clientId) {
    filters.clientId = req.query.clientId as string;
  }
  
  if (req.query.categories) {
    const categories = Array.isArray(req.query.categories) 
      ? req.query.categories as string[] 
      : [req.query.categories as string];
    
    filters.expenseCategories = categories as ExpenseCategory[];
  }
  
  if (req.query.statuses) {
    const statuses = Array.isArray(req.query.statuses) 
      ? req.query.statuses as string[] 
      : [req.query.statuses as string];
    
    filters.invoiceStatus = statuses as InvoiceStatus[];
  }
  
  return filters;
}

/**
 * @route GET /api/financial/dashboard
 * @desc Get dashboard financial metrics
 * @access Private
 */
router.get(
  '/dashboard',
  authMiddleware,
  validationMiddleware(dateRangeSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const metrics = await financialReportingService.calculateDashboardMetrics(filters);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      console.error('Error fetching dashboard metrics:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard metrics'
      });
    }
  }
);

/**
 * @route GET /api/financial/profit-loss
 * @desc Get profit/loss report
 * @access Private
 */
router.get(
  '/profit-loss',
  authMiddleware,
  validationMiddleware(reportRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const format = (req.query.format || ReportFormat.JSON) as ReportFormat;
      
      const report = await financialReportingService.generateReport(ReportType.PROFIT_LOSS, filters);
      
      if (format === ReportFormat.JSON) {
        return res.json({
          success: true,
          data: report
        });
      }
      
      const exportedReport = await financialReportingService.exportReport(report, format);
      
      // Set appropriate headers based on format
      switch (format) {
        case ReportFormat.CSV:
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=profit-loss-report.csv');
          break;
        case ReportFormat.PDF:
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=profit-loss-report.pdf');
          break;
        case ReportFormat.EXCEL:
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=profit-loss-report.xlsx');
          break;
      }
      
      res.send(exportedReport);
    } catch (error: any) {
      console.error('Error generating profit/loss report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate profit/loss report'
      });
    }
  }
);

/**
 * @route GET /api/financial/expenses
 * @desc Get expense summary report
 * @access Private
 */
router.get(
  '/expenses',
  authMiddleware,
  validationMiddleware(expenseFilterSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const format = (req.query.format || ReportFormat.JSON) as ReportFormat;
      
      const report = await financialReportingService.generateReport(ReportType.EXPENSE_SUMMARY, filters);
      
      if (format === ReportFormat.JSON) {
        return res.json({
          success: true,
          data: report
        });
      }
      
      const exportedReport = await financialReportingService.exportReport(report, format);
      
      // Set appropriate headers based on format
      switch (format) {
        case ReportFormat.CSV:
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=expense-summary.csv');
          break;
        case ReportFormat.PDF:
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=expense-summary.pdf');
          break;
        case ReportFormat.EXCEL:
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=expense-summary.xlsx');
          break;
      }
      
      res.send(exportedReport);
    } catch (error: any) {
      console.error('Error generating expense summary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate expense summary'
      });
    }
  }
);

/**
 * @route GET /api/financial/projects
 * @desc Get project profitability report
 * @access Private
 */
router.get(
  '/projects',
  authMiddleware,
  validationMiddleware(reportRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const format = (req.query.format || ReportFormat.JSON) as ReportFormat;
      
      const report = await financialReportingService.generateReport(ReportType.PROJECT_PROFITABILITY, filters);
      
      if (format === ReportFormat.JSON) {
        return res.json({
          success: true,
          data: report
        });
      }
      
      const exportedReport = await financialReportingService.exportReport(report, format);
      
      // Set appropriate headers based on format
      switch (format) {
        case ReportFormat.CSV:
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=project-profitability.csv');
          break;
        case ReportFormat.PDF:
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=project-profitability.pdf');
          break;
        case ReportFormat.EXCEL:
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=project-profitability.xlsx');
          break;
      }
      
      res.send(exportedReport);
    } catch (error: any) {
      console.error('Error generating project profitability report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate project profitability report'
      });
    }
  }
);

/**
 * @route GET /api/financial/time
 * @desc Get time utilization report
 * @access Private
 */
router.get(
  '/time',
  authMiddleware,
  validationMiddleware(reportRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const format = (req.query.format || ReportFormat.JSON) as ReportFormat;
      
      const report = await financialReportingService.generateReport(ReportType.TIME_UTILIZATION, filters);
      
      if (format === ReportFormat.JSON) {
        return res.json({
          success: true,
          data: report
        });
      }
      
      const exportedReport = await financialReportingService.exportReport(report, format);
      
      // Set appropriate headers based on format
      switch (format) {
        case ReportFormat.CSV:
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=time-utilization.csv');
          break;
        case ReportFormat.PDF:
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=time-utilization.pdf');
          break;
        case ReportFormat.EXCEL:
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=time-utilization.xlsx');
          break;
      }
      
      res.send(exportedReport);
    } catch (error: any) {
      console.error('Error generating time utilization report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate time utilization report'
      });
    }
  }
);

/**
 * @route GET /api/financial/revenue
 * @desc Get revenue summary report
 * @access Private
 */
router.get(
  '/revenue',
  authMiddleware,
  validationMiddleware(invoiceFilterSchema),
  async (req: Request, res: Response) => {
    try {
      const filters = parseFilters(req);
      const format = (req.query.format || ReportFormat.JSON) as ReportFormat;
      
      const report = await financialReportingService.generateReport(ReportType.REVENUE_SUMMARY, filters);
      
      if (format === ReportFormat.JSON) {
        return res.json({
          success: true,
          data: report
        });
      }
      
      const exportedReport = await financialReportingService.exportReport(report, format);
      
      // Set appropriate headers based on format
      switch (format) {
        case ReportFormat.CSV:
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=revenue-summary.csv');
          break;
        case ReportFormat.PDF:
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=revenue-summary.pdf');
          break;
        case ReportFormat.EXCEL:
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename=revenue-summary.xlsx');
          break;
      }
      
      res.send(exportedReport);
    } catch (error: any) {
      console.error('Error generating revenue summary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate revenue summary'
      });
    }
  }
);

export default router;