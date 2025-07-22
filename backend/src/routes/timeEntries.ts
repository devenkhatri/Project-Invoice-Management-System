import { Router, Request, Response } from 'express';
import { GoogleSheetsService } from '../services/googleSheets';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sanitizeInput } from '../middleware/validation';
import { TimeEntry } from '../models/TimeEntry';
import { Task } from '../models/Task';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeTimeEntryRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

/**
 * Get time entries for a project
 * GET /api/projects/:projectId/time-entries
 */
router.get('/project/:projectId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, taskId } = req.query;
      
      // Get time entries for the project
      let filters = [{ field: 'project_id', operator: 'eq' as const, value: projectId }];
      
      if (taskId) {
        filters.push({ field: 'task_id', operator: 'eq' as const, value: taskId as string });
      }
      
      const timeEntriesData = await sheetsService.query('Time_Entries', filters);
      let timeEntries = timeEntriesData.map(data => TimeEntry.fromSheetRow(data));
      
      // Apply date filters if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        timeEntries = TimeEntry.filterByDateRange(timeEntries, start, end);
      }
      
      // Sort by date descending
      timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      // Calculate totals
      const totalHours = TimeEntry.calculateTotalHours(timeEntries);
      const groupedByDate = TimeEntry.groupByDate(timeEntries);
      
      res.json({
        timeEntries: timeEntries.map(te => te.toSheetRow()),
        total: timeEntries.length,
        totalHours,
        groupedByDate: Object.fromEntries(
          Array.from(groupedByDate.entries()).map(([date, entries]) => [
            date,
            {
              entries: entries.map(te => te.toSheetRow()),
              totalHours: TimeEntry.calculateTotalHours(entries)
            }
          ])
        ),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get project time entries error:', error);
      res.status(500).json({
        error: 'Failed to fetch project time entries',
        code: 'FETCH_PROJECT_TIME_ENTRIES_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get time entries for a task
 * GET /api/tasks/:taskId/time-entries
 */
router.get('/task/:taskId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Get time entries for the task
      const timeEntriesData = await sheetsService.query('Time_Entries', [
        { field: 'task_id', operator: 'eq', value: taskId }
      ]);
      let timeEntries = timeEntriesData.map(data => TimeEntry.fromSheetRow(data));
      
      // Apply date filters if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        timeEntries = TimeEntry.filterByDateRange(timeEntries, start, end);
      }
      
      // Sort by date descending
      timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      // Calculate totals
      const totalHours = TimeEntry.calculateTotalHours(timeEntries);
      
      res.json({
        timeEntries: timeEntries.map(te => te.toSheetRow()),
        total: timeEntries.length,
        totalHours,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get task time entries error:', error);
      res.status(500).json({
        error: 'Failed to fetch task time entries',
        code: 'FETCH_TASK_TIME_ENTRIES_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get time tracking summary
 * GET /api/time-entries/summary
 */
router.get('/summary',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId, startDate, endDate } = req.query;
      
      // Build filters
      let filters: any[] = [];
      if (projectId) {
        filters.push({ field: 'project_id', operator: 'eq' as const, value: projectId as string });
      }
      
      // Get time entries
      const timeEntriesData = filters.length > 0 
        ? await sheetsService.query('Time_Entries', filters)
        : await sheetsService.read('Time_Entries');
      let timeEntries = timeEntriesData.map(data => TimeEntry.fromSheetRow(data));
      
      // Apply date filters if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        timeEntries = TimeEntry.filterByDateRange(timeEntries, start, end);
      }
      
      // Calculate summary statistics
      const totalHours = TimeEntry.calculateTotalHours(timeEntries);
      const totalEntries = timeEntries.length;
      
      // Group by project
      const projectSummary = new Map<string, { hours: number; entries: number }>();
      timeEntries.forEach(entry => {
        const current = projectSummary.get(entry.project_id) || { hours: 0, entries: 0 };
        current.hours += entry.hours;
        current.entries += 1;
        projectSummary.set(entry.project_id, current);
      });
      
      // Group by date
      const dailySummary = new Map<string, number>();
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
    } catch (error) {
      console.error('Get time tracking summary error:', error);
      res.status(500).json({
        error: 'Failed to fetch time tracking summary',
        code: 'FETCH_TIME_SUMMARY_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get time entry by ID
 * GET /api/time-entries/:id
 */
router.get('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      
      const timeEntry = TimeEntry.fromSheetRow(timeEntriesData[0]);
      
      res.json({
        timeEntry: timeEntry.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get time entry error:', error);
      res.status(500).json({
        error: 'Failed to fetch time entry',
        code: 'FETCH_TIME_ENTRY_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Create new time entry
 * POST /api/tasks/:taskId/time-entries
 */
router.post('/task/:taskId',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      
      // Verify task exists and get project_id
      const taskData = await sheetsService.read('Tasks', taskId);
      if (taskData.length === 0) {
        res.status(404).json({
          error: 'Task not found',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const task = Task.fromSheetRow(taskData[0]);
      
      const timeEntryData = {
        ...req.body,
        task_id: taskId,
        project_id: task.project_id,
        date: new Date(req.body.date || new Date())
      };
      
      const timeEntry = new TimeEntry(timeEntryData);
      
      // Validate time entry data
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
      
      // Save to Google Sheets
      const id = await sheetsService.create('Time_Entries', timeEntry.toSheetRow());
      timeEntry.id = id;
      
      // Update task's actual hours
      task.addTimeEntry(timeEntry.hours);
      await sheetsService.update('Tasks', taskId, task.toSheetRow());
      
      res.status(201).json({
        message: 'Time entry created successfully',
        timeEntry: timeEntry.toSheetRow(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Create time entry error:', error);
      res.status(500).json({
        error: 'Failed to create time entry',
        code: 'CREATE_TIME_ENTRY_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update time entry
 * PUT /api/time-entries/:id
 */
router.put('/:id',
  authenticateToken,
  sanitizeInput,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if time entry exists
      const existingData = await sheetsService.read('Time_Entries', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Time entry not found',
          code: 'TIME_ENTRY_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const existingTimeEntry = TimeEntry.fromSheetRow(existingData[0]);
      const oldHours = existingTimeEntry.hours;
      
      // Update time entry data
      const updateData = { ...req.body };
      if (updateData.date) updateData.date = new Date(updateData.date);
      
      const updatedTimeEntry = new TimeEntry({
        ...existingTimeEntry,
        ...updateData,
        id, // Ensure ID doesn't change
        updated_at: new Date()
      });
      
      // Validate updated time entry
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
      
      // Update in Google Sheets
      await sheetsService.update('Time_Entries', id, updatedTimeEntry.toSheetRow());
      
      // Update task's actual hours if hours changed
      if (updatedTimeEntry.hours !== oldHours) {
        const taskData = await sheetsService.read('Tasks', updatedTimeEntry.task_id);
        if (taskData.length > 0) {
          const task = Task.fromSheetRow(taskData[0]);
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
    } catch (error) {
      console.error('Update time entry error:', error);
      res.status(500).json({
        error: 'Failed to update time entry',
        code: 'UPDATE_TIME_ENTRY_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Delete time entry
 * DELETE /api/time-entries/:id
 */
router.delete('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Check if time entry exists
      const existingData = await sheetsService.read('Time_Entries', id);
      if (existingData.length === 0) {
        res.status(404).json({
          error: 'Time entry not found',
          code: 'TIME_ENTRY_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const timeEntry = TimeEntry.fromSheetRow(existingData[0]);
      
      // Update task's actual hours
      const taskData = await sheetsService.read('Tasks', timeEntry.task_id);
      if (taskData.length > 0) {
        const task = Task.fromSheetRow(taskData[0]);
        task.actual_hours = Math.max(0, task.actual_hours - timeEntry.hours);
        task.updated_at = new Date();
        await sheetsService.update('Tasks', task.id, task.toSheetRow());
      }
      
      // Delete the time entry
      await sheetsService.delete('Time_Entries', id);
      
      res.json({
        message: 'Time entry deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Delete time entry error:', error);
      res.status(500).json({
        error: 'Failed to delete time entry',
        code: 'DELETE_TIME_ENTRY_ERROR',
        message: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;