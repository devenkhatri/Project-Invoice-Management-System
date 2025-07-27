"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Task_1 = require("../models/Task");
const Project_1 = require("../models/Project");
const types_1 = require("../types");
const automation_1 = require("../services/automation");
const router = (0, express_1.Router)();
const sheetsService = sheets_service_1.SheetsService.getInstance();
const automationService = automation_1.AutomationService.getInstance();
router.use(auth_1.authenticateToken);
router.put('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.updateTask
], async (req, res) => {
    try {
        const { id } = req.params;
        const tasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (tasks.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Task not found'
            });
        }
        const existingTask = tasks[0];
        const updatedData = {
            ...existingTask,
            ...req.body,
            updated_at: new Date().toISOString()
        };
        const task = new Task_1.Task(updatedData);
        const success = await sheetsService.update('Tasks', id, task.toJSON());
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Task not found'
            });
        }
        if (req.body.status && req.body.status !== existingTask.status) {
            const allProjectTasks = await sheetsService.query('Tasks', {
                filters: [{ column: 'project_id', operator: 'eq', value: task.project_id }]
            });
            const projects = await sheetsService.query('Projects', {
                filters: [{ column: 'id', operator: 'eq', value: task.project_id }]
            });
            if (projects.length > 0) {
                const project = new Project_1.Project(projects[0]);
                project.updateProgress(allProjectTasks.map(t => new Task_1.Task(t)));
                await sheetsService.update('Projects', task.project_id, {
                    progress_percentage: project.progress_percentage,
                    updated_at: new Date().toISOString()
                });
            }
            if (req.body.status === types_1.TaskStatus.COMPLETED) {
                try {
                    await automationService.onTaskCompleted(id);
                }
                catch (error) {
                    console.error('Failed to trigger task completion automation:', error);
                }
            }
        }
        console.log(`✅ Task updated successfully: ${task.title} (${task.id})`);
        return res.json({
            message: 'Task updated successfully',
            task: task.toJSON()
        });
    }
    catch (error) {
        console.error('Update task error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Failed to update task'
        });
    }
});
router.delete('/:id', [
    (0, auth_1.authorizeRoles)('admin'),
    ...validation_1.ValidationSets.getById
], async (req, res) => {
    try {
        const { id } = req.params;
        const tasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'id', operator: 'eq', value: id }]
        });
        if (tasks.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Task not found'
            });
        }
        const task = tasks[0];
        const timeEntries = await sheetsService.query('Time_Entries', {
            filters: [{ column: 'task_id', operator: 'eq', value: id }]
        });
        const billedEntries = timeEntries.filter(te => te.invoice_id);
        if (billedEntries.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot delete task with billed time entries',
                dependencies: {
                    time_entries: timeEntries.length,
                    billed_entries: billedEntries.length
                }
            });
        }
        const success = await sheetsService.delete('Tasks', id);
        if (!success) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Task not found'
            });
        }
        for (const timeEntry of timeEntries) {
            await sheetsService.delete('Time_Entries', timeEntry.id);
        }
        const remainingTasks = await sheetsService.query('Tasks', {
            filters: [{ column: 'project_id', operator: 'eq', value: task.project_id }]
        });
        const projects = await sheetsService.query('Projects', {
            filters: [{ column: 'id', operator: 'eq', value: task.project_id }]
        });
        if (projects.length > 0) {
            const project = new Project_1.Project(projects[0]);
            project.updateProgress(remainingTasks.map(t => new Task_1.Task(t)));
            await sheetsService.update('Projects', task.project_id, {
                progress_percentage: project.progress_percentage,
                updated_at: new Date().toISOString()
            });
        }
        console.log(`✅ Task deleted successfully: ${task.title} (${task.id})`);
        return res.json({
            message: 'Task deleted successfully',
            deleted_items: {
                task: 1,
                time_entries: timeEntries.length
            }
        });
    }
    catch (error) {
        console.error('Delete task error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete task'
        });
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map