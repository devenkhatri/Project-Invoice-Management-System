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
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
router.use(auth_1.authenticateToken);
router.get('/', ...validation_1.ValidationSets.queryWithPagination, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, client_id, start_date, end_date, sort_by = 'created_at', sort_order = 'desc' } = req.query;
        const filters = [];
        if (status) {
            filters.push({ column: 'status', operator: 'eq', value: status });
        }
        if (client_id) {
            filters.push({ column: 'client_id', operator: 'eq', value: client_id });
        }
        if (start_date) {
            filters.push({ column: 'start_date', operator: 'gte', value: start_date });
        }
        if (end_date) {
            filters.push({ column: 'end_date', operator: 'lte', value: end_date });
        }
        if (req.user?.role === 'client') {
            const clients = await sheetsService.query('Clients', {
                filters: [{ column: 'email', operator: 'eq', value: req.user.email }]
            });
            if (clients.length > 0) {
                filters.push({ column: 'client_id', operator: 'eq', value: clients[0].id });
            }
            else {
                return res.json({
                    projects: [],
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: 0,
                        totalPages: 0
                    }
                });
            }
        }
        const offset = (Number(page) - 1) * Number(limit);
        const projects = await sheetsService.query('Projects', {
            filters,
            sortBy: sort_by,
            sortOrder: sort_order,
            limit: Number(limit),
            offset
        });
        const totalProjects = await sheetsService.query('Projects', { filters });
        const totalPages = Math.ceil(totalProjects.length / Number(limit));
        const enhancedProjects = await Promise.all(projects.map(async (projectData) => {
            const project = new Project_1.Project(projectData);
            const tasks = await sheetsService.query('Tasks', {
                filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
            });
            const timeEntries = await sheetsService.query('Time_Entries', {
                filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
            });
            const expenses = await sheetsService.query('Expenses', {
                filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
            });
            project.updateProgress(tasks.map(t => new Task_1.Task(t)));
            project.updateActualCost(timeEntries.map(te => new TimeEntry_1.TimeEntry(te)), expenses);
            return {
                ...project.toJSON(),
                task_count: tasks.length,
                completed_tasks: tasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length,
                total_hours: timeEntries.reduce((sum, te) => sum + te.hours, 0),
                is_overdue: project.isOverdue(),
                days_remaining: project.getDaysRemaining()
            };
        }));
        return res.json({
            projects: enhancedProjects,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalProjects.length,
                totalPages
            }
        });
    }
    catch (error) {
        console.error('Get projects error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch projects'
        });
    }
});
router.post('/', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createProject
], async (req, res) => {
    try {
        const projectData = {
            ...req.body,
            id: (0, uuid_1.v4)(),
            status: req.body.status || types_1.ProjectStatus.ACTIVE,
            currency: req.body.currency || 'INR',
            is_billable: req.body.is_billable !== undefined ? req.body.is_billable : true,
            progress_percentage: 0
        };
        const clients = await sheetsService.query('Clients', {
            filters: [{ column: 'id', operator: 'eq', value: projectData.client_id }]
        });
        if (clients.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Client not found'
            });
        }
        const project = new Project_1.Project(projectData);
        await sheetsService.create('Projects', project.toJSON());
        console.log(`✅ Project created successfully: ${project.name} (${project.id})`);
        return res.status(201).json({
            message: 'Project created successfully',
            project: project.toJSON()
        });
    }
    catch (error) {
        console.error('Create project error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to create project'
        });
    }
});
router.get('/:id', [
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('project')
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
        const [tasks, timeEntries, expenses, client] = await Promise.all([
            sheetsService.query('Tasks', {
                filters: [{ column: 'project_id', operator: 'eq', value: id }],
                sortBy: 'created_at',
                sortOrder: 'asc'
            }),
            sheetsService.query('Time_Entries', {
                filters: [{ column: 'project_id', operator: 'eq', value: id }]
            }),
            sheetsService.query('Expenses', {
                filters: [{ column: 'project_id', operator: 'eq', value: id }]
            }),
            sheetsService.query('Clients', {
                filters: [{ column: 'id', operator: 'eq', value: project.client_id }]
            })
        ]);
        const taskInstances = tasks.map(t => new Task_1.Task(t));
        const timeEntryInstances = timeEntries.map(te => new TimeEntry_1.TimeEntry(te));
        project.updateProgress(taskInstances);
        project.updateActualCost(timeEntryInstances, expenses);
        const profitability = project.calculateProfitability(timeEntryInstances, expenses);
        const tasksByStatus = {
            todo: tasks.filter(t => t.status === types_1.TaskStatus.TODO),
            'in-progress': tasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS),
            completed: tasks.filter(t => t.status === types_1.TaskStatus.COMPLETED)
        };
        return res.json({
            project: {
                ...project.toJSON(),
                client: client[0] || null,
                is_overdue: project.isOverdue(),
                days_remaining: project.getDaysRemaining(),
                profitability
            },
            tasks: {
                all: tasks,
                by_status: tasksByStatus,
                total: tasks.length,
                completed: tasks.filter(t => t.status === types_1.TaskStatus.COMPLETED).length
            },
            time_entries: {
                entries: timeEntries,
                total_hours: timeEntries.reduce((sum, te) => sum + te.hours, 0),
                billable_hours: timeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + te.hours, 0)
            },
            expenses: {
                entries: expenses,
                total_amount: expenses.reduce((sum, e) => sum + e.amount, 0)
            }
        });
    }
    catch (error) {
        console.error('Get project error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch project'
        });
    }
});
router.put('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.updateProject,
    (0, auth_1.authorizeResourceAccess)('project')
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
        const existingProject = projects[0];
        if (req.body.client_id && req.body.client_id !== existingProject.client_id) {
            const clients = await sheetsService.query('Clients', {
                filters: [{ column: 'id', operator: 'eq', value: req.body.client_id }]
            });
            if (clients.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Client not found'
                });
            }
        }
        const updatedData = {
            ...existingProject,
            ...req.body,
            updated_at: new Date().toISOString()
        };
        const project = new Project_1.Project(updatedData);
        const success = await sheetsService.update('Projects', id, project.toJSON());
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        if (req.body.status === types_1.ProjectStatus.COMPLETED && existingProject.status !== types_1.ProjectStatus.COMPLETED) {
            const incompleteTasks = await sheetsService.query('Tasks', {
                filters: [
                    { column: 'project_id', operator: 'eq', value: id },
                    { column: 'status', operator: 'ne', value: types_1.TaskStatus.COMPLETED }
                ]
            });
            for (const task of incompleteTasks) {
                await sheetsService.update('Tasks', task.id, {
                    status: types_1.TaskStatus.COMPLETED,
                    updated_at: new Date().toISOString()
                });
            }
        }
        console.log(`✅ Project updated successfully: ${project.name} (${project.id})`);
        return res.json({
            message: 'Project updated successfully',
            project: project.toJSON()
        });
    }
    catch (error) {
        console.error('Update project error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to update project'
        });
    }
});
router.delete('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('project')
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
        const project = projects[0];
        const [invoices, timeEntries] = await Promise.all([
            sheetsService.query('Invoices', {
                filters: [{ column: 'project_id', operator: 'eq', value: id }]
            }),
            sheetsService.query('Time_Entries', {
                filters: [{ column: 'project_id', operator: 'eq', value: id }]
            })
        ]);
        const paidInvoices = invoices.filter(inv => inv.status === 'paid');
        if (paidInvoices.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot delete project with paid invoices. Archive the project instead.',
                dependencies: {
                    paid_invoices: paidInvoices.length
                }
            });
        }
        const success = await sheetsService.update('Projects', id, {
            status: 'archived',
            updated_at: new Date().toISOString()
        });
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        const tasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'project_id', operator: 'eq', value: id }]
        });
        for (const task of tasks) {
            await sheetsService.update('Tasks', task.id, {
                status: 'archived',
                updated_at: new Date().toISOString()
            });
        }
        console.log(`✅ Project archived successfully: ${project.name} (${project.id})`);
        return res.json({
            message: 'Project archived successfully',
            archived_items: {
                project: 1,
                tasks: tasks.length
            },
            dependencies: {
                invoices: invoices.length,
                time_entries: timeEntries.length,
                paid_invoices: paidInvoices.length
            }
        });
    }
    catch (error) {
        console.error('Delete project error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete project'
        });
    }
});
router.get('/:id/tasks', [
    ...validation_1.ValidationSets.getById,
    (0, auth_1.authorizeResourceAccess)('project')
], async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, sort_by = 'created_at', sort_order = 'asc' } = req.query;
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (projects.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        const filters = [
            { column: 'project_id', operator: 'eq', value: id }
        ];
        if (status) {
            filters.push({ column: 'status', operator: 'eq', value: status });
        }
        if (priority) {
            filters.push({ column: 'priority', operator: 'eq', value: priority });
        }
        const tasks = await sheetsService.query('Tasks', {
            filters,
            sortBy: sort_by,
            sortOrder: sort_order
        });
        const enhancedTasks = await Promise.all(tasks.map(async (taskData) => {
            const task = new Task_1.Task(taskData);
            const timeEntries = await sheetsService.query('Time_Entries', {
                filters: [{ column: 'task_id', operator: 'eq', value: task.id }]
            });
            const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
            const billableAmount = task.calculateBillableAmount();
            const variance = task.calculateVariance();
            return {
                ...task.toJSON(),
                total_logged_hours: totalHours,
                billable_amount: billableAmount,
                variance,
                is_overdue: task.isOverdue(),
                days_remaining: task.getDaysRemaining(),
                completion_percentage: task.getCompletionPercentage()
            };
        }));
        const tasksByStatus = {
            todo: enhancedTasks.filter(t => t.status === types_1.TaskStatus.TODO),
            'in-progress': enhancedTasks.filter(t => t.status === types_1.TaskStatus.IN_PROGRESS),
            completed: enhancedTasks.filter(t => t.status === types_1.TaskStatus.COMPLETED)
        };
        return res.json({
            tasks: enhancedTasks,
            summary: {
                total: enhancedTasks.length,
                by_status: {
                    todo: tasksByStatus.todo.length,
                    'in-progress': tasksByStatus['in-progress'].length,
                    completed: tasksByStatus.completed.length
                },
                by_priority: {
                    high: enhancedTasks.filter(t => t.priority === types_1.TaskPriority.HIGH).length,
                    medium: enhancedTasks.filter(t => t.priority === types_1.TaskPriority.MEDIUM).length,
                    low: enhancedTasks.filter(t => t.priority === types_1.TaskPriority.LOW).length
                },
                overdue: enhancedTasks.filter(t => t.is_overdue).length
            }
        });
    }
    catch (error) {
        console.error('Get project tasks error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch project tasks'
        });
    }
});
router.post('/:id/tasks', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createTask,
    (0, auth_1.authorizeResourceAccess)('project')
], async (req, res) => {
    try {
        const { id: projectId } = req.params;
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: projectId }]
        });
        if (projects.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Project not found'
            });
        }
        const taskData = {
            ...req.body,
            id: (0, uuid_1.v4)(),
            project_id: projectId,
            status: req.body.status || types_1.TaskStatus.TODO,
            priority: req.body.priority || types_1.TaskPriority.MEDIUM,
            actual_hours: 0,
            is_billable: req.body.is_billable !== undefined ? req.body.is_billable : true
        };
        const task = new Task_1.Task(taskData);
        await sheetsService.create('Tasks', task.toJSON());
        const allTasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'project_id', operator: 'eq', value: projectId }]
        });
        const project = new Project_1.Project(projects[0]);
        project.updateProgress(allTasks.map(t => new Task_1.Task(t)));
        await sheetsService.update('Projects', projectId, {
            progress_percentage: project.progress_percentage,
            updated_at: new Date().toISOString()
        });
        console.log(`✅ Task created successfully: ${task.title} (${task.id})`);
        return res.status(201).json({
            message: 'Task created successfully',
            task: task.toJSON()
        });
    }
    catch (error) {
        console.error('Create task error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to create task'
        });
    }
});
exports.default = router;
//# sourceMappingURL=projects.js.map