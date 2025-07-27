import request from 'supertest';
import app from '../../server';
import { SheetsService } from '../../services/sheets.service';
import { AuthService } from '../../middleware/auth';

// Mock the SheetsService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth');

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;
const mockAuthService = AuthService.getInstance as jest.MockedFunction<typeof AuthService.getInstance>;

describe('Projects API', () => {
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

  describe('GET /api/projects', () => {
    it('should return projects for admin user', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          client_id: 'client-1',
          status: 'active',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          budget: 10000,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Test Task',
          status: 'completed',
          estimated_hours: 10,
          actual_hours: 8
        }
      ];

      const mockTimeEntries = [
        {
          id: 'time-1',
          project_id: 'project-1',
          task_id: 'task-1',
          hours: 8,
          is_billable: true
        }
      ];

      // Mock user verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve(mockProjects);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve(mockTasks);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        } else if (sheetName === 'Expenses') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0]).toHaveProperty('task_count', 1);
      expect(response.body.projects[0]).toHaveProperty('completed_tasks', 1);
    });

    it('should filter projects by status', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Active Project',
          status: 'active',
          client_id: 'client-1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          budget: 10000
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
        } else if (sheetName === 'Projects') {
          // Check if status filter is applied
          const statusFilter = options.filters?.find((f: any) => f.column === 'status');
          if (statusFilter && statusFilter.value === 'active') {
            return Promise.resolve(mockProjects);
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].status).toBe('active');
    });

    it('should return only client projects for client user', async () => {
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
          client_id: 'client-1',
          status: 'active',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          budget: 10000
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
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].client_id).toBe('client-1');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project for admin user', async () => {
      const newProject = {
        name: 'New Test Project',
        client_id: 'client-1',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 15000,
        description: 'Test project description'
      };

      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com'
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Clients') {
          return Promise.resolve([mockClient]);
        }
        return Promise.resolve([]);
      });

      sheetsService.create.mockResolvedValue('new-project-id');

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProject)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Project created successfully');
      expect(response.body).toHaveProperty('project');
      expect(response.body.project.name).toBe(newProject.name);
      expect(sheetsService.create).toHaveBeenCalledWith('Projects', expect.objectContaining({
        name: newProject.name,
        client_id: newProject.client_id,
        budget: newProject.budget
      }));
    });

    it('should reject project creation for non-existent client', async () => {
      const newProject = {
        name: 'New Test Project',
        client_id: 'non-existent-client',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 15000
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Clients') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newProject)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Client not found');
    });

    it('should reject project creation for client user', async () => {
      const newProject = {
        name: 'New Test Project',
        client_id: 'client-1',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 15000
      };

      sheetsService.query.mockResolvedValue([{
        id: 'client-id',
        email: 'client@test.com',
        role: 'client',
        is_active: true
      }]);

      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(newProject)
        .expect(403);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project details with tasks and analytics', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        client_id: 'client-1',
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 10000
      };

      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Task 1',
          status: 'completed',
          estimated_hours: 10,
          actual_hours: 8
        },
        {
          id: 'task-2',
          project_id: 'project-1',
          title: 'Task 2',
          status: 'in-progress',
          estimated_hours: 5,
          actual_hours: 3
        }
      ];

      const mockTimeEntries = [
        {
          id: 'time-1',
          project_id: 'project-1',
          task_id: 'task-1',
          hours: 8,
          is_billable: true
        }
      ];

      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com'
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve(mockTasks);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve(mockTimeEntries);
        } else if (sheetName === 'Expenses') {
          return Promise.resolve([]);
        } else if (sheetName === 'Clients') {
          return Promise.resolve([mockClient]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects/project-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('project');
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('time_entries');
      expect(response.body).toHaveProperty('expenses');
      expect(response.body.project.name).toBe('Test Project');
      expect(response.body.project.client.name).toBe('Test Client');
      expect(response.body.tasks.total).toBe(2);
      expect(response.body.tasks.completed).toBe(1);
    });

    it('should return 404 for non-existent project', async () => {
      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await request(app)
        .get('/api/projects/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project for admin user', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        client_id: 'client-1',
        status: 'active',
        budget: 10000
      };

      const updateData = {
        name: 'Updated Project Name',
        budget: 15000
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/projects/project-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Project updated successfully');
      expect(response.body.project.name).toBe(updateData.name);
      expect(response.body.project.budget).toBe(updateData.budget);
    });

    it('should reject update for client user', async () => {
      const updateData = {
        name: 'Updated Project Name'
      };

      sheetsService.query.mockResolvedValue([{
        id: 'client-id',
        email: 'client@test.com',
        role: 'client',
        is_active: true
      }]);

      await request(app)
        .put('/api/projects/project-1')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should archive project instead of deleting', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      };

      const mockTasks = [
        { id: 'task-1', project_id: 'project-1', status: 'active' }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Invoices') {
          return Promise.resolve([]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve(mockTasks);
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/projects/project-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Project archived successfully');
      expect(response.body.archived_items.project).toBe(1);
      expect(response.body.archived_items.tasks).toBe(1);
    });

    it('should prevent deletion of project with paid invoices', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        status: 'active'
      };

      const mockInvoices = [
        { id: 'invoice-1', project_id: 'project-1', status: 'paid' }
      ];

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .delete('/api/projects/project-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Cannot delete project with paid invoices. Archive the project instead.');
    });
  });

  describe('GET /api/projects/:id/tasks', () => {
    it('should return tasks for a project', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project'
      };

      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Task 1',
          status: 'completed',
          priority: 'high',
          estimated_hours: 10,
          actual_hours: 8
        },
        {
          id: 'task-2',
          project_id: 'project-1',
          title: 'Task 2',
          status: 'in-progress',
          priority: 'medium',
          estimated_hours: 5,
          actual_hours: 3
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve(mockTasks);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects/project-1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.tasks).toHaveLength(2);
      expect(response.body.summary.total).toBe(2);
      expect(response.body.summary.by_status.completed).toBe(1);
      expect(response.body.summary.by_status['in-progress']).toBe(1);
      expect(response.body.summary.by_priority.high).toBe(1);
      expect(response.body.summary.by_priority.medium).toBe(1);
    });

    it('should filter tasks by status', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project'
      };

      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Completed Task',
          status: 'completed',
          priority: 'high'
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
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Tasks') {
          const statusFilter = options.filters?.find((f: any) => f.column === 'status');
          if (statusFilter && statusFilter.value === 'completed') {
            return Promise.resolve(mockTasks);
          }
          return Promise.resolve([]);
        } else if (sheetName === 'Time_Entries') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/projects/project-1/tasks?status=completed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].status).toBe('completed');
    });
  });

  describe('POST /api/projects/:id/tasks', () => {
    it('should create a new task for a project', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        progress_percentage: 0
      };

      const newTask = {
        title: 'New Task',
        description: 'Task description',
        priority: 'high',
        due_date: '2024-12-31',
        estimated_hours: 10
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([mockProject]);
        } else if (sheetName === 'Tasks') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      sheetsService.create.mockResolvedValue('new-task-id');
      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/projects/project-1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTask)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Task created successfully');
      expect(response.body).toHaveProperty('task');
      expect(response.body.task.title).toBe(newTask.title);
      expect(response.body.task.project_id).toBe('project-1');
      expect(sheetsService.create).toHaveBeenCalledWith('Tasks', expect.objectContaining({
        title: newTask.title,
        project_id: 'project-1',
        priority: newTask.priority
      }));
    });

    it('should reject task creation for non-existent project', async () => {
      const newTask = {
        title: 'New Task',
        estimated_hours: 10
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Users') {
          return Promise.resolve([{
            id: 'admin-id',
            email: 'admin@test.com',
            role: 'admin',
            is_active: true
          }]);
        } else if (sheetName === 'Projects') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await request(app)
        .post('/api/projects/non-existent/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTask)
        .expect(404);
    });
  });
});