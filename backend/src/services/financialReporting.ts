import { GoogleSheetsService } from './googleSheets';
import { Expense, ExpenseCategory } from '../models/Expense';
import { Invoice, InvoiceStatus } from '../models/Invoice';
import { TimeEntry } from '../models/TimeEntry';
import { Project, ProjectStatus } from '../models/Project';
import NodeCache from 'node-cache';

// Cache configuration (TTL in seconds)
const CACHE_TTL = 300; // 5 minutes

// Define report types
export enum ReportType {
  PROFIT_LOSS = 'profit_loss',
  EXPENSE_SUMMARY = 'expense_summary',
  REVENUE_SUMMARY = 'revenue_summary',
  PROJECT_PROFITABILITY = 'project_profitability',
  TIME_UTILIZATION = 'time_utilization'
}

// Define time periods for reports
export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

// Define report format types
export enum ReportFormat {
  JSON = 'json',
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel'
}

// Interface for report filters
export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  projectId?: string;
  clientId?: string;
  expenseCategories?: ExpenseCategory[];
  invoiceStatus?: InvoiceStatus[];
  period?: ReportPeriod;
}

// Interface for financial metrics
export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  outstandingInvoices: number;
  overdueInvoices: number;
}

// Interface for project profitability
export interface ProjectProfitability {
  projectId: string;
  projectName: string;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  status: ProjectStatus;
}

// Interface for expense summary by category
export interface ExpenseSummary {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
}

// Interface for time utilization
export interface TimeUtilization {
  projectId: string;
  projectName: string;
  totalHours: number;
  billableHours: number;
  billablePercentage: number;
  revenue: number;
  revenuePerHour: number;
}

/**
 * Financial Reporting Service
 * Handles all financial reporting and metrics calculations
 */
