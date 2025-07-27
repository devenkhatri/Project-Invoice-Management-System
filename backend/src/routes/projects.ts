import { Router, Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken, authorizeRoles, authorizeResourceAccess } from '../middleware/auth';
import { ValidationSets } from '../middleware/validation';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { TimeEntry } from '../models/TimeEntry';
import { ProjectStatus, TaskStatus, TaskPriority } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const sheetsService = SheetsService.getInstance();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all projects with filtering, sorting, and pagination
 * GET /api/projects
 */
router.get('/', ...ValidationSets.queryWithPagination, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      client_id,
      start_date,
      end_date,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters: any[] = [];
    
    if (status) {
      filters.push({ column: 'status', operator: 'eq', value: status });
    }
    
    if (client_id) {
      filters.push({ column: 'client_id', operator: 'eq', value: client_id });
    }
    
    if (start_date) {
      filters.push({ column: 'start_date', operator: 'gte', value: start_date });
    }
    
    if (end_date) {
      filters.push({ column: 'end_date', operator: 'lte', value: end_date });
    }

    // For client users, only show their projects
    if (req.user?.role === 'client') {
      // First get client record to find client_id
      const clients = await sheetsService.query('Clients', {
        filters: [{ column: 'email', operator: 'eq', value: req.user.email }]
      });
      
      if (clients.length > 0) {
        filters.push({ column: 'client_id', operator: 'eq', value: clients[0].id });
      } else {
        // Client not found, return empty results
        return res.json({
          projects: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            totalPages: 0
          }
        });
      }
    }

    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);

    // Query projects
    const projects = await sheetsService.query('Projects', {
      filters,
      sortBy: sort_by as string,
      sortOrder: sort_order as 'asc' | 'desc',
      limit: Number(limit),
      offset
    });

    // Get total count for pagination
    const totalProjects = await sheetsService.query('Projects', { filters });
    const totalPages = Math.ceil(totalProjects.length / Number(limit));

    // Enhance projects with additional data
    const enhancedProjects = await Promise.all(
      projects.map(async (projectData) => {
        const project = new Project(projectData);
        
        // Get tasks for progress calculation
        const tasks = await sheetsService.query('Tasks', {
          filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
        });
        
        // Get time entries for cost calculation
        const timeEntries = await sheetsService.query('Time_Entries', {
          filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
        });
        
        // Get expenses for cost calculation
        const expenses = await sheetsService.query('Expenses', {
          filters: [{ column: 'project_id', operator: 'eq', value: project.id }]
        });

        // Update project with calculated values
        project.updateProgress(tasks.map(t => new Task(t)));
        project.updateActualCost(
          timeEntries.map(te => new TimeEntry(te)),
          expenses
        );

        return {
          ...project.toJSON(),
          task_count: tasks.length,
          completed_tasks: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
          total_hours: timeEntries.reduce((sum, te) => sum + te.hours, 0),
          is_overdue: project.isOverdue(),
          days_remaining: project.getDaysRemaining()
        };
      })
    );

    return res.json({
      projects: enhancedProjects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalProjects.length,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch projects'
    });
  }
});

/**
 * Create a new project
 * POST /api/projects
 */
router.post('/', [
  authorizeRoles('admin'),
  ...ValidationSets.createProject
], async (req: Request, res: Response) => {
  try {
    const projectData = {
      ...req.body,
      id: uuidv4(),
      status: req.body.status || ProjectStatus.ACTIVE,
      currency: req.body.currency || 'INR',
      is_billable: req.body.is_billable !== undefined ? req.body.is_billable : true,
      progress_percentage: 0
    };

    // Validate client exists
    const clients = await sheetsService.query('Clients', {
      filters: [{ column: 'id', operator: 'eq', value: projectData.client_id }]
    });

    if (clients.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Client not found'
      });
    }

    // Create project instance for validation
    const project = new Project(projectData);

    // Save to sheets
    await sheetsService.create('Projects', project.toJSON());

    console.log(`✅ Project created successfully: ${project.name} (${project.id})`);

    return res.status(201).json({
      message: 'Project created successfully',
      project: project.toJSON()
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create project'
    });
  }
});

/**
 * Get a single project with tasks
 * GET /api/projects/:id
 */
