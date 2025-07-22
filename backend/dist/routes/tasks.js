"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTaskRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Task_1 = require("../models/Task");
const TimeEntry_1 = require("../models/TimeEntry");
const types_1 = require("../models/types");
const router = (0, express_1.Router)();
let sheetsService;
const initializeTaskRoutes = (sheets) => {
    sheetsService = sheets;
    return router;
};
exports.initializeTaskRoutes = initializeTaskRoutes;
router.get('/project/:projectId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status, priority } = req.query;
        let filters = [{ field: 'project_id', operator: 'eq', value: projectId }];
        if (status) {
            filters.push({ field: 'status', operator: 'eq', value: status });
        }
        if (priority) {
            filters.push({ field: 'priority', operator: 'eq', value: priority });
        }
        const tasksData = await sheetsService.query('Tasks', filters);
        const tasks = tasksData.map(data => Task_1.Task.fromSheetRow(data));
        tasks.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
        res.json({
            tasks: tasks.map(t => t.toSheetRow()),
            total: tasks.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get project tasks error:', error);
        res.status(500).json({
            error: 'Failed to fetch project tasks',
            code: 'FETCH_PROJECT_TASKS_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tasksData = await sheetsService.read('Tasks', id);
        if (tasksData.length === 0) {
            res.status(404).json({
                error: 'Task not found',
                code: 'TASK_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const task = Task_1.Task.fromSheetRow(tasksData[0]);
        const timeEntriesData = await sheetsService.query('Time_Entries', [
            { field: 'task_id', operator: 'eq', value: id }
        ]);
        const timeEntries = timeEntriesData.map(data => TimeEntry_1.TimeEntry.fromSheetRow(data));
        timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
        res.json({
            task: task.toSheetRow(),
            timeEntries: timeEntries.map(te => te.toSheetRow()),
            stats: {
                totalTimeEntries: timeEntries.length,
                totalHours: TimeEntry_1.TimeEntry.calculateTotalHours(timeEntries),
                progress: task.getProgressPercentage(),
                remainingHours: task.getRemainingHours(),
                isOverdue: task.isOverdue(),
                isOverBudget: task.isOverBudget()
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            error: 'Failed to fetch task',
            code: 'FETCH_TASK_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/project/:projectId', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { projectId } = req.params;
        const projectData = await sheetsService.read('Projects', projectId);
        if (projectData.length === 0) {
            res.status(404).json({
                error: 'Project not found',
                code: 'PROJECT_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const taskData = {
            ...req.body,
            project_id: projectId,
            due_date: new Date(req.body.due_date)
        };
        const task = new Task_1.Task(taskData);
        const validation = task.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        const id = await sheetsService.create('Tasks', task.toSheetRow());
        task.id = id;
        res.status(201).json({
            message: 'Task created successfully',
            task: task.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            error: 'Failed to create task',
            code: 'CREATE_TASK_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.put('/:id', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Tasks', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Task not found',
                code: 'TASK_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const existingTask = Task_1.Task.fromSheetRow(existingData[0]);
        const updateData = { ...req.body };
        if (updateData.due_date)
            updateData.due_date = new Date(updateData.due_date);
        const updatedTask = new Task_1.Task({
            ...existingTask,
            ...updateData,
            id,
            updated_at: new Date()
        });
        const validation = updatedTask.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        await sheetsService.update('Tasks', id, updatedTask.toSheetRow());
        res.json({
            message: 'Task updated successfully',
            task: updatedTask.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            error: 'Failed to update task',
            code: 'UPDATE_TASK_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Tasks', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Task not found',
                code: 'TASK_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const timeEntries = await sheetsService.query('Time_Entries', [
            { field: 'task_id', operator: 'eq', value: id }
        ]);
        for (const entry of timeEntries) {
            await sheetsService.delete('Time_Entries', entry.id);
        }
        await sheetsService.delete('Tasks', id);
        res.json({
            message: 'Task deleted successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            error: 'Failed to delete task',
            code: 'DELETE_TASK_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.patch('/:id/status', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!Object.values(types_1.TaskStatus).includes(status)) {
            res.status(400).json({
                error: 'Invalid task status',
                code: 'INVALID_STATUS',
                validStatuses: Object.values(types_1.TaskStatus),
                timestamp: new Date().toISOString()
            });
            return;
        }
        const existingData = await sheetsService.read('Tasks', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Task not found',
                code: 'TASK_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const task = Task_1.Task.fromSheetRow(existingData[0]);
        task.status = status;
        task.updated_at = new Date();
        await sheetsService.update('Tasks', id, task.toSheetRow());
        res.json({
            message: 'Task status updated successfully',
            task: task.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({
            error: 'Failed to update task status',
            code: 'UPDATE_TASK_STATUS_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map