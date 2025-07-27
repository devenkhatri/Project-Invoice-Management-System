import { SheetsService } from './sheets.service';
import { Expense } from '../models/Expense';
import { Invoice } from '../models/Invoice';
import { Project } from '../models/Project';
import { TimeEntry } from '../models/TimeEntry';
import { ExpenseCategory } from '../types';

export interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  outstandingInvoices: number;
  cashFlow: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  monthlyTrends: MonthlyTrend[];
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  expenseCount: number;
}

export interface ProjectFinancials {
  projectId: string;
  projectName: string;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  budgetUtilization: number;
  billableHours: number;
  hourlyRate: number;
}

export interface BudgetVariance {
  projectId: string;
  projectName: string;
  budgetAmount: number;
  actualExpenses: number;
  variance: number;
  variancePercentage: number;
  status: 'under_budget' | 'over_budget' | 'on_budget';
}

export class FinancialService {
  private static instance: FinancialService;
  private sheetsService: SheetsService;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor() {
    this.sheetsService = SheetsService.getInstance();
  }

  public static getInstance(): FinancialService {
    if (!FinancialService.instance) {
      FinancialService.instance = new FinancialService();
    }
    return FinancialService.instance;
  }

  // Cache management
  private getCacheKey(method: string, params: any): string {
    return `${method}_${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlMinutes: number = 15): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  // Clear cache when data changes
  public clearCache(): void {
    this.cache.clear();
  }

  // Get comprehensive financial metrics
  async getFinancialMetrics(startDate?: string, endDate?: string): Promise<FinancialMetrics> {
    const cacheKey = this.getCacheKey('getFinancialMetrics', { startDate, endDate });
    const cached = this.getFromCache<FinancialMetrics>(cacheKey);
    if (cached) return cached;

    try {
      // Build date filters
      const dateFilter: any = {};
      if (startDate) dateFilter['>='] = startDate;
      if (endDate) dateFilter['<='] = endDate;

      // Get invoices for revenue calculation
      const invoiceFilters: any = {};
      if (startDate || endDate) invoiceFilters.issue_date = dateFilter;
      
      const invoices = await this.sheetsService.query('Invoices', invoiceFilters);
      const invoiceInstances = invoices.map(data => new Invoice(data));

      // Calculate revenue metrics
      const paidInvoices = invoiceInstances.filter(inv => inv.payment_status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const outstandingInvoices = invoiceInstances
        .filter(inv => inv.payment_status !== 'paid')
        .reduce((sum, inv) => sum + inv.total_amount, 0);

      // Get expenses
      const expenseFilters: any = {};
      if (startDate || endDate) expenseFilters.date = dateFilter;
      
      const expenses = await this.sheetsService.query('Expenses', expenseFilters);
      const expenseInstances = expenses.map(data => new Expense(data));

      const totalExpenses = Expense.calculateTotalAmount(expenseInstances);
      const expensesByCategory = Expense.calculateTotalByCategory(expenseInstances);

      // Calculate profit metrics
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const cashFlow = totalRevenue - totalExpenses; // Simplified cash flow

      // Calculate monthly trends
      const monthlyTrends = await this.calculateMonthlyTrends(startDate, endDate);

      const metrics: FinancialMetrics = {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        outstandingInvoices,
        cashFlow,
        expensesByCategory,
        monthlyTrends
      };

      this.setCache(cacheKey, metrics, 15); // Cache for 15 minutes
      return metrics;
    } catch (error) {
      console.error('Error calculating financial metrics:', error);
      throw error;
    }
  }

  // Calculate monthly trends
  private async calculateMonthlyTrends(startDate?: string, endDate?: string): Promise<MonthlyTrend[]> {
    try {
      // Build date filters
      const dateFilter: any = {};
      if (startDate) dateFilter['>='] = startDate;
      if (endDate) dateFilter['<='] = endDate;

      // Get invoices and expenses
      const invoiceFilters: any = {};
      const expenseFilters: any = {};
      
      if (startDate || endDate) {
        invoiceFilters.issue_date = dateFilter;
        expenseFilters.date = dateFilter;
      }

      const [invoices, expenses] = await Promise.all([
        this.sheetsService.query('Invoices', invoiceFilters),
        this.sheetsService.query('Expenses', expenseFilters)
      ]);

      const invoiceInstances = invoices.map(data => new Invoice(data));
      const expenseInstances = expenses.map(data => new Expense(data));

      // Group by month
      const monthlyData: Record<string, MonthlyTrend> = {};

      // Process invoices
      invoiceInstances.forEach(invoice => {
        if (invoice.payment_status === 'paid') {
          const date = new Date(invoice.issue_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthKey,
              revenue: 0,
              expenses: 0,
              profit: 0,
              invoiceCount: 0,
              expenseCount: 0
            };
          }
          
          monthlyData[monthKey].revenue += invoice.total_amount;
          monthlyData[monthKey].invoiceCount += 1;
        }
      });

      // Process expenses
      expenseInstances.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            revenue: 0,
            expenses: 0,
            profit: 0,
            invoiceCount: 0,
            expenseCount: 0
          };
        }
        
        monthlyData[monthKey].expenses += expense.calculateTotalAmount();
        monthlyData[monthKey].expenseCount += 1;
      });

      // Calculate profit for each month
      Object.values(monthlyData).forEach(month => {
        month.profit = month.revenue - month.expenses;
      });

      // Sort by month and return
      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    } catch (error) {
      console.error('Error calculating monthly trends:', error);
      throw error;
    }
  }

  // Get project financial analysis
  async getProjectFinancials(projectId?: string): Promise<ProjectFinancials[]> {
    const cacheKey = this.getCacheKey('getProjectFinancials', { projectId });
    const cached = this.getFromCache<ProjectFinancials[]>(cacheKey);
    if (cached) return cached;

    try {
      // Get projects to analyze
      const projects = projectId 
        ? await this.sheetsService.read('Projects', projectId)
        : await this.sheetsService.read('Projects');

      const projectFinancials = await Promise.all(
        projects.map(async (projectData) => {
          const project = new Project(projectData);
          
          // Get time entries for revenue calculation
          const timeEntries = await this.sheetsService.query('Time_Entries', { 
            project_id: project.id 
          });
          const timeInstances = timeEntries.map(data => new TimeEntry(data));
          
          // Calculate revenue from billable hours
          const billableHours = timeInstances
            .filter(entry => entry.is_billable)
            .reduce((sum, entry) => sum + entry.hours, 0);
          
          const hourlyRate = project.hourly_rate || 0;
          const timeRevenue = billableHours * hourlyRate;

          // Get invoices for additional revenue
          const invoices = await this.sheetsService.query('Invoices', { 
            project_id: project.id,
            payment_status: 'paid'
          });
          const invoiceRevenue = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);

          // Get expenses
          const expenses = await this.sheetsService.query('Expenses', { 
            project_id: project.id 
          });
          const expenseInstances = expenses.map(data => new Expense(data));
          const totalExpenses = Expense.calculateTotalAmount(expenseInstances);

          // Calculate metrics
          const totalRevenue = timeRevenue + invoiceRevenue;
          const profit = totalRevenue - totalExpenses;
          const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
          const budgetUtilization = project.budget > 0 ? (totalExpenses / project.budget) * 100 : 0;

          return {
            projectId: project.id,
            projectName: project.name,
            totalRevenue,
            totalExpenses,
            profit,
            profitMargin,
            budgetUtilization,
            billableHours,
            hourlyRate
          };
        })
      );

      this.setCache(cacheKey, projectFinancials, 30); // Cache for 30 minutes
      return projectFinancials;
    } catch (error) {
      console.error('Error calculating project financials:', error);
      throw error;
    }
  }

  // Budget variance analysis
  async getBudgetVariance(): Promise<BudgetVariance[]> {
    const cacheKey = this.getCacheKey('getBudgetVariance', {});
    const cached = this.getFromCache<BudgetVariance[]>(cacheKey);
    if (cached) return cached;

    try {
      const projects = await this.sheetsService.read('Projects');
      
      const budgetVariances = await Promise.all(
        projects.map(async (projectData) => {
          const project = new Project(projectData);
          
          // Get project expenses
          const expenses = await this.sheetsService.query('Expenses', { 
            project_id: project.id 
          });
          const expenseInstances = expenses.map(data => new Expense(data));
          const actualExpenses = Expense.calculateTotalAmount(expenseInstances);

          // Calculate variance
          const variance = project.budget - actualExpenses;
          const variancePercentage = project.budget > 0 ? (variance / project.budget) * 100 : 0;
          
          let status: 'under_budget' | 'over_budget' | 'on_budget';
          if (Math.abs(variancePercentage) <= 5) {
            status = 'on_budget';
          } else if (variance > 0) {
            status = 'under_budget';
          } else {
            status = 'over_budget';
          }

          return {
            projectId: project.id,
            projectName: project.name,
            budgetAmount: project.budget,
            actualExpenses,
            variance,
            variancePercentage,
            status
          };
        })
      );

      this.setCache(cacheKey, budgetVariances, 30); // Cache for 30 minutes
      return budgetVariances;
    } catch (error) {
      console.error('Error calculating budget variance:', error);
      throw error;
    }
  }

  // Tax deduction analysis
  async getTaxDeductionSummary(year: number): Promise<{
    totalDeductible: number;
    byCategory: Record<ExpenseCategory, number>;
    monthlyBreakdown: Array<{ month: string; amount: number }>;
  }> {
    const cacheKey = this.getCacheKey('getTaxDeductionSummary', { year });
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const expenses = await this.sheetsService.query('Expenses', {
        date: { '>=': startDate, '<=': endDate }
      });
      
      const expenseInstances = expenses.map(data => new Expense(data));
      const deductibleExpenses = expenseInstances.filter(expense => expense.isDeductible());

      const totalDeductible = Expense.calculateTotalAmount(deductibleExpenses);
      const byCategory = Expense.calculateTotalByCategory(deductibleExpenses);
      
      // Monthly breakdown
      const monthlyBreakdown = Expense.groupByMonth(deductibleExpenses);
      const monthlyData = Object.entries(monthlyBreakdown).map(([month, monthExpenses]) => ({
        month,
        amount: Expense.calculateTotalAmount(monthExpenses)
      })).sort((a, b) => a.month.localeCompare(b.month));

      const summary = {
        totalDeductible,
        byCategory,
        monthlyBreakdown: monthlyData
      };

      this.setCache(cacheKey, summary, 60); // Cache for 1 hour
      return summary;
    } catch (error) {
      console.error('Error calculating tax deduction summary:', error);
      throw error;
    }
  }

  // Cash flow forecasting
  async getCashFlowForecast(months: number = 6): Promise<Array<{
    month: string;
    projectedIncome: number;
    projectedExpenses: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
  }>> {
    const cacheKey = this.getCacheKey('getCashFlowForecast', { months });
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Get historical data for trend analysis
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const historicalMetrics = await this.getFinancialMetrics(
        sixMonthsAgo.toISOString().split('T')[0]
      );

      // Calculate average monthly income and expenses
      const monthlyTrends = historicalMetrics.monthlyTrends;
      const avgMonthlyIncome = monthlyTrends.length > 0 
        ? monthlyTrends.reduce((sum, trend) => sum + trend.revenue, 0) / monthlyTrends.length 
        : 0;
      const avgMonthlyExpenses = monthlyTrends.length > 0 
        ? monthlyTrends.reduce((sum, trend) => sum + trend.expenses, 0) / monthlyTrends.length 
        : 0;

      // Calculate growth rate
      const growthRate = monthlyTrends.length >= 2 
        ? (monthlyTrends[monthlyTrends.length - 1].revenue - monthlyTrends[0].revenue) / monthlyTrends[0].revenue / monthlyTrends.length
        : 0;

      // Generate forecast
      const forecast = [];
      let cumulativeCashFlow = historicalMetrics.cashFlow;
      const currentDate = new Date();

      for (let i = 1; i <= months; i++) {
        const forecastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Apply growth rate to income projection
        const projectedIncome = avgMonthlyIncome * (1 + growthRate * i);
        const projectedExpenses = avgMonthlyExpenses * 1.02; // Assume 2% expense inflation
        const netCashFlow = projectedIncome - projectedExpenses;
        cumulativeCashFlow += netCashFlow;

        forecast.push({
          month: monthKey,
          projectedIncome: Math.round(projectedIncome * 100) / 100,
          projectedExpenses: Math.round(projectedExpenses * 100) / 100,
          netCashFlow: Math.round(netCashFlow * 100) / 100,
          cumulativeCashFlow: Math.round(cumulativeCashFlow * 100) / 100
        });
      }

      this.setCache(cacheKey, forecast, 60); // Cache for 1 hour
      return forecast;
    } catch (error) {
      console.error('Error generating cash flow forecast:', error);
      throw error;
    }
  }

  // KPI Dashboard metrics
  async getDashboardKPIs(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    outstandingAmount: number;
    monthlyGrowth: number;
    expenseGrowth: number;
    topExpenseCategory: string;
    mostProfitableProject: string;
  }> {
    const cacheKey = this.getCacheKey('getDashboardKPIs', {});
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    try {
      // Get current month metrics
      const currentDate = new Date();
      const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const [currentMetrics, lastMonthMetrics, projectFinancials] = await Promise.all([
        this.getFinancialMetrics(`${currentMonth}-01`, `${currentMonth}-31`),
        this.getFinancialMetrics(`${lastMonthKey}-01`, `${lastMonthKey}-31`),
        this.getProjectFinancials()
      ]);

      // Calculate growth rates
      const monthlyGrowth = lastMonthMetrics.totalRevenue > 0 
        ? ((currentMetrics.totalRevenue - lastMonthMetrics.totalRevenue) / lastMonthMetrics.totalRevenue) * 100 
        : 0;
      
      const expenseGrowth = lastMonthMetrics.totalExpenses > 0 
        ? ((currentMetrics.totalExpenses - lastMonthMetrics.totalExpenses) / lastMonthMetrics.totalExpenses) * 100 
        : 0;

      // Find top expense category
      const topExpenseCategory = Object.entries(currentMetrics.expensesByCategory)
        .reduce((max, [category, amount]) => amount > max.amount ? { category, amount } : max, 
                { category: '', amount: 0 }).category;

      // Find most profitable project
      const mostProfitableProject = projectFinancials
        .reduce((max, project) => project.profit > max.profit ? project : max, 
                { projectName: '', profit: 0 }).projectName;

      const kpis = {
        totalRevenue: currentMetrics.totalRevenue,
        totalExpenses: currentMetrics.totalExpenses,
        netProfit: currentMetrics.netProfit,
        profitMargin: currentMetrics.profitMargin,
        outstandingAmount: currentMetrics.outstandingInvoices,
        monthlyGrowth,
        expenseGrowth,
        topExpenseCategory,
        mostProfitableProject
      };

      this.setCache(cacheKey, kpis, 10); // Cache for 10 minutes
      return kpis;
    } catch (error) {
      console.error('Error calculating dashboard KPIs:', error);
      throw error;
    }
  }
}