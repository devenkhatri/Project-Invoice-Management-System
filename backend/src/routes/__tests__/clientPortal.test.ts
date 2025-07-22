import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { initializeClientPortalRoutes } from '../clientPortal';
import { GoogleSheetsService } from '../../services/googleSheets';
import { sanitizeInput } from '../../middleware/validation';
import config from '../../config';

// Mock dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/validation');
jest.mock('jsonwebtoken');

const mockSheetsService = {
  read: jest.fn(),
  create: jest.fn(),
  query: jest.fn()
} as unknown as GoogleSheetsService;

const mockSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock middleware to pass through
mockSanitizeInput.mockImplementation((req, res, next) => next());

describe('Client Portal Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    const clientPortalRoutes = initializeClientPortalRoutes(mockSheetsService);
    app.use('/api/client-portal', clientPortalRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/client-portal/generate-access', () => {
    it('should generate client portal access token', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        address: 'Test Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const mockToken = 'mock-jwt-token';

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      const response = await request(app)
        .post('/api/client-portal/generate-access')
        .send({ client_id: 'client-1' })
        .expect(200);

      expect(response.body.message).toBe('Client portal access generated successfully');
      expect(response.body.client.id).toBe('client-1');
      expect(response.body.token).toBe(mockToken);
      expect(response.body.portalUrl).toContain(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          clientId: 'client-1',
          email: 'client@example.com',
          type: 'client_portal'
        },
        expect.any(String),
        { expiresIn: '7d' }
      );
    });

    it('should return 400 for missing client_id', async () => {
      const response = await request(app)
        .post('/api/client-portal/generate-access')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Client ID is required');
      expect(response.body.code).toBe('CLIENT_ID_REQUIRED');
    });

    it('should return 404 for non-existent client', async () => {
      (mockSheetsService.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/client-portal/generate-access')
        .send({ client_id: 'non-existent' })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('should accept custom expiration time', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        address: 'Test Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
      (mockJwt.sign as jest.Mock).mockReturnValue('mock-token');

      const response = await request(app)
        .post('/api/client-portal/generate-access')
        .send({ client_id: 'client-1', expires_in: '1d' })
        .expect(200);

      expect(response.body.expiresIn).toBe('1d');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { expiresIn: '1d' }
      );
    });
  });

  describe('POST /api/client-portal/login', () => {
    it('should login with valid token', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        address: 'Test Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const mockDecodedToken = {
        clientId: 'client-1',
        email: 'client@example.com',
        type: 'client_portal'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body.message).toBe('Client portal login successful');
      expect(response.body.client.id).toBe('client-1');
      expect(response.body.client.name).toBe('Test Client');
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/api/client-portal/login')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Access token is required');
      expect(response.body.code).toBe('TOKEN_REQUIRED');
    });

    it('should return 403 for invalid token type', async () => {
      const mockDecodedToken = {
        clientId: 'client-1',
        type: 'regular_user' // Wrong type
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({ token: 'invalid-type-token' })
        .expect(403);

      expect(response.body.error).toBe('Invalid token type');
      expect(response.body.code).toBe('INVALID_TOKEN_TYPE');
    });

    it('should return 403 for non-existent client', async () => {
      const mockDecodedToken = {
        clientId: 'non-existent',
        type: 'client_portal'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      (mockSheetsService.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({ token: 'valid-token' })
        .expect(403);

      expect(response.body.error).toBe('Client not found');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('should return 403 for invalid JWT', async () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({ token: 'invalid-token' })
        .expect(403);

      expect(response.body.error).toBe('Invalid or expired token');
      expect(response.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('Protected Routes', () => {
    let validToken: string;
    let mockClient: any;

    beforeEach(() => {
      validToken = 'Bearer valid-token';
      mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        address: 'Test Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      // Mock JWT verification for protected routes
      (mockJwt.verify as jest.Mock).mockReturnValue({
        clientId: 'client-1',
        email: 'client@example.com',
        type: 'client_portal'
      });

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
    });

    describe('GET /api/client-portal/dashboard', () => {
      it('should return client dashboard data', async () => {
        const mockProjects = [
          {
            id: 'project-1',
            name: 'Project 1',
            client_id: 'client-1',
            status: 'active',
            start_date: '2024-01-01T00:00:00.000Z',
            end_date: '2024-03-01T00:00:00.000Z',
            budget: 50000,
            description: 'Test project',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          },
          {
            id: 'project-2',
            name: 'Project 2',
            client_id: 'client-1',
            status: 'completed',
            start_date: '2024-01-01T00:00:00.000Z',
            end_date: '2024-02-01T00:00:00.000Z',
            budget: 30000,
            description: 'Completed project',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        const mockCommunications = [
          {
            id: 'comm-1',
            client_id: 'client-1',
            type: 'email',
            direction: 'outbound',
            subject: 'Test Email',
            content: 'Test content',
            follow_up_required: false,
            attachments: '',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        (mockSheetsService.query as jest.Mock)
          .mockResolvedValueOnce(mockProjects) // First call for projects
          .mockResolvedValueOnce(mockCommunications) // Second call for communications
          .mockResolvedValueOnce([]); // Third call for pending follow-ups

        const response = await request(app)
          .get('/api/client-portal/dashboard')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.client.id).toBe('client-1');
        expect(response.body.stats.totalProjects).toBe(2);
        expect(response.body.stats.activeProjects).toBe(1);
        expect(response.body.stats.completedProjects).toBe(1);
        expect(response.body.stats.totalBudget).toBe(80000);
        expect(response.body.projects).toHaveLength(2);
        expect(response.body.recentCommunications).toHaveLength(1);
      });

      it('should return 401 without token', async () => {
        const response = await request(app)
          .get('/api/client-portal/dashboard')
          .expect(401);

        expect(response.body.error).toBe('Access token required');
        expect(response.body.code).toBe('CLIENT_TOKEN_REQUIRED');
      });
    });

    describe('GET /api/client-portal/projects', () => {
      it('should return client projects', async () => {
        const mockProjects = [
          {
            id: 'project-1',
            name: 'Project 1',
            client_id: 'client-1',
            status: 'active',
            start_date: '2024-01-01T00:00:00.000Z',
            end_date: '2024-03-01T00:00:00.000Z',
            budget: 50000,
            description: 'Test project',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        // Mock the client verification first, then the projects query
        (mockSheetsService.read as jest.Mock)
          .mockResolvedValueOnce([mockClient]); // For auth middleware
        (mockSheetsService.query as jest.Mock)
          .mockResolvedValueOnce(mockProjects); // For projects query

        const response = await request(app)
          .get('/api/client-portal/projects')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.projects).toHaveLength(1);
        expect(response.body.projects[0].name).toBe('Project 1');
        expect(response.body.total).toBe(1);
      });

      it('should filter projects by status', async () => {
        const mockProjects = [
          {
            id: 'project-1',
            name: 'Active Project',
            client_id: 'client-1',
            status: 'active',
            start_date: '2024-01-01T00:00:00.000Z',
            end_date: '2024-03-01T00:00:00.000Z',
            budget: 50000,
            description: 'Test project',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        // Mock the client verification first, then the projects query
        (mockSheetsService.read as jest.Mock)
          .mockResolvedValueOnce([mockClient]); // For auth middleware
        (mockSheetsService.query as jest.Mock)
          .mockResolvedValueOnce(mockProjects); // For projects query

        const response = await request(app)
          .get('/api/client-portal/projects?status=active')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.projects).toHaveLength(1);
        expect(response.body.projects[0].status).toBe('active');
      });
    });

    describe('GET /api/client-portal/projects/:id', () => {
      it('should return project details for client project', async () => {
        const mockProject = {
          id: 'project-1',
          name: 'Project 1',
          client_id: 'client-1',
          status: 'active',
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-03-01T00:00:00.000Z',
          budget: 50000,
          description: 'Test project',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        };

        const mockTasks = [
          {
            id: 'task-1',
            project_id: 'project-1',
            title: 'Task 1',
            description: 'Test task',
            status: 'completed',
            priority: 'high',
            due_date: '2024-02-01T00:00:00.000Z',
            estimated_hours: 8,
            actual_hours: 6,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        const mockCommunications = [
          {
            id: 'comm-1',
            client_id: 'client-1',
            project_id: 'project-1',
            type: 'email',
            direction: 'outbound',
            subject: 'Project Update',
            content: 'Project is progressing well',
            follow_up_required: false,
            attachments: '',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ];

        (mockSheetsService.read as jest.Mock)
          .mockResolvedValueOnce([mockClient]) // Client verification
          .mockResolvedValueOnce([mockProject]); // Project data

        (mockSheetsService.query as jest.Mock)
          .mockResolvedValueOnce(mockTasks) // Tasks
          .mockResolvedValueOnce(mockCommunications); // Communications

        const response = await request(app)
          .get('/api/client-portal/projects/project-1')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.project.id).toBe('project-1');
        expect(response.body.tasks).toHaveLength(1);
        expect(response.body.communications).toHaveLength(1);
        expect(response.body.stats.totalTasks).toBe(1);
        expect(response.body.stats.completedTasks).toBe(1);
        expect(response.body.stats.progress).toBe(100);
      });

      it('should return 403 for project not belonging to client', async () => {
        const mockProject = {
          id: 'project-1',
          name: 'Project 1',
          client_id: 'other-client', // Different client
          status: 'active',
          start_date: '2024-01-01T00:00:00.000Z',
          end_date: '2024-03-01T00:00:00.000Z',
          budget: 50000,
          description: 'Test project',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        };

        (mockSheetsService.read as jest.Mock)
          .mockResolvedValueOnce([mockClient]) // Client verification
          .mockResolvedValueOnce([mockProject]); // Project data

        const response = await request(app)
          .get('/api/client-portal/projects/project-1')
          .set('Authorization', validToken)
          .expect(403);

        expect(response.body.error).toBe('Access denied to this project');
        expect(response.body.code).toBe('PROJECT_ACCESS_DENIED');
      });

      it('should return 404 for non-existent project', async () => {
        (mockSheetsService.read as jest.Mock)
          .mockResolvedValueOnce([mockClient]) // Client verification
          .mockResolvedValueOnce([]); // No project found

        const response = await request(app)
          .get('/api/client-portal/projects/non-existent')
          .set('Authorization', validToken)
          .expect(404);

        expect(response.body.error).toBe('Project not found');
        expect(response.body.code).toBe('PROJECT_NOT_FOUND');
      });
    });

    describe('POST /api/client-portal/communications', () => {
      it('should add communication from client', async () => {
        const newCommunication = {
          type: 'email',
          subject: 'Question about project',
          content: 'I have a question about the project timeline',
          project_id: 'project-1'
        };

        (mockSheetsService.create as jest.Mock).mockResolvedValue('comm-new');

        const response = await request(app)
          .post('/api/client-portal/communications')
          .set('Authorization', validToken)
          .send(newCommunication)
          .expect(201);

        expect(response.body.message).toBe('Message sent successfully');
        expect(response.body.communication.subject).toBe('Question about project');
        expect(response.body.communication.direction).toBe('inbound');
        expect(response.body.communication.contact_person).toBe('Test Client');
        expect(mockSheetsService.create).toHaveBeenCalledWith('Communications', expect.any(Object));
      });

      it('should validate communication data', async () => {
        const invalidCommunication = {
          type: 'email',
          subject: '', // Empty subject
          content: '' // Empty content
        };

        const response = await request(app)
          .post('/api/client-portal/communications')
          .set('Authorization', validToken)
          .send(invalidCommunication)
          .expect(400);

        expect(response.body.error).toBe('Validation failed');
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });
    });
  });
});