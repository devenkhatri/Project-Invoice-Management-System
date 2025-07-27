import request from 'supertest';
import app from '../../server';
import { SheetsService } from '../../services/sheets.service';
import { AuthService } from '../../middleware/auth';

// Mock the SheetsService and AuthService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth');

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;
const mockAuthService = AuthService.getInstance as jest.MockedFunction<typeof AuthService.getInstance>;

describe('Clients API', () => {
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
    adminToken = 'mock-admin-token';
    clientToken = 'mock-client-token';

    // Mock token verification
    authService.verifyAccessToken.mockImplementation((token: string) => {
      if (token === adminToken) {
        return {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin' as const,
          name: 'Admin User',
          type: 'access' as const
        };
      } else if (token === clientToken) {
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

    // Mock user verification
    sheetsService.query.mockImplementation((sheetName: string, options: any) => {
      if (sheetName === 'Users') {
        const email = options.filters?.find((f: any) => f.column === 'email')?.value;
        if (email === 'admin@example.com') {
          return Promise.resolve([{
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'admin',
            name: 'Admin User',
            is_active: true
          }]);
        } else if (email === 'client@example.com') {
          return Promise.resolve([{
            id: 'client-1',
            email: 'client@example.com',
            role: 'client',
            name: 'Client User',
            is_active: true
          }]);
        }
      }
      return Promise.resolve([]);
    });
  });

  describe('GET /api/clients', () => {
    it('should return clients list for admin', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+1234567890',
          address: '123 Test St',
          country: 'India',
          gstin: '22AAAAA0000A1Z5',
          payment_terms: 'Net 30',
          default_currency: 'INR',
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Clients') {
          return Promise.resolve(mockClients);
        }
        if (sheetName === 'Projects' || sheetName === 'Invoices') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.clients).toHaveLength(1);
      expect(response.body.clients[0]).toMatchObject({
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        gst_compliant: true
      });
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter clients by search term', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Test Client',
          email: 'test@example.com',
          phone: '+1234567890',
          address: '123 Test St',
          country: 'India',
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      sheetsService.query.mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients?search=Test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.clients).toHaveLength(1);
      expect(response.body.clients[0].name).toBe('Test Client');
    });

    it('should return only client own record for client role', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Client User',
          email: 'client@example.com',
          phone: '+1234567890',
          address: '123 Client St',
          country: 'India',
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string, options: any) => {
        if (sheetName === 'Clients') {
          const emailFilter = options.filters?.find((f: any) => f.column === 'email');
          if (emailFilter?.value === 'client@example.com') {
            return Promise.resolve(mockClients);
          }
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.clients).toHaveLength(1);
      expect(response.body.clients[0].email).toBe('client@example.com');
    });
  });

  describe('POST /api/clients', () => {
    it('should create a new client with valid data', async () => {
      const newClient = {
        name: 'New Client',
        email: 'new@example.com',
        phone: '+1234567890',
        address: '123 New St',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        gstin: '27AAAAA0000A1Z5',
        payment_terms: 'Net 30'
      };

      sheetsService.query.mockResolvedValue([]); // No existing clients
      sheetsService.create.mockResolvedValue('new-client-id');

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newClient)
        .expect(201);

      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.client).toMatchObject({
        name: 'New Client',
        email: 'new@example.com',
        gst_compliant: true
      });
      expect(sheetsService.create).toHaveBeenCalledWith('Clients', expect.objectContaining({
        name: 'New Client',
        email: 'new@example.com',
        country: 'India',
        default_currency: 'INR'
      }));
    });

    it('should reject client creation with invalid GSTIN', async () => {
      const newClient = {
        name: 'New Client',
        email: 'new@example.com',
        phone: '+1234567890',
        address: '123 New St',
        country: 'India',
        gstin: 'INVALID_GSTIN'
      };

      sheetsService.query.mockResolvedValue([]); // No existing clients

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newClient)
        .expect(400);

      expect(response.body.message).toBe('Invalid GSTIN format');
      expect(sheetsService.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      const newClient = {
        name: 'New Client',
        email: 'existing@example.com',
        phone: '+1234567890',
        address: '123 New St'
      };

      sheetsService.query.mockResolvedValue([{ id: 'existing-client', email: 'existing@example.com' }]);

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newClient)
        .expect(400);

      expect(response.body.message).toBe('Client with this email already exists');
      expect(sheetsService.create).not.toHaveBeenCalled();
    });

    it('should reject client creation for non-admin users', async () => {
      const newClient = {
        name: 'New Client',
        email: 'new@example.com',
        phone: '+1234567890',
        address: '123 New St'
      };

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(newClient)
        .expect(403);

      expect(response.body.message).toContain('Access denied');
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should return client details with related data', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        phone: '+1234567890',
        address: '123 Test St',
        country: 'India',
        gstin: '22AAAAA0000A1Z5',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z'
      };

      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          status: 'active',
          budget: 10000,
          actual_cost: 5000
        }
      ];

      const mockInvoices = [
        {
          id: 'invoice-1',
          invoice_number: 'INV-001',
          total_amount: 5000,
          paid_amount: 5000,
          status: 'paid'
        }
      ];

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([mockClient]);
        }
        if (sheetName === 'Projects') {
          return Promise.resolve(mockProjects);
        }
        if (sheetName === 'Invoices') {
          return Promise.resolve(mockInvoices);
        }
        if (sheetName === 'Client_Communications') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/clients/client-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.client).toMatchObject({
        id: 'client-1',
        name: 'Test Client',
        gst_compliant: true
      });
      expect(response.body.projects.all).toHaveLength(1);
      expect(response.body.invoices.all).toHaveLength(1);
      expect(response.body.financial_summary).toBeDefined();
    });

    it('should return 404 for non-existent client', async () => {
      sheetsService.query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/clients/non-existent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).toBe('Client not found');
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update client information', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Old Name',
        email: 'old@example.com',
        phone: '+1234567890',
        address: '123 Old St',
        country: 'India',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z'
      };

      const updateData = {
        name: 'Updated Name',
        phone: '+9876543210'
      };

      sheetsService.query.mockResolvedValue([existingClient]);
      sheetsService.update.mockResolvedValue(true);
      sheetsService.create.mockResolvedValue('activity-id'); // For activity logging

      const response = await request(app)
        .put('/api/clients/client-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Client updated successfully');
      expect(response.body.client.name).toBe('Updated Name');
      expect(sheetsService.update).toHaveBeenCalledWith('Clients', 'client-1', expect.objectContaining({
        name: 'Updated Name',
        phone: '+9876543210'
      }));
    });

    it('should reject update with invalid GSTIN', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        country: 'India',
        is_active: true
      };

      const updateData = {
        gstin: 'INVALID_GSTIN'
      };

      sheetsService.query.mockResolvedValue([existingClient]);

      const response = await request(app)
        .put('/api/clients/client-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toBe('Invalid GSTIN format');
      expect(sheetsService.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should soft delete client when no dependencies', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        is_active: true
      };

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([existingClient]);
        }
        if (sheetName === 'Projects' || sheetName === 'Invoices') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      sheetsService.update.mockResolvedValue(true);
      sheetsService.create.mockResolvedValue('activity-id'); // For activity logging

      const response = await request(app)
        .delete('/api/clients/client-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Client deactivated successfully');
      expect(sheetsService.update).toHaveBeenCalledWith('Clients', 'client-1', {
        is_active: false,
        updated_at: expect.any(String)
      });
    });

    it('should prevent deletion with active projects', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Test Client',
        is_active: true
      };

      const activeProjects = [
        { id: 'project-1', status: 'active' }
      ];

      sheetsService.query.mockImplementation((sheetName: string) => {
        if (sheetName === 'Clients') {
          return Promise.resolve([existingClient]);
        }
        if (sheetName === 'Projects') {
          return Promise.resolve(activeProjects);
        }
        if (sheetName === 'Invoices') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .delete('/api/clients/client-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('Cannot delete client with active projects');
      expect(sheetsService.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/clients/onboard', () => {
    it('should onboard client with documents', async () => {
      const onboardingData = {
        client_data: {
          name: 'New Client',
          email: 'new@example.com',
          phone: '+1234567890',
          address: '123 New St',
          country: 'India'
        },
        documents: [
          {
            type: 'gstin_certificate',
            name: 'GSTIN Certificate.pdf',
            file_url: 'https://example.com/gstin.pdf'
          }
        ],
        portal_access: true
      };

      sheetsService.query.mockResolvedValue([]); // No existing clients
      sheetsService.create.mockResolvedValue('new-id');

      const response = await request(app)
        .post('/api/clients/onboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(onboardingData)
        .expect(201);

      expect(response.body.message).toBe('Client onboarded successfully');
      expect(response.body.client.portal_access_enabled).toBe(true);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.next_steps).toBeDefined();
      
      expect(sheetsService.create).toHaveBeenCalledWith('Clients', expect.objectContaining({
        name: 'New Client',
        portal_access_enabled: true
      }));
      expect(sheetsService.create).toHaveBeenCalledWith('Client_Documents', expect.objectContaining({
        document_type: 'gstin_certificate'
      }));
    });
  });

  describe('GET /api/clients/:id/activities', () => {
    it('should return client activity audit trail', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          client_id: 'client-1',
          activity: 'client_created',
          metadata: '{"created_by": "admin-1"}',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      sheetsService.query.mockResolvedValue(mockActivities);

      const response = await request(app)
        .get('/api/clients/client-1/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(1);
      expect(response.body.activities[0]).toMatchObject({
        id: 'activity-1',
        activity: 'client_created',
        metadata: { created_by: 'admin-1' }
      });
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('PUT /api/clients/:id/portal-access', () => {
    it('should enable portal access with password', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        is_active: true
      };

      sheetsService.query.mockResolvedValue([existingClient]);
      sheetsService.update.mockResolvedValue(true);
      sheetsService.create.mockResolvedValue('activity-id');

      const response = await request(app)
        .put('/api/clients/client-1/portal-access')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          enabled: true,
          password: 'SecurePassword123!'
        })
        .expect(200);

      expect(response.body.message).toBe('Portal access enabled successfully');
      expect(response.body.portal_access_enabled).toBe(true);
      expect(response.body.password_set).toBe(true);
      
      expect(sheetsService.update).toHaveBeenCalledWith('Clients', 'client-1', expect.objectContaining({
        portal_access_enabled: true,
        portal_password_hash: expect.any(String)
      }));
    });

    it('should disable portal access', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Test Client',
        portal_access_enabled: true
      };

      sheetsService.query.mockResolvedValue([existingClient]);
      sheetsService.update.mockResolvedValue(true);
      sheetsService.create.mockResolvedValue('activity-id');

      const response = await request(app)
        .put('/api/clients/client-1/portal-access')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.message).toBe('Portal access disabled successfully');
      expect(response.body.portal_access_enabled).toBe(false);
    });
  });
});