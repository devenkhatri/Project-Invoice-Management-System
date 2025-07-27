import { Router, Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { ValidationSets } from '../middleware/validation';
import { Task } from '../models/Task';
import { Project } from '../models/Project';
import { TimeEntry } from '../models/TimeEntry';
import { TaskStatus, TaskPriority } from '../types';
import { AutomationService } from '../services/automation';

const router = Router();
const sheetsService = SheetsService.getInstance();
const automationService = AutomationService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Update a task
 * PUT /api/tasks/:id
 */
router.put('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.updateTask
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get existing task
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

    // Merge updates with existing data
    const updatedData = {
      ...existingTask,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Create task instance for validation
    const task = new Task(updatedData);

    // Update in sheets
    const success = await sheetsService.update('Tasks', id, task.toJSON());

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found'
      });
    }

    // Update project progress if task status changed
    if (req.body.status && req.body.status !== existingTask.status) {
      const allProjectTasks = await sheetsService.query('Tasks', {
        filters: [{ column: 'project_id', operator: 'eq', value: task.project_id }]
      });

      const projects = await sheetsService.query('Projects', {
        filters: [{ column: 'id', operator: 'eq', value: task.project_id }]
      });

      if (projects.length > 0) {
        const project = new Project(projects[0]);
        project.updateProgress(allProjectTasks.map(t => new Task(t)));

        await sheetsService.update('Projects', task.project_id, {
          progress_percentage: project.progress_percentage,
          updated_at: new Date().toISOString()
        });
      }

      // Trigger automation workflows for task status changes
      if (req.body.status === TaskStatus.COMPLETED) {
        try {
          await automationService.onTaskCompleted(id);
        } catch (error) {
          console.error('Failed to trigger task completion automation:', error);
          // Don't fail the request if automation fails
        }
      }
    }

    console.log(`✅ Task updated successfully: ${task.title} (${task.id})`);

    return res.json({
      message: 'Task updated successfully',
      task: task.toJSON()
    });
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update task'
    });
  }
});

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
router.delete('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.getById
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get task to check for dependencies
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

    // Check for time entries
    const timeEntries = await sheetsService.query('Time_Entries', {
      filters: [{ column: 'task_id', operator: 'eq', value: id }]
    });

    // Check for billed time entries (prevent deletion)
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

    // Delete the task
    const success = await sheetsService.delete('Tasks', id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Task not found'
      });
    }

    // Delete associated time entries
    for (const timeEntry of timeEntries) {
      await sheetsService.delete('Time_Entries', timeEntry.id);
    }

    // Update project progress
    const remainingTasks = await sheetsService.query('Tasks', {
      filters: [{ column: 'project_id', operator: 'eq', value: task.project_id }]
    });

    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: task.project_id }]
    });

    if (projects.length > 0) {
      const project = new Project(projects[0]);
      project.updateProgress(remainingTasks.map(t => new Task(t)));

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
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete task'
    });
  }
});

export default router;