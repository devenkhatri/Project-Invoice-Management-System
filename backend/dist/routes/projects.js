"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeProjectRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const Project_1 = require("../models/Project");
const Task_1 = require("../models/Task");
const router = (0, express_1.Router)();
let sheetsService;
const initializeProjectRoutes = (sheets) => {
    sheetsService = sheets;
    return router;
};
exports.initializeProjectRoutes = initializeProjectRoutes;
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, client_id } = req.query;
        const projectsData = await sheetsService.read('Projects');
        let projects = projectsData.map(data => Project_1.Project.fromSheetRow(data));
        if (status) {
            projects = projects.filter(p => p.status === status);
        }
        if (client_id) {
            projects = projects.filter(p => p.client_id === client_id);
        }
        projects.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        res.json({
            projects: projects.map(p => p.toSheetRow()),
            total: projects.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({
            error: 'Failed to fetch projects',
            code: 'FETCH_PROJECTS_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const projectsData = await sheetsService.read('Projects', id);
        if (projectsData.length === 0) {
            res.status(404).json({
                error: 'Project not found',
                code: 'PROJECT_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const project = Project_1.Project.fromSheetRow(projectsData[0]);
        const tasksData = await sheetsService.query('Tasks', [
            { field: 'project_id', operator: 'eq', value: id }
        ]);
        const tasks = tasksData.map(data => Task_1.Task.fromSheetRow(data));
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.isCompleted()).length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const totalEstimatedHours = tasks.reduce((sum, task) => sum + task.estimated_hours, 0);
        const totalActualHours = tasks.reduce((sum, task) => sum + task.actual_hours, 0);
        res.json({
            project: project.toSheetRow(),
            tasks: tasks.map(t => t.toSheetRow()),
            stats: {
                totalTasks,
                completedTasks,
                progress: Math.round(progress),
                totalEstimatedHours,
                totalActualHours,
                isOverdue: project.isOverdue(),
                remainingDays: project.getRemainingDays()
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({
            error: 'Failed to fetch project',
            code: 'FETCH_PROJECT_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const projectData = {
            ...req.body,
            start_date: new Date(req.body.start_date),
            end_date: new Date(req.body.end_date)
        };
        const project = new Project_1.Project(projectData);
        const validation = project.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        const id = await sheetsService.create('Projects', project.toSheetRow());
        project.id = id;
        res.status(201).json({
            message: 'Project created successfully',
            project: project.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({
            error: 'Failed to create project',
            code: 'CREATE_PROJECT_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.put('/:id', auth_1.authenticateToken, validation_1.sanitizeInput, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Projects', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Project not found',
                code: 'PROJECT_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const existingProject = Project_1.Project.fromSheetRow(existingData[0]);
        const updateData = { ...req.body };
        if (updateData.start_date)
            updateData.start_date = new Date(updateData.start_date);
        if (updateData.end_date)
            updateData.end_date = new Date(updateData.end_date);
        const updatedProject = new Project_1.Project({
            ...existingProject,
            ...updateData,
            id,
            updated_at: new Date()
        });
        const validation = updatedProject.validate();
        if (!validation.isValid) {
            res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors: validation.errors,
                timestamp: new Date().toISOString()
            });
            return;
        }
        await sheetsService.update('Projects', id, updatedProject.toSheetRow());
        res.json({
            message: 'Project updated successfully',
            project: updatedProject.toSheetRow(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({
            error: 'Failed to update project',
            code: 'UPDATE_PROJECT_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingData = await sheetsService.read('Projects', id);
        if (existingData.length === 0) {
            res.status(404).json({
                error: 'Project not found',
                code: 'PROJECT_NOT_FOUND',
                timestamp: new Date().toISOString()
            });
            return;
        }
        const tasks = await sheetsService.query('Tasks', [
            { field: 'project_id', operator: 'eq', value: id }
        ]);
        for (const task of tasks) {
            const timeEntries = await sheetsService.query('Time_Entries', [
                { field: 'task_id', operator: 'eq', value: task.id }
            ]);
            for (const entry of timeEntries) {
                await sheetsService.delete('Time_Entries', entry.id);
            }
            await sheetsService.delete('Tasks', task.id);
        }
        await sheetsService.delete('Projects', id);
        res.json({
            message: 'Project deleted successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({
            error: 'Failed to delete project',
            code: 'DELETE_PROJECT_ERROR',
            message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=projects.js.map