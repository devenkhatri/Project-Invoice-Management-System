import request from 'supertest';
import app from '../../server';
import { SheetsService } from '../../services/sheets.service';
import { AuthService } from '../../middleware/auth';
import bcrypt from 'bcrypt';

// Mock the SheetsService and AuthService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth');
jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;
const mockAuthService = AuthService.getInstance as jest.MockedFunction<typeof AuthService.getInstance>;
const mockBcrypt = {
  compare: jest.fn()
} as any;

describe('Client Portal API', () => {
  let sheetsService: jest.Mocked<SheetsService>;
  let authService: jest.Mocked<AuthService>;
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
    clientToken = 'mock-client-token';

    // Mock token verification
    authService.verifyAccessToken.mockImplementation((token: string) => {
      if (token === clientToken) {
        return {
          id: 'client-1',
          email: 'client@example.com',
          role: 'client' as const,
          name: 'Client User',
          type: 'access' as const
        };
      }
      throw new Error('Invalid token');
    });

    // Mock token generation
    authService.generateTokens.mockReturnValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token'
    });
  });

  describe('POST /api/client-portal/login', () => {
    it('should login client with valid credentials', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        portal_access_enabled: true,
        portal_password_hash: 'hashed-password',
        is_active: true
      };

      sheetsService.query.mockResolvedValue([mockClient]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      sheetsService.update.mockResolvedValue(true);
      sheetsService.create.mockResolvedValue('activity-id');

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({
          email: 'client@example.com',
          password: 'correct-password'
        })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.tokens).toBeDefined();
      expect(response.body.client).toMatchObject({
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com'
      });

      expect(sheetsService.update).toHaveBeenCalledWith('Clients', 'client-1', expect.objectContaining({
        last_portal_login: expect.any(String)
      }));
    });

    it('should reject login with invalid password', async () => {
      const mockClient = {
        id: 'client-1',
        email: 'client@example.com',
        portal_access_enabled: true,
        portal_password_hash: 'hashed-password',
        is_active: true
      };

      sheetsService.query.mockResolvedValue([mockClient]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      sheetsService.create.mockResolvedValue('activity-id');

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({
          email: 'client@example.com',
          password: 'wrong-password'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
      expect(sheetsService.create).toHaveBeenCalledWith('Client_Activities', expect.objectContaining({
        activity: 'portal_login_failed'
      }));
    });

    it('should reject login for inactive client', async () => {
      sheetsService.query.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({
          email: 'inactive@example.com',
          password: 'password'
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login when portal access is disabled', async () => {
      const mockClient = {
        id: 'client-1',
        email: 'client@example.com',
        portal_access_enabled: false,
        is_active: true
      };

      sheetsService.query.mockResolvedValue([mockClient]);

      const response = await request(app)
        .post('/api/client-portal/login')
        .send({
          email: 'client@example.com',
          password: 'password'
        })
        .expect(403);

      expect(response.body.message).toBe('Portal access not enabled for this client');
    });
  });

  describe('POST /api/client-portal/logout', () => {
    beforeEach(() => {
      // Mock client verification for portal authentication
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          const emailFilter = options.filters?.find((f: any) => f.column === 'email');
          if (emailFilter?.value === 'client@example.com') {
            return Promise.resolve([{
              id: 'client-1',
              name: 'Client User',
              email: 'client@example.com',
              is_active: true,
              portal_access_enabled: true
            }]);
          }
        }
        return Promise.resolve([]);
      });
    });

    it('should logout client successfully', async () => {
      authService.revokeRefreshToken.mockResolvedValue();
      sheetsService.create.mockResolvedValue('activity-id');

      const response = await request(app)
        .post('/api/client-portal/logout')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ refreshToken: 'refresh-token' })
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('GET /api/client-portal/dashboard', () => {
    beforeEach(() => {
      // Mock client verification for portal authentication
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          const emailFilter = options.filters?.find((f: any) => f.column === 'email');
          if (emailFilter?.value === 'client@example.com') {
            return Promise.resolve([{
              id: 'client-1',
              name: 'Client User',
              email: 'client@example.com',
              company_name: 'Test Company',
              contact_person: 'John Doe',
              default_currency: 'INR',
              is_active: true,
              portal_access_enabled: true
            }]);
          }
        }
        return Promise.resolve([]);
      });
    });

    it('should return client dashboard data', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          status: 'active',
          progress_percentage: 75,
          end_date: '2024-12-31',
          budget: 10000
        },
        {
          id: 'project-2',
          name: 'Completed Project',
          status: 'completed',
          progress_percentage: 100,
          budget: 5000
        }
      ];

      const mockInvoices = [
        {
          id: 'invoice-1',
          invoice_number: 'INV-001',
          total_amount: 5000,
          paid_amount: 5000,
          status: 'paid',
          due_date: '2024-01-31',
          issue_date: '2024-01-01'
        },
        {
          id: 'invoice-2',
          invoice_number: 'INV-002',
          total_amount: 3000,
          paid_amount: 0,
          status: 'sent',
          due_date: '2024-02-28',
          issue_date: '2024-02-01'
        }
      ];

      const mockCommunications = [
        {
          id: 'comm-1',
          subject: 'Project Update',
          message: 'Project is progressing well',
          created_at: '2024-01-15T10:00:00.000Z',
          sender: 'admin'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            company_name: 'Test Company',
            contact_person: 'John Doe',
            default_currency: 'INR',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Projects') {
          return Promise.resolve(mockProjects);
        }
        if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices);
        }
        if (sheetName === 'Client_Communications') {
          return Promise.resolve(mockCommunications);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/client-portal/dashboard')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.client).toMatchObject({
        id: 'client-1',
        name: 'Client User',
        email: 'client@example.com',
        company: 'Test Company'
      });

      expect(response.body.summary.projects).toMatchObject({
        total: 2,
        active: 1,
        completed: 1,
        on_hold: 0
      });

      expect(response.body.summary.invoices).toMatchObject({
        total: 2,
        pending: 1,
        paid: 1
      });

      expect(response.body.summary.financial).toMatchObject({
        total_invoiced: 8000,
        paid_amount: 5000,
        outstanding_amount: 3000,
        currency: 'INR'
      });

      expect(response.body.recent_projects).toHaveLength(2);
      expect(response.body.recent_invoices).toHaveLength(2);
      expect(response.body.upcoming_deadlines).toBeDefined();
      expect(response.body.recent_communications).toHaveLength(1);
    });
  });

  describe('GET /api/client-portal/projects/:id', () => {
    beforeEach(() => {
      // Mock client verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should return project details for client', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        description: 'A test project',
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        budget: 10000,
        currency: 'INR',
        client_id: 'client-1'
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'completed',
          due_date: '2024-06-30',
          priority: 'high'
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: 'in-progress',
          due_date: '2024-07-31',
          priority: 'medium'
        }
      ];

      const mockInvoices = [
        {
          id: 'invoice-1',
          invoice_number: 'INV-001',
          total_amount: 5000,
          paid_amount: 5000,
          status: 'paid',
          due_date: '2024-01-31',
          issue_date: '2024-01-01'
        }
      ];

      const mockCommunications = [
        {
          id: 'comm-1',
          subject: 'Project Update',
          message: 'Project milestone completed',
          created_at: '2024-01-15T10:00:00.000Z',
          sender: 'admin'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Projects') {
          const idFilter = options.filters?.find((f: any) => f.column === 'id');
          const clientFilter = options.filters?.find((f: any) => f.column === 'client_id');
          if (idFilter?.value === 'project-1' && clientFilter?.value === 'client-1') {
            return Promise.resolve([mockProject]);
          }
        }
        if (sheetName === 'Tasks') {
          return Promise.resolve(mockTasks);
        }
        if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices);
        }
        if (sheetName === 'Client_Communications') {
          return Promise.resolve(mockCommunications);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/client-portal/projects/project-1')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.project).toMatchObject({
        id: 'project-1',
        name: 'Test Project',
        status: 'active',
        progress_percentage: 50 // 1 completed out of 2 tasks
      });

      expect(response.body.tasks.total).toBe(2);
      expect(response.body.tasks.by_status).toMatchObject({
        todo: 0,
        'in-progress': 1,
        completed: 1
      });

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.communications).toHaveLength(1);
    });

    it('should return 404 for project not belonging to client', async () => {
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Projects') {
          return Promise.resolve([]); // No matching project
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/client-portal/projects/other-project')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);

      expect(response.body.message).toBe('Project not found');
    });
  });

  describe('POST /api/client-portal/messages', () => {
    beforeEach(() => {
      // Mock client verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should send message successfully', async () => {
      const messageData = {
        subject: 'Question about project',
        message: 'I have a question about the project timeline.',
        project_id: 'project-1'
      };

      // Mock project verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Projects') {
          const idFilter = options.filters?.find((f: any) => f.column === 'id');
          const clientFilter = options.filters?.find((f: any) => f.column === 'client_id');
          if (idFilter?.value === 'project-1' && clientFilter?.value === 'client-1') {
            return Promise.resolve([{ id: 'project-1', client_id: 'client-1' }]);
          }
        }
        return Promise.resolve([]);
      });

      sheetsService.create.mockResolvedValue('message-id');

      const response = await request(app)
        .post('/api/client-portal/messages')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.message).toBe('Message sent successfully');
      expect(response.body.communication.subject).toBe('Question about project');

      expect(sheetsService.create).toHaveBeenCalledWith('Client_Communications', expect.objectContaining({
        client_id: 'client-1',
        project_id: 'project-1',
        subject: 'Question about project',
        message: 'I have a question about the project timeline.',
        sender: 'client',
        sender_name: 'Client User',
        sender_email: 'client@example.com',
        status: 'unread'
      }));
    });

    it('should reject message with invalid project', async () => {
      const messageData = {
        subject: 'Question',
        message: 'Test message',
        project_id: 'invalid-project'
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Projects') {
          return Promise.resolve([]); // No matching project
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/client-portal/messages')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(messageData)
        .expect(400);

      expect(response.body.message).toBe('Invalid project ID');
    });

    it('should require subject and message', async () => {
      const response = await request(app)
        .post('/api/client-portal/messages')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Subject and message are required');
    });
  });

  describe('GET /api/client-portal/communications', () => {
    beforeEach(() => {
      // Mock client verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should return client communications', async () => {
      const mockCommunications = [
        {
          id: 'comm-1',
          client_id: 'client-1',
          subject: 'Project Update',
          message: 'Your project is progressing well',
          sender: 'admin',
          sender_name: 'Admin User',
          status: 'unread',
          thread_id: 'thread-1',
          created_at: '2024-01-15T10:00:00.000Z'
        },
        {
          id: 'comm-2',
          client_id: 'client-1',
          subject: 'Invoice Sent',
          message: 'Your invoice has been sent',
          sender: 'admin',
          sender_name: 'Admin User',
          status: 'read',
          thread_id: 'thread-2',
          created_at: '2024-01-10T09:00:00.000Z'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Client_Communications') {
          const clientFilter = options.filters?.find((f: any) => f.column === 'client_id');
          if (clientFilter?.value === 'client-1') {
            return Promise.resolve(mockCommunications);
          }
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/client-portal/communications')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.communications).toHaveLength(2);
      expect(response.body.communications[0]).toMatchObject({
        id: 'comm-1',
        subject: 'Project Update',
        sender: 'admin',
        is_read: false
      });

      expect(response.body.threads).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter communications by project', async () => {
      const mockCommunications = [
        {
          id: 'comm-1',
          client_id: 'client-1',
          project_id: 'project-1',
          subject: 'Project Update',
          message: 'Project specific message',
          sender: 'admin',
          status: 'unread',
          created_at: '2024-01-15T10:00:00.000Z'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Client_Communications') {
          const clientFilter = options.filters?.find((f: any) => f.column === 'client_id');
          const projectFilter = options.filters?.find((f: any) => f.column === 'project_id');
          if (clientFilter?.value === 'client-1' && projectFilter?.value === 'project-1') {
            return Promise.resolve(mockCommunications);
          }
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/client-portal/communications?project_id=project-1')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.communications).toHaveLength(1);
      expect(response.body.communications[0].project_id).toBe('project-1');
    });
  });

  describe('PUT /api/client-portal/communications/:id/read', () => {
    beforeEach(() => {
      // Mock client verification
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        return Promise.resolve([]);
      });
    });

    it('should mark communication as read', async () => {
      const mockCommunication = {
        id: 'comm-1',
        client_id: 'client-1',
        status: 'unread'
      };

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Client_Communications') {
          const idFilter = options.filters?.find((f: any) => f.column === 'id');
          const clientFilter = options.filters?.find((f: any) => f.column === 'client_id');
          if (idFilter?.value === 'comm-1' && clientFilter?.value === 'client-1') {
            return Promise.resolve([mockCommunication]);
          }
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/client-portal/communications/comm-1/read')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.message).toBe('Communication marked as read');
      expect(sheetsService.update).toHaveBeenCalledWith('Client_Communications', 'comm-1', {
        status: 'read',
        read_at: expect.any(String)
      });
    });

    it('should return 404 for communication not belonging to client', async () => {
      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([{
            id: 'client-1',
            name: 'Client User',
            email: 'client@example.com',
            is_active: true,
            portal_access_enabled: true
          }]);
        }
        if (sheetName === 'Client_Communications') {
          return Promise.resolve([]); // No matching communication
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .put('/api/client-portal/communications/other-comm/read')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);

      expect(response.body.message).toBe('Communication not found');
    });
  });
});