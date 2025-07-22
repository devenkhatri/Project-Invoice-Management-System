import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { initializeProjectRoutes } from '../projects';
import { authenticateToken } from '../../middleware/auth';
import { sanitizeInput } from '../../middleware/validation';
import { ProjectStatus } from '../../models/types';

// Mock the dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/validation');

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;
const mockedAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockedSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

describe('Projects API', () => {
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
    app.use('/api/projects', initializeProjectRoutes(mockSheetsService));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('should return all projects', async () => {
      const mockProjects = [
        {
          id: 'proj1',
          name: 'Test Project 1',
          client_id: 'client1',
          status: ProjectStatus.ACTIVE,
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-12-31T00:00:00.000Z',
          budget: 10000,
          description: 'Test project',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockSheetsService.read.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body).toHaveProperty('projects');
      expect(response.body).toHaveProperty('total', 1);
      expect(response.body.projects).toHaveLength(1);
      expect(mockSheetsService.read).toHaveBeenCalledWith('Projects');
    });

    it('should filter projects by status', async () => {
      const mockProjects = [
        {
          id: 'proj1',
          name: 'Active Project',
          status: ProjectStatus.ACTIVE,
          client_id: 'client1',
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-12-31T00:00:00.000Z',
          budget: 10000,
          description: 'Active project',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockSheetsService.read.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/projects?status=active')
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].status).toBe(ProjectStatus.ACTIVE);
    });

    it('should handle errors gracefully', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Failed to fetch projects');
      expect(response.body).toHaveProperty('code', 'FETCH_PROJECTS_ERROR');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project with tasks and stats', async () => {
      const mockProject = {
        id: 'proj1',
        name: 'Test Project',
        client_id: 'client1',
        status: ProjectStatus.ACTIVE,
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z',
        budget: 10000,
        description: 'Test project',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const mockTasks = [
        {
          id: 'task1',
          project_id: 'proj1',
          title: 'Task 1',
          description: 'Test task',
          status: 'completed',
          priority: 'medium',
          due_date: '2024-01-15T00:00:00.000Z',
          estimated_hours: 8,
          actual_hours: 6,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockSheetsService.read.mockResolvedValue([mockProject]);
      mockSheetsService.query.mockResolvedValue(mockTasks);

      const response = await request(app)
        .get('/api/projects/proj1')
        .expect(200);

      expect(response.body).toHaveProperty('project');
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.totalTasks).toBe(1);
      expect(response.body.stats.completedTasks).toBe(1);
      expect(response.body.stats.progress).toBe(100);
    });

    it('should return 404 for non-existent project', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/projects/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
      expect(response.body).toHaveProperty('code', 'PROJECT_NOT_FOUND');
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const newProject = {
        name: 'New Project',
        client_id: 'client1',
        status: ProjectStatus.ACTIVE,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 15000,
        description: 'New test project'
      };

      mockSheetsService.create.mockResolvedValue('proj123');

      const response = await request(app)
        .post('/api/projects')
        .send(newProject)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Project created successfully');
      expect(response.body).toHaveProperty('project');
      expect(response.body.project.name).toBe(newProject.name);
      expect(mockSheetsService.create).toHaveBeenCalledWith('Projects', expect.any(Object));
    });

    it('should validate project data', async () => {
      const invalidProject = {
        name: '', // Invalid: empty name
        client_id: 'client1',
        start_date: '2024-01-01',
        end_date: '2023-12-31', // Invalid: end date before start date
        budget: -1000 // Invalid: negative budget
      };

      const response = await request(app)
        .post('/api/projects')
        .send(invalidProject)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update an existing project', async () => {
      const existingProject = {
        id: 'proj1',
        name: 'Original Project',
        client_id: 'client1',
        status: ProjectStatus.ACTIVE,
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z',
        budget: 10000,
        description: 'Original description',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const updateData = {
        name: 'Updated Project',
        budget: 15000
      };

      mockSheetsService.read.mockResolvedValue([existingProject]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/projects/proj1')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Project updated successfully');
      expect(response.body.project.name).toBe(updateData.name);
      expect(response.body.project.budget).toBe(updateData.budget);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Projects', 'proj1', expect.any(Object));
    });

    it('should return 404 for non-existent project', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/projects/nonexistent')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete project and associated tasks/time entries', async () => {
      const existingProject = {
        id: 'proj1',
        name: 'Project to Delete',
        client_id: 'client1',
        status: ProjectStatus.ACTIVE,
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-12-31T00:00:00.000Z',
        budget: 10000,
        description: 'Project to be deleted',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const mockTasks = [
        { id: 'task1', project_id: 'proj1' },
        { id: 'task2', project_id: 'proj1' }
      ];

      const mockTimeEntries = [
        { id: 'time1', task_id: 'task1' }
      ];

      mockSheetsService.read.mockResolvedValue([existingProject]);
      mockSheetsService.query
        .mockResolvedValueOnce(mockTasks) // Tasks query
        .mockResolvedValueOnce(mockTimeEntries) // Time entries query for task1
        .mockResolvedValueOnce([]); // Time entries query for task2
      mockSheetsService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/projects/proj1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Project deleted successfully');
      
      // Verify deletion calls
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Time_Entries', 'time1');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Tasks', 'task1');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Tasks', 'task2');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Projects', 'proj1');
    });

    it('should return 404 for non-existent project', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/projects/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Project not found');
    });
  });
});