import request from 'supertest';
import app from '../../server';
import { SheetsService } from '../../services/sheets.service';
import { AuthService } from '../../middleware/auth';

// Mock the SheetsService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth');

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;
const mockAuthService = AuthService.getInstance as jest.MockedFunction<typeof AuthService.getInstance>;

describe('Time Entries API', () => {
  let sheetsService: jest.Mocked<SheetsService>;
  let authService: jest.Mocked<AuthService>;
  let adminToken: string;
  let clientToken: string;

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
    clientToken = 'client-token';

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
      } else if (token === clientToken) {
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
  });

  describe('POST /api/time-entries', () => {
    it('should create a new time entry successfully', async () => {
      const newTimeEntry = {
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Working on feature implementation',
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '13:00',
        is_billable: true
      };

      const mockTask = {
        id: 'task-1',
        project_id: 'project-1',
        title: 'Test Task',
        actual_hours: 0,
        status: 'todo',
        hourly_rate: 50
      };

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        hourly_rate: 45,
        actual_cost: 0
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
          return Promise.resolve([mockTask]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        } else if (sheetName === 'Expenses') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      sheetsService.create.mockResolvedValue('new-time-entry-id');
      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTimeEntry)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Time entry created successfully');
      expect(response.body).toHaveProperty('time_entry');
      expect(response.body.time_entry.hours).toBe(newTimeEntry.hours);
      expect(response.body.time_entry.description).toBe(newTimeEntry.description);

      // Verify time entry was created
      expect(sheetsService.create).toHaveBeenCalledWith('Time_Entries', expect.objectContaining({
        task_id: newTimeEntry.task_id,
        project_id: newTimeEntry.project_id,
        hours: newTimeEntry.hours,
        description: newTimeEntry.description
      }));

      // Verify task was updated
      expect(sheetsService.update).toHaveBeenCalledWith('Tasks', 'task-1', expect.objectContaining({
        actual_hours: 4,
        status: 'in-progress'
      }));

      // Verify project was updated
      expect(sheetsService.update).toHaveBeenCalledWith('Projects', 'project-1', expect.objectContaining({
        actual_cost: expect.any(Number)
      }));
    });

    it('should reject time entry for non-existent task', async () => {
      const newTimeEntry = {
        task_id: 'non-existent-task',
        project_id: 'project-1',
        hours: 4,
        description: 'Test work',
        date: '2024-01-15'
      };

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
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{ id: 'project-1', name: 'Test Project' }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTimeEntry)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Task not found');
    });

    it('should reject time entry for non-existent project', async () => {
      const newTimeEntry = {
        task_id: 'task-1',
        project_id: 'non-existent-project',
        hours: 4,
        description: 'Test work',
        date: '2024-01-15'
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{ id: 'task-1', project_id: 'project-1' }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTimeEntry)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Project not found');
    });

    it('should reject time entry when task does not belong to project', async () => {
      const newTimeEntry = {
        task_id: 'task-1',
        project_id: 'project-2',
        hours: 4,
        description: 'Test work',
        date: '2024-01-15'
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{ id: 'task-1', project_id: 'project-1' }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{ id: 'project-2', name: 'Different Project' }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTimeEntry)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Task does not belong to the specified project');
    });

    it('should reject invalid time range', async () => {
      const newTimeEntry = {
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Test work',
        date: '2024-01-15',
        start_time: '13:00',
        end_time: '09:00' // End before start
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{ id: 'task-1', project_id: 'project-1' }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{ id: 'project-1', name: 'Test Project' }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTimeEntry)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Invalid time range: end time must be after start time');
    });

    it('should require admin role', async () => {
      const newTimeEntry = {
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Test work',
        date: '2024-01-15'
      };

      sheetsService.query.mockResolvedValue([{
        id: 'client-id',
        email: 'client@test.com',
        role: 'client',
        is_active: true
      }]);

      await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(newTimeEntry)
        .expect(403);
    });
  });

  describe('GET /api/time-entries', () => {
    it('should return time entries for admin user', async () => {
      const mockTimeEntries = [
        {
          id: 'time-1',
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 4,
          description: 'Work on feature',
          date: '2024-01-15',
          is_billable: true,
          total_amount: 200
        },
        {
          id: 'time-2',
          task_id: 'task-2',
          project_id: 'project-1',
          hours: 2,
          description: 'Bug fixes',
          date: '2024-01-16',
          is_billable: false,
          total_amount: 0
        }
      ];

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        project_id: 'project-1'
      };

      const mockProject = {
        id: 'project-1',
        name: 'Test Project'
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([mockTask]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/time-entries')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('time_entries');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.time_entries).toHaveLength(2);
      expect(response.body.summary.total_hours).toBe(6);
      expect(response.body.summary.billable_hours).toBe(4);
      expect(response.body.summary.total_amount).toBe(200);
    });

    it('should filter time entries by project', async () => {
      const mockTimeEntries = [
        {
          id: 'time-1',
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 4,
          description: 'Project 1 work',
          date: '2024-01-15',
          is_billable: true
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
        } else if (sheetName === 'Time_Entries') {
          const projectFilter = options.filters?.find((f: any) => f.column === 'project_id');
          if (projectFilter && projectFilter.value === 'project-1') {
            return Promise.resolve(mockTimeEntries);
          }
          return Promise.resolve([]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{ id: 'task-1', title: 'Test Task' }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{ id: 'project-1', name: 'Test Project' }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/time-entries?project_id=project-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.time_entries).toHaveLength(1);
      expect(response.body.time_entries[0].project_id).toBe('project-1');
    });

    it('should return only client time entries for client user', async () => {
      const mockClients = [
        {
          id: 'client-1',
          email: 'client@test.com',
          name: 'Test Client'
        }
      ];

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Client Project',
          client_id: 'client-1'
        }
      ];

      const mockTimeEntries = [
        {
          id: 'time-1',
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 4,
          description: 'Client work',
          date: '2024-01-15',
          is_billable: true
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'client-id',
            email: 'client@test.com',
            role: 'client',
            is_active: true
          }]);
        } else if (sheetName === 'Clients') {
          return Promise.resolve(mockClients);
        } else if (sheetName === 'Projects') {
          return Promise.resolve(mockProjects);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{ id: 'task-1', title: 'Test Task' }]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/time-entries')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.time_entries).toHaveLength(1);
      expect(response.body.time_entries[0].project_id).toBe('project-1');
    });
  });

  describe('PUT /api/time-entries/:id', () => {
    it('should update a time entry successfully', async () => {
      const mockTimeEntry = {
        id: 'time-1',
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Original work',
        date: '2024-01-15',
        is_billable: true,
        invoice_id: null
      };

      const updateData = {
        hours: 6,
        description: 'Updated work description',
        is_billable: false
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([mockTimeEntry]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{
            id: 'task-1',
            actual_hours: 4,
            project_id: 'project-1'
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{
            id: 'project-1',
            name: 'Test Project',
            actual_cost: 200
          }]);
        } else if (sheetName === 'Expenses') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/time-entries/time-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Time entry updated successfully');
      expect(response.body.time_entry.hours).toBe(updateData.hours);
      expect(response.body.time_entry.description).toBe(updateData.description);
      expect(response.body.time_entry.is_billable).toBe(updateData.is_billable);

      // Verify time entry was updated
      expect(sheetsService.update).toHaveBeenCalledWith('Time_Entries', 'time-1', expect.objectContaining({
        hours: updateData.hours,
        description: updateData.description,
        is_billable: updateData.is_billable
      }));
    });

    it('should prevent updating billed time entry', async () => {
      const mockTimeEntry = {
        id: 'time-1',
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Billed work',
        date: '2024-01-15',
        is_billable: true,
        invoice_id: 'invoice-1' // Already billed
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([mockTimeEntry]);
        }
        return Promise.resolve([]);
      });

      const updateData = {
        hours: 6
      };

      const response = await request(app)
        .put('/api/time-entries/time-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot update billed time entry');
    });

    it('should return 404 for non-existent time entry', async () => {
      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const updateData = {
        hours: 6
      };

      await request(app)
        .put('/api/time-entries/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /api/time-entries/:id', () => {
    it('should delete a time entry successfully', async () => {
      const mockTimeEntry = {
        id: 'time-1',
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Work to delete',
        date: '2024-01-15',
        is_billable: true,
        invoice_id: null
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([mockTimeEntry]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([{
            id: 'task-1',
            actual_hours: 8,
            project_id: 'project-1'
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([{
            id: 'project-1',
            name: 'Test Project',
            actual_cost: 400
          }]);
        } else if (sheetName === 'Expenses') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      sheetsService.delete.mockResolvedValue(true);
      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/time-entries/time-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Time entry deleted successfully');

      // Verify time entry was deleted
      expect(sheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time-1');

      // Verify task hours were updated
      expect(sheetsService.update).toHaveBeenCalledWith('Tasks', 'task-1', expect.objectContaining({
        actual_hours: 4 // 8 - 4 = 4
      }));
    });

    it('should prevent deletion of billed time entry', async () => {
      const mockTimeEntry = {
        id: 'time-1',
        task_id: 'task-1',
        project_id: 'project-1',
        hours: 4,
        description: 'Billed work',
        date: '2024-01-15',
        is_billable: true,
        invoice_id: 'invoice-1' // Already billed
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([mockTimeEntry]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .delete('/api/time-entries/time-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot delete billed time entry');
    });

    it('should return 404 for non-existent time entry', async () => {
      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await request(app)
        .delete('/api/time-entries/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Test POST without token
      await request(app)
        .post('/api/time-entries')
        .send({
          task_id: 'task-1',
          project_id: 'project-1',
          hours: 4,
          description: 'Test work',
          date: '2024-01-15'
        })
        .expect(401);

      // Test GET without token
      await request(app)
        .get('/api/time-entries')
        .expect(401);

      // Test PUT without token
      await request(app)
        .put('/api/time-entries/time-1')
        .send({ hours: 6 })
        .expect(401);

      // Test DELETE without token
      await request(app)
        .delete('/api/time-entries/time-1')
        .expect(401);
    });
  });
});