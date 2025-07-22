import { Router, Request, Response } from 'express';
import { GoogleSheetsService } from '../services/googleSheets';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { Task } from '../models/Task';
import { TimeEntry } from '../models/TimeEntry';
import { TaskStatus, TaskPriority } from '../models/types';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeTaskRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

/**
 * Get tasks for a project
 * GET /api/projects/:projectId/tasks
 */
router.get('/project/:projectId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { status, priority } = req.query;
      
      // Get tasks for the project
      let filters = [{ field: 'project_id', operator: 'eq' as const, value: projectId }];
      
      if (status) {
        filters.push({ field: 'status', operator: 'eq' as const, value: status as string });
      }
      if (priority) {
        filters.push({ field: 'priority', operator: 'eq' as const, value: priority as string });
      }
      
      const tasksData = await sheetsService.query('Tasks', filters);
      const tasks = tasksData.map(data => Task.fromSheetRow(data));
      
      // Sort by due_date ascending
      tasks.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
      
      res.json({
        tasks: tasks.map(t => t.toSheetRow()),
        total: tasks.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get project tasks error:', error);
      res.status(500).json({
        error: 'Failed to fetch project tasks',
        code: 'FETCH_PROJECT_TASKS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get task by ID
 * GET /api/tasks/:id
 */
router.get('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      
      const task = Task.fromSheetRow(tasksData[0]);
      
      // Get time entries for this task
      const timeEntriesData = await sheetsService.query('Time_Entries', [
        { field: 'task_id', operator: 'eq', value: id }
      ]);
      const timeEntries = timeEntriesData.map(data => TimeEntry.fromSheetRow(data));
      
      // Sort time entries by date descending
      timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      res.json({
        task: task.toSheetRow(),
        timeEntries: timeEntries.map(te => te.toSheetRow()),
        stats: {
          totalTimeEntries: timeEntries.length,
          totalHours: TimeEntry.calculateTotalHours(timeEntries),
          progress: task.getProgressPercentage(),
          remainingHours: task.getRemainingHours(),
          isOverdue: task.isOverdue(),
          isOverBudget: task.isOverBudget()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({
        error: 'Failed to fetch task',
        code: 'FETCH_TASK_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Create new task
 * POST /api/projects/:projectId/tasks
 */
router.post('/project/:projectId',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      
      // Verify project exists
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
      
      const task = new Task(taskData);
      
      // Validate task data
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
      
      // Save to Google Sheets
      const id = await sheetsService.create('Tasks', task.toSheetRow());
      task.id = id;
      
      res.status(201).json({
        message: 'Task created successfully',
        task: task.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        error: 'Failed to create task',
        code: 'CREATE_TASK_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update task
 * PUT /api/tasks/:id
 */
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if task exists
      const existingData = await sheetsService.read('Tasks', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingTask = Task.fromSheetRow(existingData[0]);
      
      // Update task data
      const updateData = { ...req.body };
      if (updateData.due_date) updateData.due_date = new Date(updateData.due_date);
      
      const updatedTask = new Task({
        ...existingTask,
        ...updateData,
        id, // Ensure ID doesn't change
        updated_at: new Date()
      });
      
      // Validate updated task
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
      
      // Update in Google Sheets
      await sheetsService.update('Tasks', id, updatedTask.toSheetRow());
      
      res.json({
        message: 'Task updated successfully',
        task: updatedTask.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        error: 'Failed to update task',
        code: 'UPDATE_TASK_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Delete task
 * DELETE /api/tasks/:id
 */
router.delete('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if task exists
      const existingData = await sheetsService.read('Tasks', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Delete associated time entries
      const timeEntries = await sheetsService.query('Time_Entries', [
        { field: 'task_id', operator: 'eq', value: id }
      ]);
      
      for (const entry of timeEntries) {
        await sheetsService.delete('Time_Entries', entry.id);
      }
      
      // Delete the task
      await sheetsService.delete('Tasks', id);
      
      res.json({
        message: 'Task deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        error: 'Failed to delete task',
        code: 'DELETE_TASK_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update task status
 * PATCH /api/tasks/:id/status
 */
router.patch('/:id/status',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!Object.values(TaskStatus).includes(status)) {
        res.status(400).json({
          error: 'Invalid task status',
          code: 'INVALID_STATUS',
          validStatuses: Object.values(TaskStatus),
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Check if task exists
      const existingData = await sheetsService.read('Tasks', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const task = Task.fromSheetRow(existingData[0]);
      task.status = status;
      task.updated_at = new Date();
      
      // Update in Google Sheets
      await sheetsService.update('Tasks', id, task.toSheetRow());
      
      res.json({
        message: 'Task status updated successfully',
        task: task.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update task status error:', error);
      res.status(500).json({
        error: 'Failed to update task status',
        code: 'UPDATE_TASK_STATUS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;