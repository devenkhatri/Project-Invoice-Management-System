import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { initializeTimeEntryRoutes } from '../timeEntries';
import { authenticateToken } from '../../middleware/auth';
import { sanitizeInput } from '../../middleware/validation';

// Mock the dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/validation');

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;
const mockedAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('Time Entries API', () => {
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
    app.use('/api/time-entries', initializeTimeEntryRoutes(mockSheetsService));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/time-entries/project/:projectId', () => {
    it('should return time entries for a project', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work on feature A',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        },
        {
          id: 'time2',
          task_id: 'task2',
          project_id: 'proj1',
          hours: 3.0,
          description: 'Bug fixes',
          date: '2024-01-11T00:00:00.000Z',
          created_at: '2024-01-11T00:00:00.000Z',
          updated_at: '2024-01-11T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/project/proj1')
        .expect(200);

      expect(response.body).toHaveProperty('timeEntries');
      expect(response.body).toHaveProperty('total', 2);
      expect(response.body).toHaveProperty('totalHours', 5.5);
      expect(response.body).toHaveProperty('groupedByDate');
      expect(response.body.timeEntries).toHaveLength(2);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Time_Entries', [
        { field: 'project_id', operator: 'eq', value: 'proj1' }
      ]);
    });

    it('should filter time entries by task', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work on task 1',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/project/proj1?taskId=task1')
        .expect(200);

      expect(response.body.timeEntries).toHaveLength(1);
      expect(response.body.timeEntries[0].task_id).toBe('task1');
      expect(mockSheetsService.query).toHaveBeenCalledWith('Time_Entries', [
        { field: 'project_id', operator: 'eq', value: 'proj1' },
        { field: 'task_id', operator: 'eq', value: 'task1' }
      ]);
    });

    it('should filter time entries by date range', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work within range',
          date: '2024-01-15T00:00:00.000Z',
          created_at: '2024-01-15T00:00:00.000Z',
          updated_at: '2024-01-15T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/project/proj1?startDate=2024-01-10&endDate=2024-01-20')
        .expect(200);

      expect(response.body.timeEntries).toHaveLength(1);
    });
  });

  describe('GET /api/time-entries/task/:taskId', () => {
    it('should return time entries for a task', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work on task',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/task/task1')
        .expect(200);

      expect(response.body).toHaveProperty('timeEntries');
      expect(response.body).toHaveProperty('total', 1);
      expect(response.body).toHaveProperty('totalHours', 2.5);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Time_Entries', [
        { field: 'task_id', operator: 'eq', value: 'task1' }
      ]);
    });
  });

  describe('GET /api/time-entries/:id', () => {
    it('should return a specific time entry', async () => {
      const mockTimeEntry = {
        id: 'time1',
        task_id: 'task1',
        project_id: 'proj1',
        hours: 2.5,
        description: 'Work done',
        date: '2024-01-10T00:00:00.000Z',
        created_at: '2024-01-10T00:00:00.000Z',
        updated_at: '2024-01-10T00:00:00.000Z'
      };

      mockSheetsService.read.mockResolvedValue([mockTimeEntry]);

      const response = await request(app)
        .get('/api/time-entries/time1')
        .expect(200);

      expect(response.body).toHaveProperty('timeEntry');
      expect(response.body.timeEntry.id).toBe('time1');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Time_Entries', 'time1');
    });

    it('should return 404 for non-existent time entry', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/time-entries/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Time entry not found');
      expect(response.body).toHaveProperty('code', 'TIME_ENTRY_NOT_FOUND');
    });
  });

  describe('POST /api/time-entries/task/:taskId', () => {
    it('should create a new time entry', async () => {
      const mockTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Test Task',
        description: 'Test task',
        status: 'todo',
        priority: 'medium',
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const newTimeEntry = {
        hours: 2.5,
        description: 'Work completed',
        date: '2024-01-10'
      };

      mockSheetsService.read.mockResolvedValue([mockTask]);
      mockSheetsService.create.mockResolvedValue('time123');
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/time-entries/task/task1')
        .send(newTimeEntry)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Time entry created successfully');
      expect(response.body).toHaveProperty('timeEntry');
      expect(response.body.timeEntry.hours).toBe(newTimeEntry.hours);
      expect(response.body.timeEntry.task_id).toBe('task1');
      expect(response.body.timeEntry.project_id).toBe('proj1');
      
      expect(mockSheetsService.create).toHaveBeenCalledWith('Time_Entries', expect.any(Object));
      expect(mockSheetsService.update).toHaveBeenCalledWith('Tasks', 'task1', expect.any(Object));
    });

    it('should return 404 for non-existent task', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const newTimeEntry = {
        hours: 2.5,
        description: 'Work completed'
      };

      const response = await request(app)
        .post('/api/time-entries/task/nonexistent')
        .send(newTimeEntry)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });

    it('should validate time entry data', async () => {
      const mockTask = { id: 'task1', project_id: 'proj1' };
      mockSheetsService.read.mockResolvedValue([mockTask]);

      const invalidTimeEntry = {
        hours: 0, // Invalid: too low
        description: 'Work completed'
      };

      const response = await request(app)
        .post('/api/time-entries/task/task1')
        .send(invalidTimeEntry)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/time-entries/:id', () => {
    it('should update an existing time entry', async () => {
      const existingTimeEntry = {
        id: 'time1',
        task_id: 'task1',
        project_id: 'proj1',
        hours: 2.0,
        description: 'Original work',
        date: '2024-01-10T00:00:00.000Z',
        created_at: '2024-01-10T00:00:00.000Z',
        updated_at: '2024-01-10T00:00:00.000Z'
      };

      const mockTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Test Task',
        description: 'Test task',
        status: 'todo',
        priority: 'medium',
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 2.0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const updateData = {
        hours: 3.0,
        description: 'Updated work description'
      };

      mockSheetsService.read
        .mockResolvedValueOnce([existingTimeEntry]) // First call for time entry
        .mockResolvedValueOnce([mockTask]); // Second call for task
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/time-entries/time1')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Time entry updated successfully');
      expect(response.body.timeEntry.hours).toBe(updateData.hours);
      expect(response.body.timeEntry.description).toBe(updateData.description);
      
      expect(mockSheetsService.update).toHaveBeenCalledWith('Time_Entries', 'time1', expect.any(Object));
      expect(mockSheetsService.update).toHaveBeenCalledWith('Tasks', 'task1', expect.any(Object));
    });

    it('should return 404 for non-existent time entry', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/time-entries/nonexistent')
        .send({ hours: 3.0 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Time entry not found');
    });
  });

  describe('DELETE /api/time-entries/:id', () => {
    it('should delete time entry and update task hours', async () => {
      const existingTimeEntry = {
        id: 'time1',
        task_id: 'task1',
        project_id: 'proj1',
        hours: 2.5
      };

      const mockTask = {
        id: 'task1',
        project_id: 'proj1',
        title: 'Test Task',
        description: 'Test task',
        status: 'todo',
        priority: 'medium',
        due_date: '2024-01-15T00:00:00.000Z',
        estimated_hours: 8,
        actual_hours: 5.0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      mockSheetsService.read
        .mockResolvedValueOnce([existingTimeEntry]) // First call for time entry
        .mockResolvedValueOnce([mockTask]); // Second call for task
      mockSheetsService.update.mockResolvedValue(true);
      mockSheetsService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/time-entries/time1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Time entry deleted successfully');
      
      expect(mockSheetsService.update).toHaveBeenCalledWith('Tasks', 'task1', expect.objectContaining({
        actual_hours: 2.5 // 5.0 - 2.5
      }));
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time1');
    });

    it('should return 404 for non-existent time entry', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/time-entries/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Time entry not found');
    });
  });

  describe('GET /api/time-entries/summary', () => {
    it('should return time tracking summary', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work 1',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        },
        {
          id: 'time2',
          task_id: 'task2',
          project_id: 'proj1',
          hours: 3.0,
          description: 'Work 2',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        },
        {
          id: 'time3',
          task_id: 'task3',
          project_id: 'proj2',
          hours: 1.5,
          description: 'Work 3',
          date: '2024-01-11T00:00:00.000Z',
          created_at: '2024-01-11T00:00:00.000Z',
          updated_at: '2024-01-11T00:00:00.000Z'
        }
      ];

      // Reset all mocks before this test
      jest.clearAllMocks();
      mockSheetsService.read.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/summary')
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('totalHours', 7.0);
      expect(response.body.summary).toHaveProperty('totalEntries', 3);
      expect(response.body.summary).toHaveProperty('projectBreakdown');
      expect(response.body.summary).toHaveProperty('dailyBreakdown');
      
      expect(response.body.summary.projectBreakdown).toHaveProperty('proj1');
      expect(response.body.summary.projectBreakdown.proj1.hours).toBe(5.5);
      expect(response.body.summary.projectBreakdown.proj1.entries).toBe(2);
    });

    it('should filter summary by project', async () => {
      const mockTimeEntries = [
        {
          id: 'time1',
          task_id: 'task1',
          project_id: 'proj1',
          hours: 2.5,
          description: 'Work 1',
          date: '2024-01-10T00:00:00.000Z',
          created_at: '2024-01-10T00:00:00.000Z',
          updated_at: '2024-01-10T00:00:00.000Z'
        }
      ];

      mockSheetsService.query.mockResolvedValue(mockTimeEntries);

      const response = await request(app)
        .get('/api/time-entries/summary?projectId=proj1')
        .expect(200);

      expect(response.body.summary.totalHours).toBe(2.5);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Time_Entries', [
        { field: 'project_id', operator: 'eq', value: 'proj1' }
      ]);
    });
  });
});