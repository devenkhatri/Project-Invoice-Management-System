import { Router, Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { ValidationSets } from '../middleware/validation';
import { TimeEntry } from '../models/TimeEntry';
import { Task } from '../models/Task';
import { Project } from '../models/Project';
import { TaskStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const sheetsService = SheetsService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Create a new time entry
 * POST /api/time-entries
 */
router.post('/', [
  authorizeRoles('admin'),
  ...ValidationSets.createTimeEntry
], async (req: Request, res: Response) => {
  try {
    const { task_id, project_id, hours, description, date, start_time, end_time, is_billable = true, hourly_rate } = req.body;

    // Verify task and project exist
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

    // Verify task belongs to project
    if (tasks[0].project_id !== project_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Task does not belong to the specified project'
      });
    }

    const timeEntryData = {
      id: uuidv4(),
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

    // Create time entry instance for validation
    const timeEntry = new TimeEntry(timeEntryData);

    // Validate time range if provided
    if (!timeEntry.isValidTimeRange()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid time range: end time must be after start time'
      });
    }

    // Save to sheets
    await sheetsService.create('Time_Entries', timeEntry.toJSON());

    // Update task actual hours and status
    const task = new Task(tasks[0]);
    task.addTimeEntry(hours);

    await sheetsService.update('Tasks', task_id, {
      actual_hours: task.actual_hours,
      status: task.status,
      updated_at: new Date().toISOString()
    });

    // Update project actual cost
    const allTimeEntries = await sheetsService.query('Time_Entries', {
      filters: [{ column: 'project_id', operator: 'eq', value: project_id }]
    });

    const expenses = await sheetsService.query('Expenses', {
      filters: [{ column: 'project_id', operator: 'eq', value: project_id }]
    });

    const project = new Project(projects[0]);
    project.updateActualCost(
      allTimeEntries.map(te => new TimeEntry(te)),
      expenses
    );

    await sheetsService.update('Projects', project_id, {
      actual_cost: project.actual_cost,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ Time entry created successfully: ${hours}h for task ${task.title}`);

    return res.status(201).json({
      message: 'Time entry created successfully',
      time_entry: timeEntry.toJSON()
    });
  } catch (error) {
    console.error('Create time entry error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create time entry'
    });
  }
});

/**
 * Get time entries with filtering
 * GET /api/time-entries
 */
router.get('/', ...ValidationSets.queryWithPagination, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      project_id,
      task_id,
      start_date,
      end_date,
      is_billable,
      user_id,
      sort_by = 'date',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters: any[] = [];

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

    // For client users, only show time entries for their projects
    if (req.user?.role === 'client') {
      // Get client's projects
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

        // Add project filter if not already specified
        if (!project_id) {
          filters.push({ column: 'project_id', operator: 'in', value: projectIds });
        }
      }
    }

    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);

    // Query time entries
    const timeEntries = await sheetsService.query('Time_Entries', {
      filters,
      sortBy: sort_by as string,
      sortOrder: sort_order as 'asc' | 'desc',
      limit: Number(limit),
      offset
    });

    // Get total count for pagination
    const totalEntries = await sheetsService.query('Time_Entries', { filters });
    const totalPages = Math.ceil(totalEntries.length / Number(limit));

    // Enhance time entries with additional data
    const enhancedEntries = await Promise.all(
      timeEntries.map(async (entryData) => {
        const timeEntry = new TimeEntry(entryData);

        // Get related task and project info
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
      })
    );

    // Calculate summary
    const summary = {
      total_hours: TimeEntry.calculateTotalHours(timeEntries.map(te => new TimeEntry(te))),
      billable_hours: TimeEntry.calculateTotalBillableHours(timeEntries.map(te => new TimeEntry(te))),
      total_amount: TimeEntry.calculateTotalAmount(timeEntries.map(te => new TimeEntry(te)))
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
  } catch (error) {
    console.error('Get time entries error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch time entries'
    });
  }
});

/**
 * Update a time entry
 * PUT /api/time-entries/:id
 */
router.put('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.createTimeEntry
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get existing time entry
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

    // Check if entry is already billed
    if (existingEntry.invoice_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot update billed time entry'
      });
    }

    // Merge updates with existing data
    const updatedData = {
      ...existingEntry,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Create time entry instance for validation
    const timeEntry = new TimeEntry(updatedData);

    // Validate time range if provided
    if (!timeEntry.isValidTimeRange()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid time range: end time must be after start time'
      });
    }

    // Update in sheets
    const success = await sheetsService.update('Time_Entries', id, timeEntry.toJSON());

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Time entry not found'
      });
    }

    // Update task actual hours if hours changed
    if (req.body.hours && req.body.hours !== existingEntry.hours) {
      const tasks = await sheetsService.query('Tasks', {
        filters: [{ column: 'id', operator: 'eq', value: timeEntry.task_id }]
      });

      if (tasks.length > 0) {
        const task = new Task(tasks[0]);
        const hoursDiff = req.body.hours - existingEntry.hours;
        task.addTimeEntry(hoursDiff);

        await sheetsService.update('Tasks', task.id, {
          actual_hours: task.actual_hours,
          updated_at: new Date().toISOString()
        });
      }
    }

    // Update project actual cost
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
      const project = new Project(projects[0]);
      project.updateActualCost(
        allTimeEntries.map(te => new TimeEntry(te)),
        expenses
      );

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
  } catch (error) {
    console.error('Update time entry error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update time entry'
    });
  }
});

/**
 * Delete a time entry
 * DELETE /api/time-entries/:id
 */
router.delete('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.getById
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get time entry
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

    // Check if entry is already billed
    if (timeEntry.invoice_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete billed time entry'
      });
    }

    // Delete the time entry
    const success = await sheetsService.delete('Time_Entries', id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Time entry not found'
      });
    }

    // Update task actual hours
    const tasks = await sheetsService.query('Tasks', {
      filters: [{ column: 'id', operator: 'eq', value: timeEntry.task_id }]
    });

    if (tasks.length > 0) {
      const task = new Task(tasks[0]);
      task.addTimeEntry(-timeEntry.hours); // Subtract the deleted hours

      await sheetsService.update('Tasks', task.id, {
        actual_hours: Math.max(0, task.actual_hours), // Ensure non-negative
        updated_at: new Date().toISOString()
      });
    }

    // Update project actual cost
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
      const project = new Project(projects[0]);
      project.updateActualCost(
        allTimeEntries.map(te => new TimeEntry(te)),
        expenses
      );

      await sheetsService.update('Projects', timeEntry.project_id, {
        actual_cost: project.actual_cost,
        updated_at: new Date().toISOString()
      });
    }

    console.log(`✅ Time entry deleted successfully: ${timeEntry.hours}h (${timeEntry.id})`);

    return res.json({
      message: 'Time entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete time entry error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete time entry'
    });
  }
});

export default router;