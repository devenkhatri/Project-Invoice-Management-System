import { Router, Request, Response } from 'express';
import { GoogleSheetsService } from '../services/googleSheets';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { TimeEntry } from '../models/TimeEntry';
import { ProjectStatus } from '../models/types';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeProjectRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

/**
 * Get all projects
 * GET /api/projects
 */
router.get('/',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status, client_id } = req.query;
      
      // Get all projects from Google Sheets
      const projectsData = await sheetsService.read('Projects');
      
      // Convert to Project instances and filter
      let projects = projectsData.map(data => Project.fromSheetRow(data));
      
      // Apply filters
      if (status) {
        projects = projects.filter(p => p.status === status);
      }
      if (client_id) {
        projects = projects.filter(p => p.client_id === client_id);
      }
      
      // Sort by created_at descending
      projects.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
      res.json({
        projects: projects.map(p => p.toSheetRow()),
        total: projects.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({
        error: 'Failed to fetch projects',
        code: 'FETCH_PROJECTS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get project by ID
 * GET /api/projects/:id
 */
router.get('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      
      const project = Project.fromSheetRow(projectsData[0]);
      
      // Get project tasks
      const tasksData = await sheetsService.query('Tasks', [
        { field: 'project_id', operator: 'eq', value: id }
      ]);
      const tasks = tasksData.map(data => Task.fromSheetRow(data));
      
      // Calculate project progress
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.isCompleted()).length;
      const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      
      // Calculate total hours
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
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({
        error: 'Failed to fetch project',
        code: 'FETCH_PROJECT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Create new project
 * POST /api/projects
 */
router.post('/',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const projectData = {
        ...req.body,
        start_date: new Date(req.body.start_date),
        end_date: new Date(req.body.end_date)
      };
      
      const project = new Project(projectData);
      
      // Validate project data
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
      
      // Save to Google Sheets
      const id = await sheetsService.create('Projects', project.toSheetRow());
      project.id = id;
      
      res.status(201).json({
        message: 'Project created successfully',
        project: project.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        error: 'Failed to create project',
        code: 'CREATE_PROJECT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update project
 * PUT /api/projects/:id
 */
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if project exists
      const existingData = await sheetsService.read('Projects', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingProject = Project.fromSheetRow(existingData[0]);
      
      // Update project data
      const updateData = { ...req.body };
      if (updateData.start_date) updateData.start_date = new Date(updateData.start_date);
      if (updateData.end_date) updateData.end_date = new Date(updateData.end_date);
      
      const updatedProject = new Project({
        ...existingProject,
        ...updateData,
        id, // Ensure ID doesn't change
        updated_at: new Date()
      });
      
      // Validate updated project
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
      
      // Update in Google Sheets
      await sheetsService.update('Projects', id, updatedProject.toSheetRow());
      
      res.json({
        message: 'Project updated successfully',
        project: updatedProject.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({
        error: 'Failed to update project',
        code: 'UPDATE_PROJECT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Delete project
 * DELETE /api/projects/:id
 */
router.delete('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if project exists
      const existingData = await sheetsService.read('Projects', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Delete associated tasks and time entries
      const tasks = await sheetsService.query('Tasks', [
        { field: 'project_id', operator: 'eq', value: id }
      ]);
      
      for (const task of tasks) {
        // Delete time entries for this task
        const timeEntries = await sheetsService.query('Time_Entries', [
          { field: 'task_id', operator: 'eq', value: task.id }
        ]);
        
        for (const entry of timeEntries) {
          await sheetsService.delete('Time_Entries', entry.id);
        }
        
        // Delete the task
        await sheetsService.delete('Tasks', task.id);
      }
      
      // Delete the project
      await sheetsService.delete('Projects', id);
      
      res.json({
        message: 'Project deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({
        error: 'Failed to delete project',
        code: 'DELETE_PROJECT_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;