import request from 'supertest';
import express from 'express';
import { initializeClientRoutes } from '../clients';
import { GoogleSheetsService } from '../../services/googleSheets';
import { Client } from '../../models/Client';
import { Project } from '../../models/Project';
import { Communication } from '../../models/Communication';
import { authenticateToken } from '../../middleware/auth';
import { sanitizeInput } from '../../middleware/validation';

// Mock dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/validation');

const mockSheetsService = {
  read: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  batchCreate: jest.fn()
} as unknown as GoogleSheetsService;

const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockSanitizeInput = sanitizeInput as jest.MockedFunction<typeof sanitizeInput>;

// Mock middleware to pass through
mockAuthenticateToken.mockImplementation((req, res, next) => {
  (req as any).user = { id: 'user-1', email: 'test@example.com' };
  next();
});

mockSanitizeInput.mockImplementation((req, res, next) => next());

describe('Client Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    const clientRoutes = initializeClientRoutes(mockSheetsService);
    app.use('/api/clients', clientRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/clients', () => {
    it('should return all clients', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Test Client 1',
          email: 'client1@example.com',
          phone: '1234567890',
          address: 'Test Address 1',
          gstin: '27AABCT1234C1Z5',
          payment_terms: 'Net 30',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'client-2',
          name: 'Test Client 2',
          email: 'client2@example.com',
          phone: '1234567891',
          address: 'Test Address 2',
          gstin: '',
          payment_terms: 'Net 15',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      (mockSheetsService.read as jest.Mock).mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients')
        .expect(200);

      expect(response.body.clients).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.clients[0].name).toBe('Test Client 1');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Clients');
    });

    it('should filter clients by search term', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Tech Solutions',
          email: 'tech@example.com',
          phone: '1234567890',
          address: 'Test Address',
          gstin: '',
          payment_terms: 'Net 30',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      (mockSheetsService.read as jest.Mock).mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients?search=tech')
        .expect(200);

      expect(response.body.clients).toHaveLength(1);
      expect(response.body.clients[0].name).toBe('Tech Solutions');
    });

    it('should filter clients by GSTIN presence', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Client With GSTIN',
          email: 'client1@example.com',
          phone: '1234567890',
          address: 'Test Address',
          gstin: '27AABCT1234C1Z5',
          payment_terms: 'Net 30',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        },
        {
          id: 'client-2',
          name: 'Client Without GSTIN',
          email: 'client2@example.com',
          phone: '1234567891',
          address: 'Test Address',
          gstin: '',
          payment_terms: 'Net 30',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      (mockSheetsService.read as jest.Mock).mockResolvedValue(mockClients);

      const response = await request(app)
        .get('/api/clients?has_gstin=true')
        .expect(200);

      expect(response.body.clients).toHaveLength(1);
      expect(response.body.clients[0].name).toBe('Client With GSTIN');
    });

    it('should handle errors gracefully', async () => {
      (mockSheetsService.read as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/clients')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch clients');
      expect(response.body.code).toBe('FETCH_CLIENTS_ERROR');
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should return a specific client', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@example.com',
        phone: '1234567890',
        address: 'Test Address',
        gstin: '27AABCT1234C1Z5',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);

      const response = await request(app)
        .get('/api/clients/client-1')
        .expect(200);

      expect(response.body.client.id).toBe('client-1');
      expect(response.body.client.name).toBe('Test Client');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Clients', 'client-1');
    });

    it('should return 404 for non-existent client', async () => {
      (mockSheetsService.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/clients/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Client not found');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('GET /api/clients/:id/projects', () => {
    it('should return client projects with statistics', async () => {
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

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
      (mockSheetsService.query as jest.Mock).mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/clients/client-1/projects')
        .expect(200);

      expect(response.body.client.id).toBe('client-1');
      expect(response.body.projects).toHaveLength(2);
      expect(response.body.stats.totalProjects).toBe(2);
      expect(response.body.stats.activeProjects).toBe(1);
      expect(response.body.stats.completedProjects).toBe(1);
      expect(response.body.stats.totalBudget).toBe(80000);
    });

    it('should filter projects by status', async () => {
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

      (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
      (mockSheetsService.query as jest.Mock).mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/clients/client-1/projects?status=active')
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.projects[0].status).toBe('active');
    });
  });

  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const newClient = {
        name: 'New Client',
        email: 'new@example.com',
        phone: '1234567890',
        address: 'New Address',
        gstin: '27AABCT1234C1Z5',
        payment_terms: 'Net 30'
      };

      (mockSheetsService.query as jest.Mock).mockResolvedValue([]); // No duplicate email
      (mockSheetsService.create as jest.Mock).mockResolvedValue('client-new');

      const response = await request(app)
        .post('/api/clients')
        .send(newClient)
        .expect(201);

      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.client.name).toBe('New Client');
      expect(response.body.client.id).toBe('client-new');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Clients', expect.any(Object));
    });

    it('should reject duplicate email', async () => {
      const newClient = {
        name: 'New Client',
        email: 'existing@example.com',
        phone: '1234567890',
        address: 'New Address'
      };

      const existingClient = {
        id: 'existing-client',
        email: 'existing@example.com'
      };

      (mockSheetsService.query as jest.Mock).mockResolvedValue([existingClient]);

      const response = await request(app)
        .post('/api/clients')
        .send(newClient)
        .expect(409);

      expect(response.body.error).toBe('Client with this email already exists');
      expect(response.body.code).toBe('DUPLICATE_EMAIL');
    });

    it('should validate required fields', async () => {
      const invalidClient = {
        name: '', // Empty name
        email: 'invalid-email', // Invalid email format
        phone: '123' // Too short phone
      };

      const response = await request(app)
        .post('/api/clients')
        .send(invalidClient)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update an existing client', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Old Name',
        email: 'old@example.com',
        phone: '1234567890',
        address: 'Old Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const updateData = {
        name: 'Updated Name',
        address: 'Updated Address'
      };

      (mockSheetsService.read as jest.Mock).mockResolvedValue([existingClient]);
      (mockSheetsService.update as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .put('/api/clients/client-1')
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Client updated successfully');
      expect(response.body.client.name).toBe('Updated Name');
      expect(response.body.client.address).toBe('Updated Address');
      expect(mockSheetsService.update).toHaveBeenCalledWith('Clients', 'client-1', expect.any(Object));
    });

    it('should return 404 for non-existent client', async () => {
      (mockSheetsService.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .put('/api/clients/non-existent')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('should check for duplicate email when updating', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Client 1',
        email: 'client1@example.com',
        phone: '1234567890',
        address: 'Address',
        gstin: '',
        payment_terms: 'Net 30',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      const duplicateClient = {
        id: 'client-2',
        email: 'duplicate@example.com'
      };

      (mockSheetsService.read as jest.Mock).mockResolvedValue([existingClient]);
      (mockSheetsService.query as jest.Mock).mockResolvedValue([duplicateClient]);

      const response = await request(app)
        .put('/api/clients/client-1')
        .send({ email: 'duplicate@example.com' })
        .expect(409);

      expect(response.body.error).toBe('Client with this email already exists');
      expect(response.body.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete a client without projects', async () => {
      const existingClient = {
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

      (mockSheetsService.read as jest.Mock).mockResolvedValue([existingClient]);
      (mockSheetsService.query as jest.Mock).mockResolvedValue([]); // No projects
      (mockSheetsService.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/clients/client-1')
        .expect(200);

      expect(response.body.message).toBe('Client deleted successfully');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Clients', 'client-1');
    });

    it('should not delete client with associated projects', async () => {
      const existingClient = {
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

      const clientProjects = [
        { id: 'project-1', client_id: 'client-1' }
      ];

      (mockSheetsService.read as jest.Mock).mockResolvedValue([existingClient]);
      (mockSheetsService.query as jest.Mock).mockResolvedValue(clientProjects);

      const response = await request(app)
        .delete('/api/clients/client-1')
        .expect(409);

      expect(response.body.error).toBe('Cannot delete client with associated projects');
      expect(response.body.code).toBe('CLIENT_HAS_PROJECTS');
      expect(response.body.projectCount).toBe(1);
    });

    it('should return 404 for non-existent client', async () => {
      (mockSheetsService.read as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/clients/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Client not found');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });

  describe('Communication Routes', () => {
    describe('GET /api/clients/:id/communications', () => {
      it('should return client communications', async () => {
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

        (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
        (mockSheetsService.query as jest.Mock).mockResolvedValue(mockCommunications);

        const response = await request(app)
          .get('/api/clients/client-1/communications')
          .expect(200);

        expect(response.body.client.id).toBe('client-1');
        expect(response.body.communications).toHaveLength(1);
        expect(response.body.communications[0].subject).toBe('Test Email');
      });
    });

    describe('POST /api/clients/:id/communications', () => {
      it('should add communication to client', async () => {
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

        const newCommunication = {
          type: 'email',
          direction: 'outbound',
          subject: 'New Email',
          content: 'Email content'
        };

        (mockSheetsService.read as jest.Mock).mockResolvedValue([mockClient]);
        (mockSheetsService.create as jest.Mock).mockResolvedValue('comm-new');

        const response = await request(app)
          .post('/api/clients/client-1/communications')
          .send(newCommunication)
          .expect(201);

        expect(response.body.message).toBe('Communication added successfully');
        expect(response.body.communication.subject).toBe('New Email');
        expect(mockSheetsService.create).toHaveBeenCalledWith('Communications', expect.any(Object));
      });
    });
  });
});