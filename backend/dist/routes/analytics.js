"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Project_1 = require("../models/Project");
const Task_1 = require("../models/Task");
const TimeEntry_1 = require("../models/TimeEntry");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
router.use(auth_1.authenticateToken);
router.get('/projects/:id', [
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (projects.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        const project = new Project_1.Project(projects[0]);
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
        const taskInstances = tasks.map(t => new Task_1.Task(t));
        const timeEntryInstances = timeEntries.map(te => new TimeEntry_1.TimeEntry(te));
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length;
        const inProgressTasks = tasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS).length;
        const todoTasks = tasks.filter(t => t.status === types_1.TaskStatus.TODO).length;
        const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
        const billableHours = timeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + te.hours, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        project.updateProgress(taskInstances);
        project.updateActualCost(timeEntryInstances, expenses);
        const profitability = project.calculateProfitability(timeEntryInstances, expenses);
        const timeByTask = TimeEntry_1.TimeEntry.groupByProject(timeEntryInstances);
        const timeByDate = TimeEntry_1.TimeEntry.groupByDate(timeEntryInstances);
        const tasksByPriority = {
            high: tasks.filter(t => t.priority === 'high').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            low: tasks.filter(t => t.priority === 'low').length
        };
        const overdueTasks = taskInstances.filter(t => t.isOverdue()).length;
        const budgetUtilization = {
            budget: project.budget,
            actual_cost: project.actual_cost || 0,
            remaining: project.budget - (project.actual_cost || 0),
            utilization_percentage: project.budget > 0 ? ((project.actual_cost || 0) / project.budget) * 100 : 0,
            is_over_budget: project.isOverBudget(timeEntryInstances, expenses)
        };
        const startDate = new Date(project.start_date);
        const endDate = new Date(project.end_date);
        const now = new Date();
        const totalDuration = endDate.getTime() - startDate.getTime();
        const elapsed = now.getTime() - startDate.getTime();
        const timelineProgress = totalDuration > 0 ? Math.min((elapsed / totalDuration) * 100, 100) : 0;
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
                    hours: TimeEntry_1.TimeEntry.calculateTotalHours(timeByDate[date]),
                    entries: timeByDate[date].length
                })).sort((a, b) => a.date.localeCompare(b.date))
            },
            budget_analytics: budgetUtilization,
            profitability,
            timeline_analytics: {
                start_date: project.start_date,
                end_date: project.end_date,
                timeline_progress: Math.round(timelineProgress * 100) / 100,
                is_on_schedule: timelineProgress <= (project.progress_percentage || 0) + 10,
                estimated_vs_actual: estimatedVsActual
            },
            expense_analytics: {
                total_expenses: totalExpenses,
                expense_count: expenses.length,
                by_category: expenses.reduce((acc, expense) => {
                    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
                    return acc;
                }, {})
            }
        });
    }
    catch (error) {
        console.error('Get project analytics error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch project analytics'
        });
    }
});
router.get('/dashboard', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const dateFilters = [];
        if (start_date) {
            dateFilters.push({ column: 'created_at', operator: 'gte', value: start_date });
        }
        if (end_date) {
            dateFilters.push({ column: 'created_at', operator: 'lte', value: end_date });
        }
        let clientFilter = [];
        if (req.user?.role === 'client') {
            const clients = await sheetsService.query('Clients', {
                filters: [{ column: 'email', operator: 'eq', value: req.user.email }]
            });
            if (clients.length > 0) {
                clientFilter = [{ column: 'client_id', operator: 'eq', value: clients[0].id }];
            }
            else {
                return res.json({
                    projects: { total: 0, active: 0, completed: 0, on_hold: 0 },
                    tasks: { total: 0, completed: 0, in_progress: 0, todo: 0, overdue: 0 },
                    time: { total_hours: 0, billable_hours: 0, this_week: 0, this_month: 0 },
                    financial: { total_budget: 0, total_actual_cost: 0, total_profit: 0, profit_margin: 0 }
                });
            }
        }
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
        let filteredTasks = tasks;
        let filteredTimeEntries = timeEntries;
        let filteredExpenses = expenses;
        if (req.user?.role === 'client' && projects.length > 0) {
            const projectIds = projects.map(p => p.id);
            filteredTasks = tasks.filter(t => projectIds.includes(t.project_id));
            filteredTimeEntries = timeEntries.filter(te => projectIds.includes(te.project_id));
            filteredExpenses = expenses.filter(e => projectIds.includes(e.project_id));
        }
        const projectAnalytics = {
            total: projects.length,
            active: projects.filter(p => p.status === types_1.ProjectStatus.ACTIVE).length,
            completed: projects.filter(p => p.status === types_1.ProjectStatus.COMPLETED).length,
            on_hold: projects.filter(p => p.status === 'on-hold').length,
            overdue: projects.filter(p => {
                const project = new Project_1.Project(p);
                return project.isOverdue();
            }).length
        };
        const taskInstances = filteredTasks.map(t => new Task_1.Task(t));
        const taskAnalytics = {
            total: filteredTasks.length,
            completed: filteredTasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length,
            in_progress: filteredTasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS).length,
            todo: filteredTasks.filter(t => t.status === types_1.TaskStatus.TODO).length,
            overdue: taskInstances.filter(t => t.isOverdue()).length
        };
        const timeEntryInstances = filteredTimeEntries.map(te => new TimeEntry_1.TimeEntry(te));
        const totalHours = TimeEntry_1.TimeEntry.calculateTotalHours(timeEntryInstances);
        const billableHours = TimeEntry_1.TimeEntry.calculateTotalBillableHours(timeEntryInstances);
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisWeekEntries = timeEntryInstances.filter(te => te.isThisWeek());
        const thisMonthEntries = timeEntryInstances.filter(te => te.isThisMonth());
        const timeAnalytics = {
            total_hours: totalHours,
            billable_hours: billableHours,
            this_week: TimeEntry_1.TimeEntry.calculateTotalHours(thisWeekEntries),
            this_month: TimeEntry_1.TimeEntry.calculateTotalHours(thisMonthEntries),
            billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0
        };
        const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
        const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const totalActualCost = totalExpenseAmount + TimeEntry_1.TimeEntry.calculateTotalAmount(timeEntryInstances);
        const totalProfit = totalBudget - totalActualCost;
        const profitMargin = totalBudget > 0 ? (totalProfit / totalBudget) * 100 : 0;
        const financialAnalytics = {
            total_budget: totalBudget,
            total_actual_cost: totalActualCost,
            total_expenses: totalExpenseAmount,
            total_profit: totalProfit,
            profit_margin: profitMargin,
            projects_over_budget: projects.filter(p => {
                const project = new Project_1.Project(p);
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
    }
    catch (error) {
        console.error('Get dashboard analytics error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch dashboard analytics'
        });
    }
});
router.get('/time', ...validation_1.ValidationSets.queryWithPagination, async (req, res) => {
    try {
        const { start_date, end_date, project_id, group_by = 'date' } = req.query;
        const filters = [];
        if (start_date) {
            filters.push({ column: 'date', operator: 'gte', value: start_date });
        }
        if (end_date) {
            filters.push({ column: 'date', operator: 'lte', value: end_date });
        }
        if (project_id) {
            filters.push({ column: 'project_id', operator: 'eq', value: project_id });
        }
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
        const timeEntries = await sheetsService.query('Time_Entries', { filters });
        const timeEntryInstances = timeEntries.map(te => new TimeEntry_1.TimeEntry(te));
        let groupedData = {};
        switch (group_by) {
            case 'date':
                groupedData = TimeEntry_1.TimeEntry.groupByDate(timeEntryInstances);
                break;
            case 'project':
                groupedData = TimeEntry_1.TimeEntry.groupByProject(timeEntryInstances);
                break;
            default:
                groupedData = TimeEntry_1.TimeEntry.groupByDate(timeEntryInstances);
        }
        const analytics = await Promise.all(Object.keys(groupedData).map(async (key) => {
            const entries = groupedData[key];
            const totalHours = TimeEntry_1.TimeEntry.calculateTotalHours(entries);
            const billableHours = TimeEntry_1.TimeEntry.calculateTotalBillableHours(entries);
            const totalAmount = TimeEntry_1.TimeEntry.calculateTotalAmount(entries);
            let label = key;
            if (group_by === 'project') {
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
        }));
        analytics.sort((a, b) => {
            if (group_by === 'date') {
                return a.key.localeCompare(b.key);
            }
            return b.total_hours - a.total_hours;
        });
        const summary = {
            total_hours: TimeEntry_1.TimeEntry.calculateTotalHours(timeEntryInstances),
            billable_hours: TimeEntry_1.TimeEntry.calculateTotalBillableHours(timeEntryInstances),
            total_amount: TimeEntry_1.TimeEntry.calculateTotalAmount(timeEntryInstances),
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
    }
    catch (error) {
        console.error('Get time analytics error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch time analytics'
        });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map