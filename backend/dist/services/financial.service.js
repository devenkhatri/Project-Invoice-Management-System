"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialService = void 0;
const sheets_service_1 = require("./sheets.service");
const Expense_1 = require("../models/Expense");
const Invoice_1 = require("../models/Invoice");
const Project_1 = require("../models/Project");
const TimeEntry_1 = require("../models/TimeEntry");
class FinancialService {
    constructor() {
        this.cache = new Map();
        this.sheetsService = sheets_service_1.SheetsService.getInstance();
    }
    static getInstance() {
        if (!FinancialService.instance) {
            FinancialService.instance = new FinancialService();
        }
        return FinancialService.instance;
    }
    getCacheKey(method, params) {
        return `${method}_${JSON.stringify(params)}`;
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }
    setCache(key, data, ttlMinutes = 15) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMinutes * 60 * 1000
        });
    }
    clearCache() {
        this.cache.clear();
    }
    async getFinancialMetrics(startDate, endDate) {
        const cacheKey = this.getCacheKey('getFinancialMetrics', { startDate, endDate });
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const dateFilter = {};
            if (startDate)
                dateFilter['>='] = startDate;
            if (endDate)
                dateFilter['<='] = endDate;
            const invoiceFilters = {};
            if (startDate || endDate)
                invoiceFilters.issue_date = dateFilter;
            const invoices = await this.sheetsService.query('Invoices', invoiceFilters);
            const invoiceInstances = invoices.map(data => new Invoice_1.Invoice(data));
            const paidInvoices = invoiceInstances.filter(inv => inv.payment_status === 'paid');
            const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
            const outstandingInvoices = invoiceInstances
                .filter(inv => inv.payment_status !== 'paid')
                .reduce((sum, inv) => sum + inv.total_amount, 0);
            const expenseFilters = {};
            if (startDate || endDate)
                expenseFilters.date = dateFilter;
            const expenses = await this.sheetsService.query('Expenses', expenseFilters);
            const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
            const totalExpenses = Expense_1.Expense.calculateTotalAmount(expenseInstances);
            const expensesByCategory = Expense_1.Expense.calculateTotalByCategory(expenseInstances);
            const netProfit = totalRevenue - totalExpenses;
            const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
            const cashFlow = totalRevenue - totalExpenses;
            const monthlyTrends = await this.calculateMonthlyTrends(startDate, endDate);
            const metrics = {
                totalRevenue,
                totalExpenses,
                netProfit,
                profitMargin,
                outstandingInvoices,
                cashFlow,
                expensesByCategory,
                monthlyTrends
            };
            this.setCache(cacheKey, metrics, 15);
            return metrics;
        }
        catch (error) {
            console.error('Error calculating financial metrics:', error);
            throw error;
        }
    }
    async calculateMonthlyTrends(startDate, endDate) {
        try {
            const dateFilter = {};
            if (startDate)
                dateFilter['>='] = startDate;
            if (endDate)
                dateFilter['<='] = endDate;
            const invoiceFilters = {};
            const expenseFilters = {};
            if (startDate || endDate) {
                invoiceFilters.issue_date = dateFilter;
                expenseFilters.date = dateFilter;
            }
            const [invoices, expenses] = await Promise.all([
                this.sheetsService.query('Invoices', invoiceFilters),
                this.sheetsService.query('Expenses', expenseFilters)
            ]);
            const invoiceInstances = invoices.map(data => new Invoice_1.Invoice(data));
            const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
            const monthlyData = {};
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
            Object.values(monthlyData).forEach(month => {
                month.profit = month.revenue - month.expenses;
            });
            return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
        }
        catch (error) {
            console.error('Error calculating monthly trends:', error);
            throw error;
        }
    }
    async getProjectFinancials(projectId) {
        const cacheKey = this.getCacheKey('getProjectFinancials', { projectId });
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const projects = projectId
                ? await this.sheetsService.read('Projects', projectId)
                : await this.sheetsService.read('Projects');
            const projectFinancials = await Promise.all(projects.map(async (projectData) => {
                const project = new Project_1.Project(projectData);
                const timeEntries = await this.sheetsService.query('Time_Entries', {
                    project_id: project.id
                });
                const timeInstances = timeEntries.map(data => new TimeEntry_1.TimeEntry(data));
                const billableHours = timeInstances
                    .filter(entry => entry.is_billable)
                    .reduce((sum, entry) => sum + entry.hours, 0);
                const hourlyRate = project.hourly_rate || 0;
                const timeRevenue = billableHours * hourlyRate;
                const invoices = await this.sheetsService.query('Invoices', {
                    project_id: project.id,
                    payment_status: 'paid'
                });
                const invoiceRevenue = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
                const expenses = await this.sheetsService.query('Expenses', {
                    project_id: project.id
                });
                const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
                const totalExpenses = Expense_1.Expense.calculateTotalAmount(expenseInstances);
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
            }));
            this.setCache(cacheKey, projectFinancials, 30);
            return projectFinancials;
        }
        catch (error) {
            console.error('Error calculating project financials:', error);
            throw error;
        }
    }
    async getBudgetVariance() {
        const cacheKey = this.getCacheKey('getBudgetVariance', {});
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const projects = await this.sheetsService.read('Projects');
            const budgetVariances = await Promise.all(projects.map(async (projectData) => {
                const project = new Project_1.Project(projectData);
                const expenses = await this.sheetsService.query('Expenses', {
                    project_id: project.id
                });
                const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
                const actualExpenses = Expense_1.Expense.calculateTotalAmount(expenseInstances);
                const variance = project.budget - actualExpenses;
                const variancePercentage = project.budget > 0 ? (variance / project.budget) * 100 : 0;
                let status;
                if (Math.abs(variancePercentage) <= 5) {
                    status = 'on_budget';
                }
                else if (variance > 0) {
                    status = 'under_budget';
                }
                else {
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
            }));
            this.setCache(cacheKey, budgetVariances, 30);
            return budgetVariances;
        }
        catch (error) {
            console.error('Error calculating budget variance:', error);
            throw error;
        }
    }
    async getTaxDeductionSummary(year) {
        const cacheKey = this.getCacheKey('getTaxDeductionSummary', { year });
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            const expenses = await this.sheetsService.query('Expenses', {
                date: { '>=': startDate, '<=': endDate }
            });
            const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
            const deductibleExpenses = expenseInstances.filter(expense => expense.isDeductible());
            const totalDeductible = Expense_1.Expense.calculateTotalAmount(deductibleExpenses);
            const byCategory = Expense_1.Expense.calculateTotalByCategory(deductibleExpenses);
            const monthlyBreakdown = Expense_1.Expense.groupByMonth(deductibleExpenses);
            const monthlyData = Object.entries(monthlyBreakdown).map(([month, monthExpenses]) => ({
                month,
                amount: Expense_1.Expense.calculateTotalAmount(monthExpenses)
            })).sort((a, b) => a.month.localeCompare(b.month));
            const summary = {
                totalDeductible,
                byCategory,
                monthlyBreakdown: monthlyData
            };
            this.setCache(cacheKey, summary, 60);
            return summary;
        }
        catch (error) {
            console.error('Error calculating tax deduction summary:', error);
            throw error;
        }
    }
    async getCashFlowForecast(months = 6) {
        const cacheKey = this.getCacheKey('getCashFlowForecast', { months });
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const historicalMetrics = await this.getFinancialMetrics(sixMonthsAgo.toISOString().split('T')[0]);
            const monthlyTrends = historicalMetrics.monthlyTrends;
            const avgMonthlyIncome = monthlyTrends.length > 0
                ? monthlyTrends.reduce((sum, trend) => sum + trend.revenue, 0) / monthlyTrends.length
                : 0;
            const avgMonthlyExpenses = monthlyTrends.length > 0
                ? monthlyTrends.reduce((sum, trend) => sum + trend.expenses, 0) / monthlyTrends.length
                : 0;
            const growthRate = monthlyTrends.length >= 2
                ? (monthlyTrends[monthlyTrends.length - 1].revenue - monthlyTrends[0].revenue) / monthlyTrends[0].revenue / monthlyTrends.length
                : 0;
            const forecast = [];
            let cumulativeCashFlow = historicalMetrics.cashFlow;
            const currentDate = new Date();
            for (let i = 1; i <= months; i++) {
                const forecastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
                const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
                const projectedIncome = avgMonthlyIncome * (1 + growthRate * i);
                const projectedExpenses = avgMonthlyExpenses * 1.02;
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
            this.setCache(cacheKey, forecast, 60);
            return forecast;
        }
        catch (error) {
            console.error('Error generating cash flow forecast:', error);
            throw error;
        }
    }
    async getDashboardKPIs() {
        const cacheKey = this.getCacheKey('getDashboardKPIs', {});
        const cached = this.getFromCache(cacheKey);
        if (cached)
            return cached;
        try {
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
            const [currentMetrics, lastMonthMetrics, projectFinancials] = await Promise.all([
                this.getFinancialMetrics(`${currentMonth}-01`, `${currentMonth}-31`),
                this.getFinancialMetrics(`${lastMonthKey}-01`, `${lastMonthKey}-31`),
                this.getProjectFinancials()
            ]);
            const monthlyGrowth = lastMonthMetrics.totalRevenue > 0
                ? ((currentMetrics.totalRevenue - lastMonthMetrics.totalRevenue) / lastMonthMetrics.totalRevenue) * 100
                : 0;
            const expenseGrowth = lastMonthMetrics.totalExpenses > 0
                ? ((currentMetrics.totalExpenses - lastMonthMetrics.totalExpenses) / lastMonthMetrics.totalExpenses) * 100
                : 0;
            const topExpenseCategory = Object.entries(currentMetrics.expensesByCategory)
                .reduce((max, [category, amount]) => amount > max.amount ? { category, amount } : max, { category: '', amount: 0 }).category;
            const mostProfitableProject = projectFinancials
                .reduce((max, project) => project.profit > max.profit ? project : max, { projectName: '', profit: 0 }).projectName;
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
            this.setCache(cacheKey, kpis, 10);
            return kpis;
        }
        catch (error) {
            console.error('Error calculating dashboard KPIs:', error);
            throw error;
        }
    }
}
exports.FinancialService = FinancialService;
//# sourceMappingURL=financial.service.js.map