"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeTimeEntryRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const TimeEntry_1 = require("../models/TimeEntry");
const Task_1 = require("../models/Task");
const router = (0, express_1.Router)();
let sheetsService;
const initializeTimeEntryRoutes = (sheets) => {
    sheetsService = sheets;
    return router;
};
exports.initializeTimeEntryRoutes = initializeTimeEntryRoutes;
router.get('/project/:projectId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { startDate, endDate, taskId } = req.query;
        let filters = [{ field: 'project_id', operator: 'eq', value: projectId }];
        if (taskId) {
            filters.push({ field: 'task_id', operator: 'eq', value: taskId });
        }
        const timeEntriesData = await sheetsService.query('Time_Entries', filters);
        let timeEntries = timeEntriesData.map(data => TimeEntry_1.TimeEntry.fromSheetRow(data));
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            timeEntries = TimeEntry_1.TimeEntry.filterByDateRange(timeEntries, start, end);
        }
        timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
        const totalHours = TimeEntry_1.TimeEntry.calculateTotalHours(timeEntries);
        const groupedByDate = TimeEntry_1.TimeEntry.groupByDate(timeEntries);
        res.json({
            timeEntries: timeEntries.map(te => te.toSheetRow()),
            total: timeEntries.length,
            totalHours,
            groupedByDate: Object.fromEntries(Array.from(groupedByDate.entries()).map(([date, entries]) => [
                date,
                {
                    entries: entries.map(te => te.toSheetRow()),
                    totalHours: TimeEntry_1.TimeEntry.calculateTotalHours(entries)
                }
            ])),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get project time entries error:', error);
        res.status(500).json({
            error: 'Failed to fetch project time entries',
            code: 'FETCH_PROJECT_TIME_ENTRIES_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/task/:taskId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { startDate, endDate } = req.query;
        const timeEntriesData = await sheetsService.query('Time_Entries', [
            { field: 'task_id', operator: 'eq', value: taskId }
        ]);
        let timeEntries = timeEntriesData.map(data => TimeEntry_1.TimeEntry.fromSheetRow(data));
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            timeEntries = TimeEntry_1.TimeEntry.filterByDateRange(timeEntries, start, end);
        }
        timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
        const totalHours = TimeEntry_1.TimeEntry.calculateTotalHours(timeEntries);
        res.json({
            timeEntries: timeEntries.map(te => te.toSheetRow()),
            total: timeEntries.length,
            totalHours,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get task time entries error:', error);
        res.status(500).json({
            error: 'Failed to fetch task time entries',
            code: 'FETCH_TASK_TIME_ENTRIES_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/summary', auth_1.authenticateToken, async (req, res) => {
    try {
        const { projectId, startDate, endDate } = req.query;
        let filters = [];
        if (projectId) {
            filters.push({ field: 'project_id', operator: 'eq', value: projectId });
        }
        const timeEntriesData = filters.length > 0
            ? await sheetsService.query('Time_Entries', filters)
            : await sheetsService.read('Time_Entries');
        let timeEntries = timeEntriesData.map(data => TimeEntry_1.TimeEntry.fromSheetRow(data));
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            timeEntries = TimeEntry_1.TimeEntry.filterByDateRange(timeEntries, start, end);
        }
        const totalHours = TimeEntry_1.TimeEntry.calculateTotalHours(timeEntries);
        const totalEntries = timeEntries.length;
        const projectSummary = new Map();
        timeEntries.forEach(entry => {
            const current = projectSummary.get(entry.project_id) || { hours: 0, entries: 0 };
            current.hours += entry.hours;
            current.entries += 1;
            projectSummary.set(entry.project_id, current);
        });
        const dailySummary = new Map();
        timeEntries.forEach(entry => {
            const dateKey = entry.date.toDateString();
            dailySummary.set(dateKey, (dailySummary.get(dateKey) || 0) + entry.hours);
        });
        res.json({
            summary: {
                totalHours,
                totalEntries,
                averageHoursPerDay: totalHours / Math.max(1, dailySummary.size),
                projectBreakdown: Object.fromEntries(projectSummary),
                dailyBreakdown: Object.fromEntries(dailySummary)
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get time tracking summary error:', error);
        res.status(500).json({
            error: 'Failed to fetch time tracking summary',
            code: 'FETCH_TIME_SUMMARY_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const timeEntriesData = await sheetsService.read('Time_Entries', id);
        if (timeEntriesData.length === 0) {
            res.status(404).json({
                error: 'Time entry not found',
                code: 'TIME_ENTRY_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const timeEntry = TimeEntry_1.TimeEntry.fromSheetRow(timeEntriesData[0]);
        res.json({
            timeEntry: timeEntry.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get time entry error:', error);
        res.status(500).json({
            error: 'Failed to fetch time entry',
            code: 'FETCH_TIME_ENTRY_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/task/:taskId', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { taskId } = req.params;
        const taskData = await sheetsService.read('Tasks', taskId);
        if (taskData.length === 0) {
            res.status(404).json({
                error: 'Task not found',
                code: 'TASK_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const task = Task_1.Task.fromSheetRow(taskData[0]);
        const timeEntryData = {
            ...req.body,
            task_id: taskId,
            project_id: task.project_id,
            date: new Date(req.body.date || new Date())
        };
        const timeEntry = new TimeEntry_1.TimeEntry(timeEntryData);
        const validation = timeEntry.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        const id = await sheetsService.create('Time_Entries', timeEntry.toSheetRow());
        timeEntry.id = id;
        task.addTimeEntry(timeEntry.hours);
        await sheetsService.update('Tasks', taskId, task.toSheetRow());
        res.status(201).json({
            message: 'Time entry created successfully',
            timeEntry: timeEntry.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Create time entry error:', error);
        res.status(500).json({
            error: 'Failed to create time entry',
            code: 'CREATE_TIME_ENTRY_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.put('/:id', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Time_Entries', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Time entry not found',
                code: 'TIME_ENTRY_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const existingTimeEntry = TimeEntry_1.TimeEntry.fromSheetRow(existingData[0]);
        const oldHours = existingTimeEntry.hours;
        const updateData = { ...req.body };
        if (updateData.date)
            updateData.date = new Date(updateData.date);
        const updatedTimeEntry = new TimeEntry_1.TimeEntry({
            ...existingTimeEntry,
            ...updateData,
            id,
            updated_at: new Date()
        });
        const validation = updatedTimeEntry.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        await sheetsService.update('Time_Entries', id, updatedTimeEntry.toSheetRow());
        if (updatedTimeEntry.hours !== oldHours) {
            const taskData = await sheetsService.read('Tasks', updatedTimeEntry.task_id);
            if (taskData.length > 0) {
                const task = Task_1.Task.fromSheetRow(taskData[0]);
                task.actual_hours = task.actual_hours - oldHours + updatedTimeEntry.hours;
                task.updated_at = new Date();
                await sheetsService.update('Tasks', task.id, task.toSheetRow());
            }
        }
        res.json({
            message: 'Time entry updated successfully',
            timeEntry: updatedTimeEntry.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Update time entry error:', error);
        res.status(500).json({
            error: 'Failed to update time entry',
            code: 'UPDATE_TIME_ENTRY_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Time_Entries', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Time entry not found',
                code: 'TIME_ENTRY_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const timeEntry = TimeEntry_1.TimeEntry.fromSheetRow(existingData[0]);
        const taskData = await sheetsService.read('Tasks', timeEntry.task_id);
        if (taskData.length > 0) {
            const task = Task_1.Task.fromSheetRow(taskData[0]);
            task.actual_hours = Math.max(0, task.actual_hours - timeEntry.hours);
            task.updated_at = new Date();
            await sheetsService.update('Tasks', task.id, task.toSheetRow());
        }
        await sheetsService.delete('Time_Entries', id);
        res.json({
            message: 'Time entry deleted successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Delete time entry error:', error);
        res.status(500).json({
            error: 'Failed to delete time entry',
            code: 'DELETE_TIME_ENTRY_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=timeEntries.js.map