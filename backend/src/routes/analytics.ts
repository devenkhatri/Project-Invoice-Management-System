import { Router, Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { ValidationSets } from '../middleware/validation';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { TimeEntry } from '../models/TimeEntry';
import { ProjectStatus, TaskStatus } from '../types';

const router = Router();
const sheetsService = SheetsService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get project analytics
 * GET /api/analytics/projects/:id
 */
router.get('/projects/:id', [
  ...ValidationSets.getById
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify project exists and user has access
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const project = new Project(projects[0]);

    // For client users, verify they own this project
    if (req.user?.role === 'client') {
      const clients = await sheetsService.query('Clients', {
        filters: [
          { column: 'id', operator: 'eq', value: project.client_id },
          { column: 'email', operator: 'eq', value: req.user.email }
        ]
      });

      if (clients.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this project'
        });
      }
    }

    // Get related data
    const [tasks, timeEntries, expenses] = await Promise.all([
      sheetsService.query('Tasks', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Time_Entries', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Expenses', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      })
    ]);

    const taskInstances = tasks.map(t => new Task(t));
    const timeEntryInstances = timeEntries.map(te => new TimeEntry(te));

    // Calculate basic metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const todoTasks = tasks.filter(t => t.status === TaskStatus.TODO).length;

    const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
    const billableHours = timeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + te.hours, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate progress and profitability
    project.updateProgress(taskInstances);
    project.updateActualCost(timeEntryInstances, expenses);
    const profitability = project.calculateProfitability(timeEntryInstances, expenses);

    // Time tracking analytics
    const timeByTask = TimeEntry.groupByProject(timeEntryInstances);
    const timeByDate = TimeEntry.groupByDate(timeEntryInstances);

    // Task completion analytics
    const tasksByPriority = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    };

    const overdueTasks = taskInstances.filter(t => t.isOverdue()).length;

    // Budget utilization
    const budgetUtilization = {
      budget: project.budget,
      actual_cost: project.actual_cost || 0,
      remaining: project.budget - (project.actual_cost || 0),
      utilization_percentage: project.budget > 0 ? ((project.actual_cost || 0) / project.budget) * 100 : 0,
      is_over_budget: project.isOverBudget(timeEntryInstances, expenses)
    };

    // Timeline analytics
    const startDate = new Date(project.start_date);
    const endDate = new Date(project.end_date);
    const now = new Date();
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const timelineProgress = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;

    // Productivity metrics
    const averageHoursPerTask = totalTasks > 0 ? totalHours / totalTasks : 0;
    const estimatedVsActual = {
      total_estimated: tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
      total_actual: tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0),
      variance_percentage: 0
    };

    if (estimatedVsActual.total_estimated > 0) {
      estimatedVsActual.variance_percentage = 
        ((estimatedVsActual.total_actual - estimatedVsActual.total_estimated) / estimatedVsActual.total_estimated) * 100;
    }

    return res.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        progress_percentage: project.progress_percentage,
        is_overdue: project.isOverdue(),
        days_remaining: project.getDaysRemaining()
      },
      task_analytics: {
        total: totalTasks,
        completed: completedTasks,
        in_progress: inProgressTasks,
        todo: todoTasks,
        overdue: overdueTasks,
        by_priority: tasksByPriority,
        completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      },
      time_analytics: {
        total_hours: totalHours,
        billable_hours: billableHours,
        non_billable_hours: totalHours - billableHours,
        average_hours_per_task: averageHoursPerTask,
        billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
        by_date: Object.keys(timeByDate).map(date => ({
          date,
          hours: TimeEntry.calculateTotalHours(timeByDate[date]),
          entries: timeByDate[date].length
        })).sort((a, b) => a.date.localeCompare(b.date))
      },
      budget_analytics: budgetUtilization,
      profitability,
      timeline_analytics: {
        start_date: project.start_date,
        end_date: project.end_date,
        timeline_progress: Math.round(timelineProgress * 100) / 100,
        is_on_schedule: timelineProgress <= (project.progress_percentage || 0) + 10, // 10% tolerance
        estimated_vs_actual: estimatedVsActual
      },
      expense_analytics: {
        total_expenses: totalExpenses,
        expense_count: expenses.length,
        by_category: expenses.reduce((acc, expense) => {
          acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Get project analytics error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project analytics'
    });
  }
});

