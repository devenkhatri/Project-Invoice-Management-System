"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const TimeEntry_1 = require("../models/TimeEntry");
const Task_1 = require("../models/Task");
const Project_1 = require("../models/Project");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
router.use(auth_1.authenticateToken);
router.post('/', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createTimeEntry
], async (req, res) => {
    try {
        const { task_id, project_id, hours, description, date, start_time, end_time, is_billable = true, hourly_rate } = req.body;
        const [tasks, projects] = await Promise.all([
            sheetsService.query('Tasks', {
                filters: [{ column: 'id', operator: 'eq', value: task_id }]
            }),
            sheetsService.query('Projects', {
                filters: [{ column: 'id', operator: 'eq', value: project_id }]
            })
        ]);
        if (tasks.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Task not found'
            });
        }
        if (projects.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Project not found'
            });
        }
        if (tasks[0].project_id !== project_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Task does not belong to the specified project'
            });
        }
        const timeEntryData = {
            id: (0, uuid_1.v4)(),
            task_id,
            project_id,
            hours,
            description,
            date,
            start_time,
            end_time,
            is_billable,
            hourly_rate: hourly_rate || tasks[0].hourly_rate || projects[0].hourly_rate,
            user_id: req.user?.id
        };
        const timeEntry = new TimeEntry_1.TimeEntry(timeEntryData);
        if (!timeEntry.isValidTimeRange()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid time range: end time must be after start time'
            });
        }
        await sheetsService.create('Time_Entries', timeEntry.toJSON());
        const task = new Task_1.Task(tasks[0]);
        task.addTimeEntry(hours);
        await sheetsService.update('Tasks', task_id, {
            actual_hours: task.actual_hours,
            status: task.status,
            updated_at: new Date().toISOString()
        });
        const allTimeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'project_id', operator: 'eq', value: project_id }]
        });
        const expenses = await sheetsService.query('Expenses', {
            filters: [{ column: 'project_id', operator: 'eq', value: project_id }]
        });
        const project = new Project_1.Project(projects[0]);
        project.updateActualCost(allTimeEntries.map(te => new TimeEntry_1.TimeEntry(te)), expenses);
        await sheetsService.update('Projects', project_id, {
            actual_cost: project.actual_cost,
            updated_at: new Date().toISOString()
        });
        console.log(`✅ Time entry created successfully: ${hours}h for task ${task.title}`);
        return res.status(201).json({
            message: 'Time entry created successfully',
            time_entry: timeEntry.toJSON()
        });
    }
    catch (error) {
        console.error('Create time entry error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to create time entry'
        });
    }
});
router.get('/', ...validation_1.ValidationSets.queryWithPagination, async (req, res) => {
    try {
        const { page = 1, limit = 10, project_id, task_id, start_date, end_date, is_billable, user_id, sort_by = 'date', sort_order = 'desc' } = req.query;
        const filters = [];
        if (project_id) {
            filters.push({ column: 'project_id', operator: 'eq', value: project_id });
        }
        if (task_id) {
            filters.push({ column: 'task_id', operator: 'eq', value: task_id });
        }
        if (start_date) {
            filters.push({ column: 'date', operator: 'gte', value: start_date });
        }
        if (end_date) {
            filters.push({ column: 'date', operator: 'lte', value: end_date });
        }
        if (is_billable !== undefined) {
            filters.push({ column: 'is_billable', operator: 'eq', value: is_billable === 'true' });
        }
        if (user_id) {
            filters.push({ column: 'user_id', operator: 'eq', value: user_id });
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
                        time_entries: [],
                        pagination: {
                            page: Number(page),
                            limit: Number(limit),
                            total: 0,
                            totalPages: 0
                        },
                        summary: {
                            total_hours: 0,
                            billable_hours: 0,
                            total_amount: 0
                        }
                    });
                }
                if (!project_id) {
                    filters.push({ column: 'project_id', operator: 'in', value: projectIds });
                }
            }
        }
        const offset = (Number(page) - 1) * Number(limit);
        const timeEntries = await sheetsService.query('Time_Entries', {
            filters,
            sortBy: sort_by,
            sortOrder: sort_order,
            limit: Number(limit),
            offset
        });
        const totalEntries = await sheetsService.query('Time_Entries', { filters });
        const totalPages = Math.ceil(totalEntries.length / Number(limit));
        const enhancedEntries = await Promise.all(timeEntries.map(async (entryData) => {
            const timeEntry = new TimeEntry_1.TimeEntry(entryData);
            const [task, project] = await Promise.all([
                sheetsService.query('Tasks', {
                    filters: [{ column: 'id', operator: 'eq', value: timeEntry.task_id }]
                }),
                sheetsService.query('Projects', {
                    filters: [{ column: 'id', operator: 'eq', value: timeEntry.project_id }]
                })
            ]);
            return {
                ...timeEntry.toJSON(),
                task: task[0] || null,
                project: project[0] || null,
                formatted_duration: timeEntry.getFormattedDuration(),
                formatted_time_range: timeEntry.getFormattedTimeRange(),
                formatted_date: timeEntry.getFormattedDate(),
                is_billed: timeEntry.isBilled()
            };
        }));
        const summary = {
            total_hours: TimeEntry_1.TimeEntry.calculateTotalHours(timeEntries.map(te => new TimeEntry_1.TimeEntry(te))),
            billable_hours: TimeEntry_1.TimeEntry.calculateTotalBillableHours(timeEntries.map(te => new TimeEntry_1.TimeEntry(te))),
            total_amount: TimeEntry_1.TimeEntry.calculateTotalAmount(timeEntries.map(te => new TimeEntry_1.TimeEntry(te)))
        };
        return res.json({
            time_entries: enhancedEntries,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalEntries.length,
                totalPages
            },
            summary
        });
    }
    catch (error) {
        console.error('Get time entries error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch time entries'
        });
    }
});
router.put('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.createTimeEntry
], async (req, res) => {
    try {
        const { id } = req.params;
        const timeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (timeEntries.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Time entry not found'
            });
        }
        const existingEntry = timeEntries[0];
        if (existingEntry.invoice_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot update billed time entry'
            });
        }
        const updatedData = {
            ...existingEntry,
            ...req.body,
            updated_at: new Date().toISOString()
        };
        const timeEntry = new TimeEntry_1.TimeEntry(updatedData);
        if (!timeEntry.isValidTimeRange()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid time range: end time must be after start time'
            });
        }
        const success = await sheetsService.update('Time_Entries', id, timeEntry.toJSON());
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Time entry not found'
            });
        }
        if (req.body.hours && req.body.hours !== existingEntry.hours) {
            const tasks = await sheetsService.query('Tasks', {
                filters: [{ column: 'id', operator: 'eq', value: timeEntry.task_id }]
            });
            if (tasks.length > 0) {
                const task = new Task_1.Task(tasks[0]);
                const hoursDiff = req.body.hours - existingEntry.hours;
                task.addTimeEntry(hoursDiff);
                await sheetsService.update('Tasks', task.id, {
                    actual_hours: task.actual_hours,
                    updated_at: new Date().toISOString()
                });
            }
        }
        const allTimeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'project_id', operator: 'eq', value: timeEntry.project_id }]
        });
        const expenses = await sheetsService.query('Expenses', {
            filters: [{ column: 'project_id', operator: 'eq', value: timeEntry.project_id }]
        });
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: timeEntry.project_id }]
        });
        if (projects.length > 0) {
            const project = new Project_1.Project(projects[0]);
            project.updateActualCost(allTimeEntries.map(te => new TimeEntry_1.TimeEntry(te)), expenses);
            await sheetsService.update('Projects', timeEntry.project_id, {
                actual_cost: project.actual_cost,
                updated_at: new Date().toISOString()
            });
        }
        console.log(`✅ Time entry updated successfully: ${timeEntry.hours}h (${timeEntry.id})`);
        return res.json({
            message: 'Time entry updated successfully',
            time_entry: timeEntry.toJSON()
        });
    }
    catch (error) {
        console.error('Update time entry error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to update time entry'
        });
    }
});
router.delete('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const timeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (timeEntries.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Time entry not found'
            });
        }
        const timeEntry = timeEntries[0];
        if (timeEntry.invoice_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot delete billed time entry'
            });
        }
        const success = await sheetsService.delete('Time_Entries', id);
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Time entry not found'
            });
        }
        const tasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'id', operator: 'eq', value: timeEntry.task_id }]
        });
        if (tasks.length > 0) {
            const task = new Task_1.Task(tasks[0]);
            task.addTimeEntry(-timeEntry.hours);
            await sheetsService.update('Tasks', task.id, {
                actual_hours: Math.max(0, task.actual_hours),
                updated_at: new Date().toISOString()
            });
        }
        const allTimeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'project_id', operator: 'eq', value: timeEntry.project_id }]
        });
        const expenses = await sheetsService.query('Expenses', {
            filters: [{ column: 'project_id', operator: 'eq', value: timeEntry.project_id }]
        });
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: timeEntry.project_id }]
        });
        if (projects.length > 0) {
            const project = new Project_1.Project(projects[0]);
            project.updateActualCost(allTimeEntries.map(te => new TimeEntry_1.TimeEntry(te)), expenses);
            await sheetsService.update('Projects', timeEntry.project_id, {
                actual_cost: project.actual_cost,
                updated_at: new Date().toISOString()
            });
        }
        console.log(`✅ Time entry deleted successfully: ${timeEntry.hours}h (${timeEntry.id})`);
        return res.json({
            message: 'Time entry deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete time entry error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete time entry'
        });
    }
});
exports.default = router;
//# sourceMappingURL=time-entries.js.map