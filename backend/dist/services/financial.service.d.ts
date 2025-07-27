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
export declare class FinancialService {
    private static instance;
    private sheetsService;
    private cache;
    constructor();
    static getInstance(): FinancialService;
    private getCacheKey;
    private getFromCache;
    private setCache;
    clearCache(): void;
    getFinancialMetrics(startDate?: string, endDate?: string): Promise<FinancialMetrics>;
    private calculateMonthlyTrends;
    getProjectFinancials(projectId?: string): Promise<ProjectFinancials[]>;
    getBudgetVariance(): Promise<BudgetVariance[]>;
    getTaxDeductionSummary(year: number): Promise<{
        totalDeductible: number;
        byCategory: Record<ExpenseCategory, number>;
        monthlyBreakdown: Array<{
            month: string;
            amount: number;
        }>;
    }>;
    getCashFlowForecast(months?: number): Promise<Array<{
        month: string;
        projectedIncome: number;
        projectedExpenses: number;
        netCashFlow: number;
        cumulativeCashFlow: number;
    }>>;
    getDashboardKPIs(): Promise<{
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        profitMargin: number;
        outstandingAmount: number;
        monthlyGrowth: number;
        expenseGrowth: number;
        topExpenseCategory: string;
        mostProfitableProject: string;
    }>;
}
//# sourceMappingURL=financial.service.d.ts.map