router.get('/:id', [
  ...ValidationSets.getById,
  authorizeResourceAccess('project')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get project
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const project = new Project(projects[0]);

    // Get related data
    const [tasks, timeEntries, expenses, client] = await Promise.all([
      sheetsService.query('Tasks', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }],
        sortBy: 'created_at',
        sortOrder: 'asc'
      }),
      sheetsService.query('Time_Entries', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Expenses', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Clients', {
        filters: [{ column: 'id', operator: 'eq', value: project.client_id }]
      })
    ]);

    // Update project with calculated values
    const taskInstances = tasks.map(t => new Task(t));
    const timeEntryInstances = timeEntries.map(te => new TimeEntry(te));
    
    project.updateProgress(taskInstances);
    project.updateActualCost(timeEntryInstances, expenses);

    // Calculate profitability
    const profitability = project.calculateProfitability(timeEntryInstances, expenses);

    // Group tasks by status
    const tasksByStatus = {
      todo: tasks.filter(t => t.status === TaskStatus.TODO),
      'in-progress': tasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED)
    };

    return res.json({
      project: {
        ...project.toJSON(),
        client: client[0] || null,
        is_overdue: project.isOverdue(),
        days_remaining: project.getDaysRemaining(),
        profitability
      },
      tasks: {
        all: tasks,
        by_status: tasksByStatus,
        total: tasks.length,
        completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length
      },
      time_entries: {
        entries: timeEntries,
        total_hours: timeEntries.reduce((sum, te) => sum + te.hours, 0),
        billable_hours: timeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + te.hours, 0)
      },
      expenses: {
        entries: expenses,
        total_amount: expenses.reduce((sum, e) => sum + e.amount, 0)
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project'
    });
  }
});

/**
 * Update a project
 * PUT /api/projects/:id
 */
router.put('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.updateProject,
  authorizeResourceAccess('project')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get existing project
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const existingProject = projects[0];

    // Validate client exists if client_id is being updated
    if (req.body.client_id && req.body.client_id !== existingProject.client_id) {
      const clients = await sheetsService.query('Clients', {
        filters: [{ column: 'id', operator: 'eq', value: req.body.client_id }]
      });

      if (clients.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Client not found'
        });
      }
    }

    // Merge updates with existing data
    const updatedData = {
      ...existingProject,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Create project instance for validation
    const project = new Project(updatedData);

    // Update in sheets
    const success = await sheetsService.update('Projects', id, project.toJSON());

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // If status changed to completed, update all incomplete tasks
    if (req.body.status === ProjectStatus.COMPLETED && existingProject.status !== ProjectStatus.COMPLETED) {
      const incompleteTasks = await sheetsService.query('Tasks', {
        filters: [
          { column: 'project_id', operator: 'eq', value: id },
          { column: 'status', operator: 'ne', value: TaskStatus.COMPLETED }
        ]
      });

      // Mark all incomplete tasks as completed
      for (const task of incompleteTasks) {
        await sheetsService.update('Tasks', task.id, {
          status: TaskStatus.COMPLETED,
          updated_at: new Date().toISOString()
        });
      }
    }

    console.log(`✅ Project updated successfully: ${project.name} (${project.id})`);

    return res.json({
      message: 'Project updated successfully',
      project: project.toJSON()
    });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to update project'
    });
  }
});

/**
 * Soft delete a project (with dependency checks)
 * DELETE /api/projects/:id
 */
router.delete('/:id', [
  authorizeRoles('admin'),
  ...ValidationSets.getById,
  authorizeResourceAccess('project')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if project exists
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const project = projects[0];

    // Check for dependencies
    const [invoices, timeEntries] = await Promise.all([
      sheetsService.query('Invoices', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      }),
      sheetsService.query('Time_Entries', {
        filters: [{ column: 'project_id', operator: 'eq', value: id }]
      })
    ]);

    // Check if there are paid invoices (prevent deletion)
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    if (paidInvoices.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete project with paid invoices. Archive the project instead.',
        dependencies: {
          paid_invoices: paidInvoices.length
        }
      });
    }

    // Soft delete: mark as inactive instead of actual deletion
    const success = await sheetsService.update('Projects', id, {
      status: 'archived',
      updated_at: new Date().toISOString()
    });

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Also archive related tasks
    const tasks = await sheetsService.query('Tasks', {
      filters: [{ column: 'project_id', operator: 'eq', value: id }]
    });

    for (const task of tasks) {
      await sheetsService.update('Tasks', task.id, {
        status: 'archived',
        updated_at: new Date().toISOString()
      });
    }

    console.log(`✅ Project archived successfully: ${project.name} (${project.id})`);

    return res.json({
      message: 'Project archived successfully',
      archived_items: {
        project: 1,
        tasks: tasks.length
      },
      dependencies: {
        invoices: invoices.length,
        time_entries: timeEntries.length,
        paid_invoices: paidInvoices.length
      }
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete project'
    });
  }
});

