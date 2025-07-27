import express from 'express';
import { SheetsService } from '../services/sheets.service';
import { Expense } from '../models/Expense';
import { Invoice } from '../models/Invoice';
import { Project } from '../models/Project';
import { TimeEntry } from '../models/TimeEntry';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { query } from 'express-validator';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Common query validation for date ranges
const dateRangeValidation = [
  query('start_date').optional().isISO8601().withMessage('Start date must be in ISO format'),
  query('end_date').optional().isISO8601().withMessage('End date must be in ISO format'),
  query('project_id').optional().isString(),
  query('client_id').optional().isString(),
  query('format').optional().isIn(['json', 'pdf', 'excel', 'csv']).withMessage('Invalid format')
];

// Helper function to calculate project profitability
async function calculateProjectProfitability(projectId: string, startDate?: string, endDate?: string) {
  const sheetsService = SheetsService.getInstance();
  
  // Get project details
  const projects = await sheetsService.read('Projects', projectId);
  if (projects.length === 0) {
    throw new Error('Project not found');
  }
  const project = new Project(projects[0]);

  // Build date filters
  const dateFilter: any = {};
  if (startDate) dateFilter['>='] = startDate;
  if (endDate) dateFilter['<='] = endDate;

  // Get time entries for revenue calculation
  const timeFilters: any = { project_id: projectId };
  if (startDate || endDate) timeFilters.date = dateFilter;
  
  const timeEntries = await sheetsService.query('Time_Entries', timeFilters);
  const timeInstances = timeEntries.map(data => new TimeEntry(data));
  
  // Calculate revenue from billable hours
  const billableHours = timeInstances
    .filter(entry => entry.is_billable)
    .reduce((sum, entry) => sum + entry.hours, 0);
  
  const hourlyRate = project.hourly_rate || 0;
  const timeRevenue = billableHours * hourlyRate;

  // Get invoices for additional revenue
  const invoiceFilters: any = { project_id: projectId };
  if (startDate || endDate) {
    invoiceFilters.issue_date = dateFilter;
  }
  
  const invoices = await sheetsService.query('Invoices', invoiceFilters);
  const invoiceInstances = invoices.map(data => new Invoice(data));
  
  const invoiceRevenue = invoiceInstances
    .filter(invoice => invoice.payment_status === 'paid')
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);

  // Get expenses
  const expenseFilters: any = { project_id: projectId };
  if (startDate || endDate) expenseFilters.date = dateFilter;
  
  const expenses = await sheetsService.query('Expenses', expenseFilters);
  const expenseInstances = expenses.map(data => new Expense(data));
  
  const totalExpenses = Expense.calculateTotalAmount(expenseInstances);
  const billableExpenses = Expense.calculateBillableAmount(expenseInstances);

  // Calculate profitability
  const totalRevenue = timeRevenue + invoiceRevenue;
  const totalCosts = totalExpenses;
  const profit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    project: {
      id: project.id,
      name: project.name,
      budget: project.budget,
      status: project.status
    },
    revenue: {
      time_based: timeRevenue,
      invoice_based: invoiceRevenue,
      total: totalRevenue
    },
    costs: {
      expenses: totalExpenses,
      billable_expenses: billableExpenses,
      total: totalCosts
    },
    profitability: {
      profit,
      profit_margin: profitMargin,
      budget_utilization: project.budget > 0 ? (totalCosts / project.budget) * 100 : 0
    },
    metrics: {
      billable_hours: billableHours,
      hourly_rate: hourlyRate,
      expense_count: expenseInstances.length
    }
  };
}