/**
 * Get overall dashboard analytics
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Build date filters if provided
    const dateFilters: any[] = [];
    if (start_date) {
      dateFilters.push({ column: 'created_at', operator: 'gte', value: start_date });
    }
    if (end_date) {
      dateFilters.push({ column: 'created_at', operator: 'lte', value: end_date });
    }

    // For client users, only show their data
    let clientFilter: any[] = [];
    if (req.user?.role === 'client') {
      const clients = await sheetsService.query('Clients', {
        filters: [{ column: 'email', operator: 'eq', value: req.user.email }]
      });

      if (clients.length > 0) {
        clientFilter = [{ column: 'client_id', operator: 'eq', value: clients[0].id }];
      } else {
        // Client not found, return empty analytics
        return res.json({
          projects: { total: 0, active: 0, completed: 0, on_hold: 0 },
          tasks: { total: 0, completed: 0, in_progress: 0, todo: 0, overdue: 0 },
          time: { total_hours: 0, billable_hours: 0, this_week: 0, this_month: 0 },
          financial: { total_budget: 0, total_actual_cost: 0, total_profit: 0, profit_margin: 0 }
        });
      }
    }

    // Get all data
    const [projects, tasks, timeEntries, expenses] = await Promise.all([
      sheetsService.query('Projects', {
        filters: [...dateFilters, ...clientFilter]
      }),
      sheetsService.query('Tasks', {
        filters: dateFilters
      }),
      sheetsService.query('Time_Entries', {
        filters: dateFilters
      }),
      sheetsService.query('Expenses', {
        filters: dateFilters
      })
    ]);

    // Filter tasks and time entries for client projects if needed
    let filteredTasks = tasks;
    let filteredTimeEntries = timeEntries;
    let filteredExpenses = expenses;

    if (req.user?.role === 'client' && projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      filteredTasks = tasks.filter(t => projectIds.includes(t.project_id));
      filteredTimeEntries = timeEntries.filter(te => projectIds.includes(te.project_id));
      filteredExpenses = expenses.filter(e => projectIds.includes(e.project_id));
    }

    // Project analytics
    const projectAnalytics = {
      total: projects.length,
      active: projects.filter(p => p.status === ProjectStatus.ACTIVE).length,
      completed: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
      on_hold: projects.filter(p => p.status === 'on-hold').length,
      overdue: projects.filter(p => {
        const project = new Project(p);
        return project.isOverdue();
      }).length
    };

    // Task analytics
    const taskInstances = filteredTasks.map(t => new Task(t));
    const taskAnalytics = {
      total: filteredTasks.length,
      completed: filteredTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      in_progress: filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      todo: filteredTasks.filter(t => t.status === TaskStatus.TODO).length,
      overdue: taskInstances.filter(t => t.isOverdue()).length
    };

    // Time analytics
    const timeEntryInstances = filteredTimeEntries.map(te => new TimeEntry(te));
    const totalHours = TimeEntry.calculateTotalHours(timeEntryInstances);
    const billableHours = TimeEntry.calculateTotalBillableHours(timeEntryInstances);

    // Calculate this week and this month hours
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisWeekEntries = timeEntryInstances.filter(te => te.isThisWeek());
    const thisMonthEntries = timeEntryInstances.filter(te => te.isThisMonth());

    const timeAnalytics = {
      total_hours: totalHours,
      billable_hours: billableHours,
      this_week: TimeEntry.calculateTotalHours(thisWeekEntries),
      this_month: TimeEntry.calculateTotalHours(thisMonthEntries),
      billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0
    };

    // Financial analytics
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalActualCost = totalExpenseAmount + TimeEntry.calculateTotalAmount(timeEntryInstances);
    const totalProfit = totalBudget - totalActualCost;
    const profitMargin = totalBudget > 0 ? (totalProfit / totalBudget) * 100 : 0;

    const financialAnalytics = {
      total_budget: totalBudget,
      total_actual_cost: totalActualCost,
      total_expenses: totalExpenseAmount,
      total_profit: totalProfit,
      profit_margin: profitMargin,
      projects_over_budget: projects.filter(p => {
        const project = new Project(p);
        const projectTimeEntries = timeEntryInstances.filter(te => te.project_id === p.id);
        const projectExpenses = filteredExpenses.filter(e => e.project_id === p.id);
        return project.isOverBudget(projectTimeEntries, projectExpenses);
      }).length
    };

    return res.json({
      projects: projectAnalytics,
      tasks: taskAnalytics,
      time: timeAnalytics,
      financial: financialAnalytics,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard analytics'
    });
  }
});

/**
 * Get time tracking analytics
 * GET /api/analytics/time
 */