/**
 * Get tasks for a specific project
 * GET /api/projects/:id/tasks
 */
router.get('/:id/tasks', [
  ...ValidationSets.getById,
  authorizeResourceAccess('project')
], async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, sort_by = 'created_at', sort_order = 'asc' } = req.query;

    // Verify project exists
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: id }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    // Build filters
    const filters: any[] = [
      { column: 'project_id', operator: 'eq', value: id }
    ];

    if (status) {
      filters.push({ column: 'status', operator: 'eq', value: status });
    }

    if (priority) {
      filters.push({ column: 'priority', operator: 'eq', value: priority });
    }

    // Get tasks
    const tasks = await sheetsService.query('Tasks', {
      filters,
      sortBy: sort_by as string,
      sortOrder: sort_order as 'asc' | 'desc'
    });

    // Enhance tasks with additional data
    const enhancedTasks = await Promise.all(
      tasks.map(async (taskData) => {
        const task = new Task(taskData);
        
        // Get time entries for this task
        const timeEntries = await sheetsService.query('Time_Entries', {
          filters: [{ column: 'task_id', operator: 'eq', value: task.id }]
        });

        const totalHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
        const billableAmount = task.calculateBillableAmount();
        const variance = task.calculateVariance();

        return {
          ...task.toJSON(),
          total_logged_hours: totalHours,
          billable_amount: billableAmount,
          variance,
          is_overdue: task.isOverdue(),
          days_remaining: task.getDaysRemaining(),
          completion_percentage: task.getCompletionPercentage()
        };
      })
    );

    // Group by status for summary
    const tasksByStatus = {
      todo: enhancedTasks.filter(t => t.status === TaskStatus.TODO),
      'in-progress': enhancedTasks.filter(t => t.status === TaskStatus.IN_PROGRESS),
      completed: enhancedTasks.filter(t => t.status === TaskStatus.COMPLETED)
    };

    return res.json({
      tasks: enhancedTasks,
      summary: {
        total: enhancedTasks.length,
        by_status: {
          todo: tasksByStatus.todo.length,
          'in-progress': tasksByStatus['in-progress'].length,
          completed: tasksByStatus.completed.length
        },
        by_priority: {
          high: enhancedTasks.filter(t => t.priority === TaskPriority.HIGH).length,
          medium: enhancedTasks.filter(t => t.priority === TaskPriority.MEDIUM).length,
          low: enhancedTasks.filter(t => t.priority === TaskPriority.LOW).length
        },
        overdue: enhancedTasks.filter(t => t.is_overdue).length
      }
    });
  } catch (error) {
    console.error('Get project tasks error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch project tasks'
    });
  }
});

/**
 * Create a new task for a project
 * POST /api/projects/:id/tasks
 */
router.post('/:id/tasks', [
  authorizeRoles('admin'),
  ...ValidationSets.createTask,
  authorizeResourceAccess('project')
], async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;

    // Verify project exists
    const projects = await sheetsService.query('Projects', {
      filters: [{ column: 'id', operator: 'eq', value: projectId }]
    });

    if (projects.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Project not found'
      });
    }

    const taskData = {
      ...req.body,
      id: uuidv4(),
      project_id: projectId,
      status: req.body.status || TaskStatus.TODO,
      priority: req.body.priority || TaskPriority.MEDIUM,
      actual_hours: 0,
      is_billable: req.body.is_billable !== undefined ? req.body.is_billable : true
    };

    // Create task instance for validation
    const task = new Task(taskData);

    // Save to sheets
    await sheetsService.create('Tasks', task.toJSON());

    // Update project progress
    const allTasks = await sheetsService.query('Tasks', {
      filters: [{ column: 'project_id', operator: 'eq', value: projectId }]
    });

    const project = new Project(projects[0]);
    project.updateProgress(allTasks.map(t => new Task(t)));

    await sheetsService.update('Projects', projectId, {
      progress_percentage: project.progress_percentage,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ Task created successfully: ${task.title} (${task.id})`);

    return res.status(201).json({
      message: 'Task created successfully',
      task: task.toJSON()
    });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to create task'
    });
  }
});

export default router;