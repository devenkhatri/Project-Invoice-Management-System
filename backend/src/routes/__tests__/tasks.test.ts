import request from 'supertest';
import app from '../../server';
import { SheetsService } from '../../services/sheets.service';
import { AuthService } from '../../middleware/auth';

// Mock the SheetsService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth');

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;
const mockAuthService = AuthService.getInstance as jest.MockedFunction<typeof AuthService.getInstance>;

describe('Tasks API', () => {
  let sheetsService: jest.Mocked<SheetsService>;
  let authService: jest.Mocked<AuthService>;
  let adminToken: string;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock SheetsService
    sheetsService = {
      query: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      read: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      aggregate: jest.fn(),
      initializeSheets: jest.fn(),
      exportSheetData: jest.fn(),
      exportAllData: jest.fn(),
      clearSheet: jest.fn(),
      validateSheetStructure: jest.fn(),
      validateAllSheets: jest.fn(),
      validateRecordData: jest.fn()
    } as any;

    mockSheetsService.mockReturnValue(sheetsService);

    // Mock AuthService
    authService = {
      generateTokens: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      refreshAccessToken: jest.fn(),
      revokeRefreshToken: jest.fn()
    } as any;

    mockAuthService.mockReturnValue(authService);

    // Mock tokens
    adminToken = 'admin-token';

    // Mock token verification
    authService.verifyAccessToken.mockImplementation((token: string) => {
      if (token === adminToken) {
        return {
          id: 'admin-id',
          email: 'admin@test.com',
          role: 'admin',
          name: 'Admin User',
          type: 'access'
        };
      }
      throw new Error('Invalid token');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update a task successfully', async () => {
      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        title: 'Original Task',
        status: 'todo',
        priority: 'medium',
        estimated_hours: 10,
        actual_hours: 0
      };

      const updateData = {
        title: 'Updated Task',
        status: 'in-progress',
        priority: 'high'
      };

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        progress_percentage: 0
      };

      const mockAllTasks = [
        { ...mockTask, ...updateData },
        {
          id: 'task-2',
          project_id: 'project-1',
          status: 'completed'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          const idFilter = options.filters?.find((f: any) => f.column === 'id');
          if (idFilter && idFilter.value === 'task-1') {
            return Promise.resolve([mockTask]);
          } else if (options.filters?.find((f: any) => f.column === 'project_id')) {
            return Promise.resolve(mockAllTasks);
          }
          return Promise.resolve([]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/tasks/task-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task updated successfully');
      expect(response.body.task.title).toBe(updateData.title);
      expect(response.body.task.status).toBe(updateData.status);
      expect(response.body.task.priority).toBe(updateData.priority);

      // Verify project progress was updated
      expect(sheetsService.update).toHaveBeenCalledWith('Projects', 'project-1', expect.objectContaining({
        progress_percentage: expect.any(Number)
      }));
    });

    it('should return 404 for non-existent task', async () => {
      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const updateData = {
        title: 'Updated Task'
      };

      await request(app)
        .put('/api/tasks/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should require admin role', async () => {
      const clientToken = 'client-token';
      
      authService.verifyAccessToken.mockImplementation((token: string) => {
        if (token === clientToken) {
          return {
            id: 'client-id',
            email: 'client@test.com',
            role: 'client',
            name: 'Client User',
            type: 'access'
          };
        }
        throw new Error('Invalid token');
      });

      sheetsService.query.mockResolvedValue([{
        id: 'client-id',
        email: 'client@test.com',
        role: 'client',
        is_active: true
      }]);

      const updateData = {
        title: 'Updated Task'
      };

      await request(app)
        .put('/api/tasks/task-1')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task successfully', async () => {
      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        title: 'Task to Delete',
        status: 'todo'
      };

      const mockTimeEntries = [
        {
          id: 'time-1',
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 2,
          invoice_id: null // Not billed
        }
      ];

      const mockRemainingTasks = [
        {
          id: 'task-2',
          project_id: 'project-1',
          status: 'completed'
        }
      ];

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        progress_percentage: 50
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          const idFilter = options.filters?.find((f: any) => f.column === 'id');
          if (idFilter && idFilter.value === 'task-1') {
            return Promise.resolve([mockTask]);
          } else if (options.filters?.find((f: any) => f.column === 'project_id')) {
            return Promise.resolve(mockRemainingTasks);
          }
          return Promise.resolve([]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        }
        return Promise.resolve([]);
      });

      sheetsService.delete.mockResolvedValue(true);
      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/tasks/task-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task deleted successfully');
      expect(response.body.deleted_items.task).toBe(1);
      expect(response.body.deleted_items.time_entries).toBe(1);

      // Verify task was deleted
      expect(sheetsService.delete).toHaveBeenCalledWith('Tasks', 'task-1');
      
      // Verify time entries were deleted
      expect(sheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time-1');
      
      // Verify project progress was updated
      expect(sheetsService.update).toHaveBeenCalledWith('Projects', 'project-1', expect.objectContaining({
        progress_percentage: expect.any(Number)
      }));
    });

    it('should prevent deletion of task with billed time entries', async () => {
      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        title: 'Task with Billed Time',
        status: 'completed'
      };

      const mockTimeEntries = [
        {
          id: 'time-1',
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 8,
          invoice_id: 'invoice-1' // Already billed
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([mockTask]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .delete('/api/tasks/task-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot delete task with billed time entries');
      expect(response.body.dependencies.billed_entries).toBe(1);
    });

    it('should return 404 for non-existent task', async () => {
      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await request(app)
        .delete('/api/tasks/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should require admin role', async () => {
      const clientToken = 'client-token';
      
      authService.verifyAccessToken.mockImplementation((token: string) => {
        if (token === clientToken) {
          return {
            id: 'client-id',
            email: 'client@test.com',
            role: 'client',
            name: 'Client User',
            type: 'access'
          };
        }
        throw new Error('Invalid token');
      });

      sheetsService.query.mockResolvedValue([{
        id: 'client-id',
        email: 'client@test.com',
        role: 'client',
        is_active: true
      }]);

      await request(app)
        .delete('/api/tasks/task-1')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Test PUT without token
      await request(app)
        .put('/api/tasks/task-1')
        .send({ title: 'Updated Task' })
        .expect(401);

      // Test DELETE without token
      await request(app)
        .delete('/api/tasks/task-1')
        .expect(401);
    });

    it('should reject invalid tokens', async () => {
      authService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await request(app)
        .put('/api/tasks/task-1')
        .set('Authorization', 'Bearer invalid-token')
        .send({ title: 'Updated Task' })
        .expect(401);
    });
  });
});