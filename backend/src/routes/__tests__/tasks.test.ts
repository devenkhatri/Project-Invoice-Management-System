import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { initializeTaskRoutes } from '../tasks';
import { authenticateToken } from '../../middleware/auth';
import { sanitizeInput } from '../../middleware/validation';
import { TaskStatus, TaskPriority } from '../../models/types';

// Mock the dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/validation');

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;
const mockedAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('Tasks API', () => {
  let app: express.Application;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

  beforeEach(() => {
    // Create mock sheets service
    mockSheetsService = {
      read: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      aggregate: jest.fn()
    } as any;

    // Setup middleware mocks
    mockedAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'user123', email: 'test@example.com' };
      next();
    });
    
    mockedSanitizeInput.mockImplementation((req: any, res: any, next: any) => {
      next();
    });

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/tasks', initializeTaskRoutes(mockSheetsService));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tasks/project/:projectId', () => {
    it('should return tasks for a project', async () => {
      const mockTasks = [
        {
          id: 'task1',
          project_id: 'proj1',
          title: 'Task 1',
          description: 'First task',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          due_date: '2024-01-15T00:00:00.000Z',
          estimated_hours: 8,
          actual_hours: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'task2',
          project_id: 'proj1',
          title: 'Task 2',
          description: 'Second task',
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.MEDIUM,
          due_date: '2024-01-20T00:00:00.000Z',
          estimated_hours: 4,
          actual_hours: 2,
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/api/tasks/project/proj1')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('total', 2);
      expect(response.body.tasks).toHaveLength(2);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Tasks', [
        { field: 'project_id', operator: 'eq', value: 'proj1' }
      ]);
    });

    it('should filter tasks by status', async () => {
      const mockTasks = [
        {
          id: 'task1',
          project_id: 'proj1',
          title: 'Completed Task',
          description: 'Completed task',
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.HIGH,
          due_date: '2024-01-15T00:00:00.000Z',
          estimated_hours: 8,
          actual_hours: 8,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/api/tasks/project/proj1?status=completed')
        .expect(200);

      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].status).toBe(TaskStatus.COMPLETED);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Tasks', [
        { field: 'project_id', operator: 'eq', value: 'proj1' },
        { field: 'status', operator: 'eq', value: 'completed' }
      ]);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return task with time entries and stats', async () => {
      const mockTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Test Task',
        description: 'Test description',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 4,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2,
          description: 'Work done',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        },
        {
          id: 'time2',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2,
          description: 'More work',
          date: '2024-01-11T00:00:00.000Z',
          created_at: '2024-01-11T00:00:00.000Z',
          updated_at: '2024-01-11T00:00:00.000Z'
        }
      ];

      mockSheetsService.read.mockResolvedValue([mockTask]);
      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/tasks/task1')
        .expect(200);

      expect(response.body).toHaveProperty('task');
      expect(response.body).toHaveProperty('timeEntries');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.totalTimeEntries).toBe(2);
      expect(response.body.stats.totalHours).toBe(4);
      expect(response.body.stats.progress).toBe(50); // 4/8 * 100
      expect(response.body.stats.remainingHours).toBe(4);
    });

    it('should return 404 for non-existent task', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tasks/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
      expect(response.body).toHaveProperty('code', 'TASK_NOT_FOUND');
    });
  });

  describe('POST /api/tasks/project/:projectId', () => {
    it('should create a new task', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project'
      };

      const newTask = {
        title: 'New Task',
        description: 'Task description',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        due_date: '2024-01-15',
        estimated_hours: 8
      };

      mockSheetsService.read.mockResolvedValue([mockProject]);
      mockSheetsService.create.mockResolvedValue('task123');

      const response = await request(app)
        .post('/api/tasks/project/proj1')
        .send(newTask)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Task created successfully');
      expect(response.body).toHaveProperty('task');
      expect(response.body.task.title).toBe(newTask.title);
      expect(response.body.task.project_id).toBe('proj1');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Tasks', expect.any(Object));
    });

    it('should return 404 for non-existent project', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const newTask = {
        title: 'New Task',
        due_date: '2024-01-15',
        estimated_hours: 8
      };

      const response = await request(app)
        .post('/api/tasks/project/nonexistent')
        .send(newTask)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
    });

    it('should validate task data', async () => {
      const mockProject = { id: 'proj1' };
      mockSheetsService.read.mockResolvedValue([mockProject]);

      const invalidTask = {
        title: '', // Invalid: empty title
        estimated_hours: -1 // Invalid: negative hours
      };

      const response = await request(app)
        .post('/api/tasks/project/proj1')
        .send(invalidTask)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update an existing task', async () => {
      const existingTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Original Task',
        description: 'Original description',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const updateData = {
        title: 'Updated Task',
        priority: TaskPriority.HIGH,
        estimated_hours: 10
      };

      mockSheetsService.read.mockResolvedValue([existingTask]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/tasks/task1')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task updated successfully');
      expect(response.body.task.title).toBe(updateData.title);
      expect(response.body.task.priority).toBe(updateData.priority);
      expect(response.body.task.estimated_hours).toBe(updateData.estimated_hours);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Tasks', 'task1', expect.any(Object));
    });

    it('should return 404 for non-existent task', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/tasks/nonexistent')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete task and associated time entries', async () => {
      const existingTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Task to Delete'
      };

      const mockTimeEntries = [
        { id: 'time1', task_id: 'task1' },
        { id: 'time2', task_id: 'task1' }
      ];

      mockSheetsService.read.mockResolvedValue([existingTask]);
      mockSheetsService.query.mockResolvedValue(mockTimeEntries);
      mockSheetsService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/tasks/task1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task deleted successfully');
      
      // Verify deletion calls
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time1');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time2');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Tasks', 'task1');
    });

    it('should return 404 for non-existent task', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/tasks/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('should update task status', async () => {
      const existingTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Test Task',
        description: 'Test task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      mockSheetsService.read.mockResolvedValue([existingTask]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .patch('/api/tasks/task1/status')
        .send({ status: TaskStatus.IN_PROGRESS })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task status updated successfully');
      expect(response.body.task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Tasks', 'task1', expect.any(Object));
    });

    it('should validate task status', async () => {
      const response = await request(app)
        .patch('/api/tasks/task1/status')
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid task status');
      expect(response.body).toHaveProperty('code', 'INVALID_STATUS');
      expect(response.body).toHaveProperty('validStatuses');
    });

    it('should return 404 for non-existent task', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .patch('/api/tasks/nonexistent/status')
        .send({ status: TaskStatus.COMPLETED })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });
  });
});