router.get('/time', ...ValidationSets.queryWithPagination, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, project_id, group_by = 'date' } = req.query;

    // Build filters
    const filters: any[] = [];

    if (start_date) {
      filters.push({ column: 'date', operator: 'gte', value: start_date });
    }

    if (end_date) {
      filters.push({ column: 'date', operator: 'lte', value: end_date });
    }

    if (project_id) {
      filters.push({ column: 'project_id', operator: 'eq', value: project_id });
    }

    // For client users, only show their time entries
    if (req.user?.role === 'client') {
      const clients = await sheetsService.query('Clients', {
        filters: [{ column: 'email', operator: 'eq', value: req.user.email }]
      });

      if (clients.length > 0) {
        const clientProjects = await sheetsService.query('Projects', {
          filters: [{ column: 'client_id', operator: 'eq', value: clients[0].id }]
        });

        const projectIds = clientProjects.map(p => p.id);
        if (projectIds.length === 0) {
          return res.json({
            analytics: [],
            summary: { total_hours: 0, billable_hours: 0, total_amount: 0 }
          });
        }

        if (!project_id) {
          filters.push({ column: 'project_id', operator: 'in', value: projectIds });
        }
      }
    }

    // Get time entries
    const timeEntries = await sheetsService.query('Time_Entries', { filters });
    const timeEntryInstances = timeEntries.map(te => new TimeEntry(te));

    // Group data based on group_by parameter
    let groupedData: Record<string, TimeEntry[]> = {};

    switch (group_by) {
      case 'date':
        groupedData = TimeEntry.groupByDate(timeEntryInstances);
        break;
      case 'project':
        groupedData = TimeEntry.groupByProject(timeEntryInstances);
        break;
      default:
        groupedData = TimeEntry.groupByDate(timeEntryInstances);
    }

    // Calculate analytics for each group
    const analytics = await Promise.all(
      Object.keys(groupedData).map(async (key) => {
        const entries = groupedData[key];
        const totalHours = TimeEntry.calculateTotalHours(entries);
        const billableHours = TimeEntry.calculateTotalBillableHours(entries);
        const totalAmount = TimeEntry.calculateTotalAmount(entries);

        let label = key;
        if (group_by === 'project') {
          // Get project name for better labeling
          const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: key }]
          });
          label = projects.length > 0 ? projects[0].name : key;
        }

        return {
          key,
          label,
          total_hours: totalHours,
          billable_hours: billableHours,
          non_billable_hours: totalHours - billableHours,
          total_amount: totalAmount,
          entry_count: entries.length,
          billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0
        };
      })
    );

    // Sort analytics
    analytics.sort((a, b) => {
      if (group_by === 'date') {
        return a.key.localeCompare(b.key);
      }
      return b.total_hours - a.total_hours; // Sort by hours descending for other groupings
    });

    // Calculate summary
    const summary = {
      total_hours: TimeEntry.calculateTotalHours(timeEntryInstances),
      billable_hours: TimeEntry.calculateTotalBillableHours(timeEntryInstances),
      total_amount: TimeEntry.calculateTotalAmount(timeEntryInstances),
      entry_count: timeEntries.length,
      unique_projects: new Set(timeEntries.map(te => te.project_id)).size,
      unique_tasks: new Set(timeEntries.map(te => te.task_id)).size
    };

    return res.json({
      analytics,
      summary,
      group_by,
      filters: {
        start_date,
        end_date,
        project_id
      }
    });
  } catch (error) {
    console.error('Get time analytics error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch time analytics'
    });
  }
});

export default router;