export class FinancialReportingService {
  private sheetsService: GoogleSheetsService;
  private cache: NodeCache;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
    this.cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });
  }

  /**
   * Get date range based on report period
   */
  private getDateRangeForPeriod(period: ReportPeriod, customStartDate?: Date, customEndDate?: Date): { startDate: Date, endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate = new Date(now);

    if (period === ReportPeriod.CUSTOM && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    switch (period) {
      case ReportPeriod.DAILY:
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case ReportPeriod.WEEKLY:
        const dayOfWeek = now.getDay();
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case ReportPeriod.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case ReportPeriod.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
        break;
      case ReportPeriod.YEARLY:
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        // Default to last 30 days
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Apply date filters to data
   */
  private filterByDateRange<T extends { date: Date }>(data: T[], startDate: Date, endDate: Date): T[] {
    return data.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  /**
   * Get all expenses with optional filters
   */
  private async getExpenses(filters: ReportFilters = {}): Promise<Expense[]> {
    const cacheKey = `expenses_${JSON.stringify(filters)}`;
    const cachedExpenses = this.cache.get<Expense[]>(cacheKey);
    
    if (cachedExpenses) {
      return cachedExpenses;
    }

    try {
      let expenses = await this.sheetsService.read('Expenses');
      expenses = expenses.map(row => Expense.fromSheetRow(row));

      // Apply filters
      if (filters.projectId) {
        expenses = expenses.filter(expense => expense.project_id === filters.projectId);
      }

      if (filters.expenseCategories && filters.expenseCategories.length > 0) {
        expenses = expenses.filter(expense => filters.expenseCategories!.includes(expense.category));
      }

      if (filters.startDate && filters.endDate) {
        expenses = this.filterByDateRange(expenses, filters.startDate, filters.endDate);
      } else if (filters.period) {
        const { startDate, endDate } = this.getDateRangeForPeriod(filters.period);
        expenses = this.filterByDateRange(expenses, startDate, endDate);
      }

      this.cache.set(cacheKey, expenses);
      return expenses;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw new Error('Failed to fetch expenses');
    }
  }

  /**
   * Get all invoices with optional filters
   */
  private async getInvoices(filters: ReportFilters = {}): Promise<Invoice[]> {
    const cacheKey = `invoices_${JSON.stringify(filters)}`;
    const cachedInvoices = this.cache.get<Invoice[]>(cacheKey);
    
    if (cachedInvoices) {
      return cachedInvoices;
    }

    try {
      let invoices = await this.sheetsService.read('Invoices');
      invoices = invoices.map(row => Invoice.fromSheetRow(row));

      // Apply filters
      if (filters.projectId) {
        invoices = invoices.filter(invoice => invoice.project_id === filters.projectId);
      }

      if (filters.clientId) {
        invoices = invoices.filter(invoice => invoice.client_id === filters.clientId);
      }

      if (filters.invoiceStatus && filters.invoiceStatus.length > 0) {
        invoices = invoices.filter(invoice => filters.invoiceStatus!.includes(invoice.status));
      }

      // For invoices, we filter by due_date instead of date
      if (filters.startDate && filters.endDate) {
        invoices = invoices.filter(invoice => {
          const dueDate = new Date(invoice.due_date);
          return dueDate >= filters.startDate! && dueDate <= filters.endDate!;
        });
      } else if (filters.period) {
        const { startDate, endDate } = this.getDateRangeForPeriod(filters.period);
        invoices = invoices.filter(invoice => {
          const dueDate = new Date(invoice.due_date);
          return dueDate >= startDate && dueDate <= endDate;
        });
      }

      this.cache.set(cacheKey, invoices);
      return invoices;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw new Error('Failed to fetch invoices');
    }
  }

  /**
   * Get all time entries with optional filters
   */
  private async getTimeEntries(filters: ReportFilters = {}): Promise<TimeEntry[]> {
    const cacheKey = `time_entries_${JSON.stringify(filters)}`;
    const cachedEntries = this.cache.get<TimeEntry[]>(cacheKey);
    
    if (cachedEntries) {
      return cachedEntries;
    }

    try {
      let entries = await this.sheetsService.read('Time_Entries');
      entries = entries.map(row => TimeEntry.fromSheetRow(row));

      // Apply filters
      if (filters.projectId) {
        entries = entries.filter(entry => entry.project_id === filters.projectId);
      }

      if (filters.startDate && filters.endDate) {
        entries = this.filterByDateRange(entries, filters.startDate, filters.endDate);
      } else if (filters.period) {
        const { startDate, endDate } = this.getDateRangeForPeriod(filters.period);
        entries = this.filterByDateRange(entries, startDate, endDate);
      }

      this.cache.set(cacheKey, entries);
      return entries;
    } catch (error) {
      console.error('Error fetching time entries:', error);
      throw new Error('Failed to fetch time entries');
    }
  }

  /**
   * Get all projects with optional filters
   */
  private async getProjects(filters: ReportFilters = {}): Promise<Project[]> {
    const cacheKey = `projects_${JSON.stringify(filters)}`;
    const cachedProjects = this.cache.get<Project[]>(cacheKey);
    
    if (cachedProjects) {
      return cachedProjects;
    }

    try {
      let projects = await this.sheetsService.read('Projects');
      projects = projects.map(row => Project.fromSheetRow(row));

      // Apply filters
      if (filters.projectId) {
        projects = projects.filter(project => project.id === filters.projectId);
      }

      if (filters.clientId) {
        projects = projects.filter(project => project.client_id === filters.clientId);
      }

      this.cache.set(cacheKey, projects);
      return projects;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }

  /**
   * Calculate profit/loss for a given period
   */
  async calculateProfitLoss(filters: ReportFilters = {}): Promise<{
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }> {
    try {
      // Get paid invoices for revenue
      const invoiceFilters = { ...filters, invoiceStatus: [InvoiceStatus.PAID] };
      const invoices = await this.getInvoices(invoiceFilters);
      
      // Get expenses
      const expenses = await this.getExpenses(filters);
      
      // Calculate totals
      const revenue = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const profit = revenue - totalExpenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      return {
        revenue,
        expenses: totalExpenses,
        profit,
        profitMargin
      };
    } catch (error) {
      console.error('Error calculating profit/loss:', error);
      throw new Error('Failed to calculate profit/loss');
    }
  }

  /**
   * Calculate expense summary by category
   */
  async calculateExpenseSummary(filters: ReportFilters = {}): Promise<ExpenseSummary[]> {
    try {
      const expenses = await this.getExpenses(filters);
      
      // Group expenses by category
      const categorySums = new Map<ExpenseCategory, number>();
      
      // Initialize all categories with 0
      Object.values(ExpenseCategory).forEach(category => {
        categorySums.set(category as ExpenseCategory, 0);
      });
      
      // Sum expenses by category
      expenses.forEach(expense => {
        const currentSum = categorySums.get(expense.category) || 0;
        categorySums.set(expense.category, currentSum + expense.amount);
      });
      
      // Calculate total expenses
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      // Create summary objects
      const summary: ExpenseSummary[] = Array.from(categorySums.entries()).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }));
      
      // Sort by amount descending
      return summary.sort((a, b) => b.amount - a.amount);
    } catch (error) {
      console.error('Error calculating expense summary:', error);
      throw new Error('Failed to calculate expense summary');
    }
  }

  /**
   * Calculate project profitability
   */
  async calculateProjectProfitability(filters: ReportFilters = {}): Promise<ProjectProfitability[]> {
    try {
      const projects = await this.getProjects(filters);
      const result: ProjectProfitability[] = [];
      
      for (const project of projects) {
        // Get paid invoices for this project
        const invoiceFilters = { 
          ...filters, 
          projectId: project.id, 
          invoiceStatus: [InvoiceStatus.PAID] 
        };
        const invoices = await this.getInvoices(invoiceFilters);
        
        // Get expenses for this project
        const expenseFilters = { ...filters, projectId: project.id };
        const expenses = await this.getExpenses(expenseFilters);
        
        // Calculate totals
        const revenue = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const profit = revenue - totalExpenses;
        const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        
        result.push({
          projectId: project.id,
          projectName: project.name,
          revenue,
          expenses: totalExpenses,
          profit,
          profitMargin,
          status: project.status
        });
      }
      
      // Sort by profit margin descending
      return result.sort((a, b) => b.profitMargin - a.profitMargin);
    } catch (error) {
      console.error('Error calculating project profitability:', error);
      throw new Error('Failed to calculate project profitability');
    }
  }

  /**
   * Calculate time utilization metrics
   */
  async calculateTimeUtilization(filters: ReportFilters = {}): Promise<TimeUtilization[]> {
    try {
      const projects = await this.getProjects(filters);
      const result: TimeUtilization[] = [];
      
      for (const project of projects) {
        // Get time entries for this project
        const timeFilters = { ...filters, projectId: project.id };
        const timeEntries = await this.getTimeEntries(timeFilters);
        
        // Get paid invoices for this project
        const invoiceFilters = { 
          ...filters, 
          projectId: project.id, 
          invoiceStatus: [InvoiceStatus.PAID] 
        };
        const invoices = await this.getInvoices(invoiceFilters);
        
        // Calculate metrics
        const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const billableHours = totalHours; // Assuming all hours are billable for now
        const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;
        const revenue = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
        const revenuePerHour = billableHours > 0 ? revenue / billableHours : 0;
        
        result.push({
          projectId: project.id,
          projectName: project.name,
          totalHours,
          billableHours,
          billablePercentage,
          revenue,
          revenuePerHour
        });
      }
      
      // Sort by revenue per hour descending
      return result.sort((a, b) => b.revenuePerHour - a.revenuePerHour);
    } catch (error) {
      console.error('Error calculating time utilization:', error);
      throw new Error('Failed to calculate time utilization');
    }
  }

  /**
   * Calculate dashboard metrics
   */
  async calculateDashboardMetrics(filters: ReportFilters = {}): Promise<FinancialMetrics> {
    try {
      // Get all invoices
      const allInvoices = await this.getInvoices(filters);
      
      // Get expenses
      const expenses = await this.getExpenses(filters);
      
      // Calculate metrics
      const totalRevenue = allInvoices
        .filter(invoice => invoice.status === InvoiceStatus.PAID)
        .reduce((sum, invoice) => sum + invoice.total_amount, 0);
      
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      
      const outstandingInvoices = allInvoices
        .filter(invoice => invoice.status === InvoiceStatus.SENT)
        .reduce((sum, invoice) => sum + invoice.total_amount, 0);
      
      const overdueInvoices = allInvoices
        .filter(invoice => invoice.status === InvoiceStatus.OVERDUE)
        .reduce((sum, invoice) => sum + invoice.total_amount, 0);
      
      return {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        outstandingInvoices,
        overdueInvoices
      };
    } catch (error) {
      console.error('Error calculating dashboard metrics:', error);
      throw new Error('Failed to calculate dashboard metrics');
    }
  }

  /**
   * Generate a report based on type and filters
   */
  async generateReport(type: ReportType, filters: ReportFilters = {}): Promise<any> {
    try {
      switch (type) {
        case ReportType.PROFIT_LOSS:
          return await this.calculateProfitLoss(filters);
        
        case ReportType.EXPENSE_SUMMARY:
          return await this.calculateExpenseSummary(filters);
        
        case ReportType.PROJECT_PROFITABILITY:
          return await this.calculateProjectProfitability(filters);
        
        case ReportType.TIME_UTILIZATION:
          return await this.calculateTimeUtilization(filters);
        
        case ReportType.REVENUE_SUMMARY:
          // Get invoices grouped by status
          const invoices = await this.getInvoices(filters);
          
          const paidInvoices = invoices.filter(inv => inv.status === InvoiceStatus.PAID);
          const sentInvoices = invoices.filter(inv => inv.status === InvoiceStatus.SENT);
          const overdueInvoices = invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE);
          const draftInvoices = invoices.filter(inv => inv.status === InvoiceStatus.DRAFT);
          
          return {
            paid: {
              count: paidInvoices.length,
              amount: paidInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
            },
            pending: {
              count: sentInvoices.length,
              amount: sentInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
            },
            overdue: {
              count: overdueInvoices.length,
              amount: overdueInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
            },
            draft: {
              count: draftInvoices.length,
              amount: draftInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
            },
            total: {
              count: invoices.length,
              amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0)
            }
          };
        
        default:
          throw new Error(`Unsupported report type: ${type}`);
      }
    } catch (error) {
      console.error(`Error generating ${type} report:`, error);
      throw new Error(`Failed to generate ${type} report`);
    }
  }

  /**
   * Export report to specified format
   */
  async exportReport(data: any, format: ReportFormat): Promise<Buffer | string> {
    try {
      switch (format) {
        case ReportFormat.JSON:
          return JSON.stringify(data, null, 2);
        
        case ReportFormat.CSV:
          return this.convertToCSV(data);
        
        case ReportFormat.PDF:
          // This would typically use a PDF generation library
          // For now, we'll just return a placeholder
          return Buffer.from('PDF generation not implemented yet');
        
        case ReportFormat.EXCEL:
          // This would typically use an Excel generation library
          // For now, we'll just return a placeholder
          return Buffer.from('Excel generation not implemented yet');
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error(`Error exporting to ${format}:`, error);
      throw new Error(`Failed to export to ${format}`);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    // Handle array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const headerRow = headers.join(',');
      
      const rows = data.map(item => {
        return headers.map(header => {
          const value = item[header];
          // Handle special cases like dates, strings with commas, etc.
          if (value instanceof Date) {
            return value.toISOString();
          } else if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          } else {
            return value;
          }
        }).join(',');
      });
      
      return [headerRow, ...rows].join('\n');
    }
    
    // Handle single object
    const rows = [];
    for (const [key, value] of Object.entries(data)) {
      rows.push(`${key},${value}`);
    }
    
    return rows.join('\n');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
  }
}

// Factory function to create FinancialReportingService instance
export function createFinancialReportingService(sheetsService: GoogleSheetsService): FinancialReportingService {
  return new FinancialReportingService(sheetsService);
}