// GET /api/reports/profit-loss - Profit & Loss statement
router.get('/profit-loss', dateRangeValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { start_date, end_date, format = 'json' } = req.query;

    // Build date filters
    const dateFilter: any = {};
    if (start_date) dateFilter['>='] = start_date;
    if (end_date) dateFilter['<='] = end_date;

    // Get all invoices for revenue
    const invoiceFilters: any = {};
    if (start_date || end_date) invoiceFilters.issue_date = dateFilter;
    
    const invoices = await sheetsService.query('Invoices', invoiceFilters);
    const invoiceInstances = invoices.map(data => new Invoice(data));

    // Calculate revenue
    const paidInvoices = invoiceInstances.filter(invoice => invoice.payment_status === 'paid');
    const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const taxCollected = paidInvoices.reduce((sum, invoice) => sum + invoice.tax_breakdown.total_tax_amount, 0);

    // Get all expenses
    const expenseFilters: any = {};
    if (start_date || end_date) expenseFilters.date = dateFilter;
    
    const expenses = await sheetsService.query('Expenses', expenseFilters);
    const expenseInstances = expenses.map(data => new Expense(data));

    // Calculate expenses by category
    const expensesByCategory = Expense.calculateTotalByCategory(expenseInstances);
    const totalExpenses = Expense.calculateTotalAmount(expenseInstances);
    const deductibleExpenses = expenseInstances
      .filter(e => e.isDeductible())
      .reduce((sum, e) => sum + e.calculateTotalAmount(), 0);

    // Calculate profit/loss
    const grossProfit = totalRevenue - totalExpenses;
    const netProfit = grossProfit; // Simplified - would include other adjustments
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const profitLossData = {
      period: {
        start_date: start_date || 'All time',
        end_date: end_date || 'All time'
      },
      revenue: {
        total_revenue: totalRevenue,
        tax_collected: taxCollected,
        invoice_count: paidInvoices.length
      },
      expenses: {
        by_category: expensesByCategory,
        total_expenses: totalExpenses,
        deductible_expenses: deductibleExpenses,
        expense_count: expenseInstances.length
      },
      profitability: {
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin: profitMargin
      },
      generated_at: new Date().toISOString()
    };

    // Handle different output formats
    if (format === 'pdf') {
      return generateProfitLossPDF(res, profitLossData);
    } else if (format === 'excel') {
      return generateProfitLossExcel(res, profitLossData);
    } else if (format === 'csv') {
      return generateProfitLossCSV(res, profitLossData);
    }

    res.json(profitLossData);
  } catch (error) {
    console.error('Error generating profit/loss report:', error);
    res.status(500).json({
      error: 'Failed to generate profit/loss report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/reports/expense-summary - Expense breakdown by category
router.get('/expense-summary', dateRangeValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { start_date, end_date, project_id, format = 'json' } = req.query;

    // Build filters
    const filters: any = {};
    if (project_id) filters.project_id = project_id;
    if (start_date || end_date) {
      filters.date = {};
      if (start_date) filters.date['>='] = start_date;
      if (end_date) filters.date['<='] = end_date;
    }

    const expenses = await sheetsService.query('Expenses', filters);
    const expenseInstances = expenses.map(data => new Expense(data));

    // Group expenses by various dimensions
    const byCategory = Expense.calculateTotalByCategory(expenseInstances);
    const byProject = Expense.groupByProject(expenseInstances);
    const byMonth = Expense.groupByMonth(expenseInstances);

    // Calculate monthly trends
    const monthlyTrends = Object.entries(byMonth).map(([month, monthExpenses]) => ({
      month,
      total_amount: Expense.calculateTotalAmount(monthExpenses),
      expense_count: monthExpenses.length,
      by_category: Expense.calculateTotalByCategory(monthExpenses)
    })).sort((a, b) => a.month.localeCompare(b.month));

    // Calculate project breakdown
    const projectBreakdown = await Promise.all(
      Object.entries(byProject).map(async ([projectId, projectExpenses]) => {
        const projects = await sheetsService.read('Projects', projectId);
        const projectName = projects.length > 0 ? projects[0].name : 'Unknown Project';
        
        return {
          project_id: projectId,
          project_name: projectName,
          total_amount: Expense.calculateTotalAmount(projectExpenses),
          expense_count: projectExpenses.length,
          by_category: Expense.calculateTotalByCategory(projectExpenses)
        };
      })
    );

    const summaryData = {
      period: {
        start_date: start_date || 'All time',
        end_date: end_date || 'All time'
      },
      summary: {
        total_amount: Expense.calculateTotalAmount(expenseInstances),
        total_count: expenseInstances.length,
        billable_amount: Expense.calculateBillableAmount(expenseInstances),
        reimbursable_amount: Expense.calculateReimbursableAmount(expenseInstances),
        deductible_amount: expenseInstances
          .filter(e => e.isDeductible())
          .reduce((sum, e) => sum + e.calculateTotalAmount(), 0)
      },
      by_category: byCategory,
      by_project: projectBreakdown,
      monthly_trends: monthlyTrends,
      generated_at: new Date().toISOString()
    };

    // Handle different output formats
    if (format === 'pdf') {
      return generateExpenseSummaryPDF(res, summaryData);
    } else if (format === 'excel') {
      return generateExpenseSummaryExcel(res, summaryData);
    } else if (format === 'csv') {
      return generateExpenseSummaryCSV(res, summaryData);
    }

    res.json(summaryData);
  } catch (error) {
    console.error('Error generating expense summary:', error);
    res.status(500).json({
      error: 'Failed to generate expense summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/reports/revenue-analysis - Revenue trends and forecasting
router.get('/revenue-analysis', dateRangeValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { start_date, end_date, format = 'json' } = req.query;

    // Build date filters
    const dateFilter: any = {};
    if (start_date) dateFilter['>='] = start_date;
    if (end_date) dateFilter['<='] = end_date;

    // Get invoices
    const invoiceFilters: any = {};
    if (start_date || end_date) invoiceFilters.issue_date = dateFilter;
    
    const invoices = await sheetsService.query('Invoices', invoiceFilters);
    const invoiceInstances = invoices.map(data => new Invoice(data));

    // Group by month for trend analysis
    const monthlyRevenue = invoiceInstances.reduce((acc, invoice) => {
      const date = new Date(invoice.issue_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          total_invoiced: 0,
          total_paid: 0,
          invoice_count: 0,
          paid_count: 0,
          average_invoice_value: 0
        };
      }
      
      acc[monthKey].total_invoiced += invoice.total_amount;
      acc[monthKey].invoice_count += 1;
      
      if (invoice.payment_status === 'paid') {
        acc[monthKey].total_paid += invoice.total_amount;
        acc[monthKey].paid_count += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and sort by month
    const monthlyTrends = Object.values(monthlyRevenue).map((month: any) => ({
      ...month,
      average_invoice_value: month.invoice_count > 0 ? month.total_invoiced / month.invoice_count : 0,
      payment_rate: month.invoice_count > 0 ? (month.paid_count / month.invoice_count) * 100 : 0
    })).sort((a, b) => a.month.localeCompare(b.month));

    // Calculate growth rates
    const trendsWithGrowth = monthlyTrends.map((current, index) => {
      if (index === 0) {
        return { ...current, revenue_growth: 0, invoice_growth: 0 };
      }
      
      const previous = monthlyTrends[index - 1];
      const revenueGrowth = previous.total_paid > 0 
        ? ((current.total_paid - previous.total_paid) / previous.total_paid) * 100 
        : 0;
      const invoiceGrowth = previous.invoice_count > 0 
        ? ((current.invoice_count - previous.invoice_count) / previous.invoice_count) * 100 
        : 0;
      
      return {
        ...current,
        revenue_growth: revenueGrowth,
        invoice_growth: invoiceGrowth
      };
    });

    // Simple forecasting based on trend
    const lastThreeMonths = trendsWithGrowth.slice(-3);
    const avgGrowthRate = lastThreeMonths.length > 0 
      ? lastThreeMonths.reduce((sum, month) => sum + month.revenue_growth, 0) / lastThreeMonths.length 
      : 0;
    
    const lastMonthRevenue = trendsWithGrowth.length > 0 
      ? trendsWithGrowth[trendsWithGrowth.length - 1].total_paid 
      : 0;

    // Generate next 3 months forecast
    const forecast = [];
    let currentRevenue = lastMonthRevenue;
    const currentDate = new Date();
    
    for (let i = 1; i <= 3; i++) {
      const forecastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
      
      currentRevenue = currentRevenue * (1 + avgGrowthRate / 100);
      
      forecast.push({
        month: monthKey,
        forecasted_revenue: Math.round(currentRevenue * 100) / 100,
        confidence: Math.max(0, 100 - (i * 20)) // Decreasing confidence
      });
    }

    // Calculate overall metrics
    const totalInvoiced = invoiceInstances.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalPaid = invoiceInstances
      .filter(inv => inv.payment_status === 'paid')
      .reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalOutstanding = invoiceInstances
      .filter(inv => inv.payment_status !== 'paid')
      .reduce((sum, inv) => sum + inv.total_amount, 0);

    const revenueAnalysisData = {
      period: {
        start_date: start_date || 'All time',
        end_date: end_date || 'All time'
      },
      summary: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_outstanding: totalOutstanding,
        payment_rate: totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0,
        average_invoice_value: invoiceInstances.length > 0 ? totalInvoiced / invoiceInstances.length : 0
      },
      monthly_trends: trendsWithGrowth,
      forecast: forecast,
      growth_metrics: {
        average_growth_rate: avgGrowthRate,
        trend_direction: avgGrowthRate > 0 ? 'positive' : avgGrowthRate < 0 ? 'negative' : 'stable'
      },
      generated_at: new Date().toISOString()
    };

    // Handle different output formats
    if (format === 'pdf') {
      return generateRevenueAnalysisPDF(res, revenueAnalysisData);
    } else if (format === 'excel') {
      return generateRevenueAnalysisExcel(res, revenueAnalysisData);
    } else if (format === 'csv') {
      return generateRevenueAnalysisCSV(res, revenueAnalysisData);
    }

    res.json(revenueAnalysisData);
  } catch (error) {
    console.error('Error generating revenue analysis:', error);
    res.status(500).json({
      error: 'Failed to generate revenue analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/reports/project-profitability - Individual project analysis
router.get('/project-profitability', dateRangeValidation, validateRequest, async (req, res) => {
  try {
    const { start_date, end_date, project_id, format = 'json' } = req.query;

    if (project_id) {
      // Single project analysis
      const profitability = await calculateProjectProfitability(
        project_id as string, 
        start_date as string, 
        end_date as string
      );

      if (format === 'pdf') {
        return generateProjectProfitabilityPDF(res, profitability);
      } else if (format === 'excel') {
        return generateProjectProfitabilityExcel(res, profitability);
      } else if (format === 'csv') {
        return generateProjectProfitabilityCSV(res, profitability);
      }

      return res.json(profitability);
    }

    // All projects analysis
    const sheetsService = SheetsService.getInstance();
    const projects = await sheetsService.read('Projects');
    
    const profitabilityAnalysis = await Promise.all(
      projects.map(async (project) => {
        try {
          return await calculateProjectProfitability(
            project.id, 
            start_date as string, 
            end_date as string
          );
        } catch (error) {
          console.error(`Error calculating profitability for project ${project.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed calculations and sort by profit
    const validAnalysis = profitabilityAnalysis
      .filter(analysis => analysis !== null)
      .sort((a, b) => b!.profitability.profit - a!.profitability.profit);

    const summaryData = {
      period: {
        start_date: start_date || 'All time',
        end_date: end_date || 'All time'
      },
      summary: {
        total_projects: validAnalysis.length,
        profitable_projects: validAnalysis.filter(p => p!.profitability.profit > 0).length,
        total_revenue: validAnalysis.reduce((sum, p) => sum + p!.revenue.total, 0),
        total_costs: validAnalysis.reduce((sum, p) => sum + p!.costs.total, 0),
        total_profit: validAnalysis.reduce((sum, p) => sum + p!.profitability.profit, 0)
      },
      projects: validAnalysis,
      generated_at: new Date().toISOString()
    };

    // Handle different output formats
    if (format === 'pdf') {
      return generateAllProjectsProfitabilityPDF(res, summaryData);
    } else if (format === 'excel') {
      return generateAllProjectsProfitabilityExcel(res, summaryData);
    } else if (format === 'csv') {
      return generateAllProjectsProfitabilityCSV(res, summaryData);
    }

    res.json(summaryData);
  } catch (error) {
    console.error('Error generating project profitability report:', error);
    res.status(500).json({
      error: 'Failed to generate project profitability report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PDF Generation Functions (simplified implementations)
function generateProfitLossPDF(res: express.Response, data: any) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="profit-loss-report.pdf"');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Profit & Loss Statement', 50, 50);
  doc.fontSize(12).text(`Period: ${data.period.start_date} to ${data.period.end_date}`, 50, 80);
  
  doc.text(`Total Revenue: ₹${data.revenue.total_revenue.toLocaleString()}`, 50, 120);
  doc.text(`Total Expenses: ₹${data.expenses.total_expenses.toLocaleString()}`, 50, 140);
  doc.text(`Net Profit: ₹${data.profitability.net_profit.toLocaleString()}`, 50, 160);
  doc.text(`Profit Margin: ${data.profitability.profit_margin.toFixed(2)}%`, 50, 180);
  
  doc.end();
}

function generateExpenseSummaryPDF(res: express.Response, data: any) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="expense-summary-report.pdf"');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Expense Summary Report', 50, 50);
  doc.fontSize(12).text(`Period: ${data.period.start_date} to ${data.period.end_date}`, 50, 80);
  
  doc.text(`Total Amount: ₹${data.summary.total_amount.toLocaleString()}`, 50, 120);
  doc.text(`Total Count: ${data.summary.total_count}`, 50, 140);
  
  doc.end();
}

function generateRevenueAnalysisPDF(res: express.Response, data: any) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="revenue-analysis-report.pdf"');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Revenue Analysis Report', 50, 50);
  doc.fontSize(12).text(`Period: ${data.period.start_date} to ${data.period.end_date}`, 50, 80);
  
  doc.text(`Total Paid: ₹${data.summary.total_paid.toLocaleString()}`, 50, 120);
  doc.text(`Payment Rate: ${data.summary.payment_rate.toFixed(2)}%`, 50, 140);
  
  doc.end();
}

function generateProjectProfitabilityPDF(res: express.Response, data: any) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="project-profitability-report.pdf"');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Project Profitability Report', 50, 50);
  doc.fontSize(14).text(`Project: ${data.project.name}`, 50, 80);
  
  doc.text(`Total Revenue: ₹${data.revenue.total.toLocaleString()}`, 50, 120);
  doc.text(`Total Costs: ₹${data.costs.total.toLocaleString()}`, 50, 140);
  doc.text(`Profit: ₹${data.profitability.profit.toLocaleString()}`, 50, 160);
  doc.text(`Profit Margin: ${data.profitability.profit_margin.toFixed(2)}%`, 50, 180);
  
  doc.end();
}

function generateAllProjectsProfitabilityPDF(res: express.Response, data: any) {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="all-projects-profitability-report.pdf"');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('All Projects Profitability Report', 50, 50);
  doc.fontSize(12).text(`Period: ${data.period.start_date} to ${data.period.end_date}`, 50, 80);
  
  doc.text(`Total Projects: ${data.summary.total_projects}`, 50, 120);
  doc.text(`Profitable Projects: ${data.summary.profitable_projects}`, 50, 140);
  doc.text(`Total Profit: ₹${data.summary.total_profit.toLocaleString()}`, 50, 160);
  
  doc.end();
}

// Excel Generation Functions (simplified - would need xlsx library)
function generateProfitLossExcel(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="profit-loss-report.xlsx"');
  
  // Simplified Excel generation - would implement with xlsx library
  res.json({ message: 'Excel export not implemented yet', data });
}

function generateExpenseSummaryExcel(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="expense-summary-report.xlsx"');
  
  res.json({ message: 'Excel export not implemented yet', data });
}

function generateRevenueAnalysisExcel(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="revenue-analysis-report.xlsx"');
  
  res.json({ message: 'Excel export not implemented yet', data });
}

function generateProjectProfitabilityExcel(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="project-profitability-report.xlsx"');
  
  res.json({ message: 'Excel export not implemented yet', data });
}

function generateAllProjectsProfitabilityExcel(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="all-projects-profitability-report.xlsx"');
  
  res.json({ message: 'Excel export not implemented yet', data });
}

// CSV Generation Functions
function generateProfitLossCSV(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="profit-loss-report.csv"');
  
  const csv = [
    'Metric,Value',
    `Total Revenue,${data.revenue.total_revenue}`,
    `Total Expenses,${data.expenses.total_expenses}`,
    `Net Profit,${data.profitability.net_profit}`,
    `Profit Margin,${data.profitability.profit_margin}%`
  ].join('\n');
  
  res.send(csv);
}

function generateExpenseSummaryCSV(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="expense-summary-report.csv"');
  
  const csv = [
    'Category,Amount',
    ...Object.entries(data.by_category).map(([category, amount]) => `${category},${amount}`)
  ].join('\n');
  
  res.send(csv);
}

function generateRevenueAnalysisCSV(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="revenue-analysis-report.csv"');
  
  const csv = [
    'Month,Total Invoiced,Total Paid,Invoice Count,Payment Rate',
    ...data.monthly_trends.map((trend: any) => 
      `${trend.month},${trend.total_invoiced},${trend.total_paid},${trend.invoice_count},${trend.payment_rate}%`
    )
  ].join('\n');
  
  res.send(csv);
}

function generateProjectProfitabilityCSV(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="project-profitability-report.csv"');
  
  const csv = [
    'Metric,Value',
    `Project Name,${data.project.name}`,
    `Total Revenue,${data.revenue.total}`,
    `Total Costs,${data.costs.total}`,
    `Profit,${data.profitability.profit}`,
    `Profit Margin,${data.profitability.profit_margin}%`
  ].join('\n');
  
  res.send(csv);
}

function generateAllProjectsProfitabilityCSV(res: express.Response, data: any) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="all-projects-profitability-report.csv"');
  
  const csv = [
    'Project Name,Revenue,Costs,Profit,Profit Margin',
    ...data.projects.map((project: any) => 
      `${project.project.name},${project.revenue.total},${project.costs.total},${project.profitability.profit},${project.profitability.profit_margin}%`
    )
  ].join('\n');
  
  res.send(csv);
}

export default router;