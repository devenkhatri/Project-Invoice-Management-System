import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { initializeInvoiceRoutes } from '../invoices';
import { Invoice, InvoiceStatus, Client, Project, TimeEntry } from '../../models';
import { generateInvoicePDF, generateGSTInvoicePDF } from '../../services/invoicePDF';

// Mock the dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../services/invoicePDF');
jest.mock('../../services/recurringInvoices');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;
const mockedGenerateInvoicePDF = generateInvoicePDF as jest.MockedFunction<typeof generateInvoicePDF>;
const mockedGenerateGSTInvoicePDF = generateGSTInvoicePDF as jest.MockedFunction<typeof generateGSTInvoicePDF>;

describe('Invoice Routes', () => {
  let app: express.Application;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

  const mockClient = {
    id: 'client-123',
    name: 'Test Client',
    email: 'client@test.com',
    phone: '+91-9876543210',
    address: 'Test Address, Test City',
    gstin: '29ABCDE1234F1Z5',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockProject = {
    id: 'project-123',
    name: 'Test Project',
    client_id: 'client-123',
    status: 'active',
    description: 'Test project description',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockInvoice = {
    id: 'invoice-123',
    invoice_number: 'INV-202401-001',
    client_id: 'client-123',
    project_id: 'project-123',
    amount: 10000,
    tax_amount: 1800,
    total_amount: 11800,
    status: InvoiceStatus.DRAFT,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
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

    MockedGoogleSheetsService.mockImplementation(() => mockSheetsService);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/invoices', initializeInvoiceRoutes(mockSheetsService));
  });

  describe('GET /api/invoices', () => {
    it('should return all invoices with pagination', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);

      const response = await request(app)
        .get('/api/invoices')
        .expect(200);

      expect(response.body).toHaveProperty('invoices');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter invoices by status', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      const sentInvoice = { ...mockInvoice, id: 'invoice-456', status: InvoiceStatus.SENT };
      
      mockSheetsService.read.mockResolvedValue([draftInvoice, sentInvoice]);

      const response = await request(app)
        .get('/api/invoices?status=draft')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].status).toBe(InvoiceStatus.DRAFT);
    });

    it('should filter invoices by client_id', async () => {
      const clientInvoice = { ...mockInvoice, client_id: 'client-123' };
      const otherInvoice = { ...mockInvoice, id: 'invoice-456', client_id: 'client-456' };
      
      mockSheetsService.read.mockResolvedValue([clientInvoice, otherInvoice]);

      const response = await request(app)
        .get('/api/invoices?client_id=client-123')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].client_id).toBe('client-123');
    });

    it('should handle pagination correctly', async () => {
      const invoices = Array.from({ length: 25 }, (_, i) => ({
        ...mockInvoice,
        id: `invoice-${i}`,
        invoice_number: `INV-202401-${String(i).padStart(3, '0')}`
      }));
      
      mockSheetsService.read.mockResolvedValue(invoices);

      const response = await request(app)
        .get('/api/invoices?page=2&limit=10')
        .expect(200);

      expect(response.body.invoices).toHaveLength(10);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.totalPages).toBe(3);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should return a specific invoice', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);

      const response = await request(app)
        .get('/api/invoices/invoice-123')
        .expect(200);

      expect(response.body.id).toBe('invoice-123');
      expect(response.body.invoice_number).toBe('INV-202401-001');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .get('/api/invoices/non-existent')
        .expect(404);
    });
  });

  describe('POST /api/invoices', () => {
    it('should create a new invoice', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockClient]) // Client lookup
        .mockResolvedValueOnce([mockProject]); // Project lookup
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const invoiceData = {
        client_id: 'client-123',
        project_id: 'project-123',
        amount: 15000,
        tax_rate: 18
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      expect(response.body.client_id).toBe('client-123');
      expect(response.body.project_id).toBe('project-123');
      expect(response.body.amount).toBe(15000);
      expect(response.body.tax_amount).toBe(2700); // 18% of 15000
      expect(response.body.total_amount).toBe(17700);
      expect(mockSheetsService.create).toHaveBeenCalledWith('Invoices', expect.any(Object));
    });

    it('should return 400 for invalid client_id', async () => {
      mockSheetsService.read.mockResolvedValue([]); // Client not found

      const invoiceData = {
        client_id: 'invalid-client',
        project_id: 'project-123',
        amount: 15000
      };

      await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(400);
    });

    it('should return 400 for invalid project_id', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockClient]) // Client found
        .mockResolvedValueOnce([]); // Project not found

      const invoiceData = {
        client_id: 'client-123',
        project_id: 'invalid-project',
        amount: 15000
      };

      await request(app)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/invoices')
        .send({})
        .expect(400);
    });

    it('should validate negative amounts', async () => {
      await request(app)
        .post('/api/invoices')
        .send({
          client_id: 'client-123',
          project_id: 'project-123',
          amount: -1000
        })
        .expect(400);
    });
  });

  describe('POST /api/invoices/from-project/:projectId', () => {
    it('should create invoice from project time entries', async () => {
      const timeEntries = [
        { id: 'time-1', project_id: 'project-123', hours: 10, created_at: new Date().toISOString() },
        { id: 'time-2', project_id: 'project-123', hours: 15, created_at: new Date().toISOString() }
      ];

      mockSheetsService.read.mockResolvedValue([mockProject]);
      mockSheetsService.query.mockResolvedValue(timeEntries);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const response = await request(app)
        .post('/api/invoices/from-project/project-123')
        .send({
          hourly_rate: 1000,
          tax_rate: 18
        })
        .expect(201);

      expect(response.body.invoice.amount).toBe(25000); // 25 hours * 1000
      expect(response.body.invoice.tax_amount).toBe(4500); // 18% of 25000
      expect(response.body.details.total_hours).toBe(25);
      expect(response.body.details.hourly_rate).toBe(1000);
    });

    it('should include expenses when requested', async () => {
      const timeEntries = [
        { id: 'time-1', project_id: 'project-123', hours: 10 }
      ];
      const expenses = [
        { id: 'exp-1', project_id: 'project-123', amount: '2000' },
        { id: 'exp-2', project_id: 'project-123', amount: '1500' }
      ];

      mockSheetsService.read.mockResolvedValue([mockProject]);
      mockSheetsService.query
        .mockResolvedValueOnce(timeEntries) // Time entries
        .mockResolvedValueOnce(expenses); // Expenses
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const response = await request(app)
        .post('/api/invoices/from-project/project-123')
        .send({
          hourly_rate: 1000,
          include_expenses: true
        })
        .expect(201);

      expect(response.body.invoice.amount).toBe(13500); // (10 * 1000) + 2000 + 1500
    });

    it('should return 404 for non-existent project', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .post('/api/invoices/from-project/non-existent')
        .send({ hourly_rate: 1000 })
        .expect(404);
    });
  });

  describe('PUT /api/invoices/:id', () => {
    it('should update an existing invoice', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      const updates = {
        amount: 12000,
        tax_rate: 18
      };

      const response = await request(app)
        .put('/api/invoices/invoice-123')
        .send(updates)
        .expect(200);

      expect(response.body.amount).toBe(12000);
      expect(response.body.tax_amount).toBe(2160); // 18% of 12000
      expect(response.body.total_amount).toBe(14160);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'invoice-123', expect.any(Object));
    });

    it('should update invoice status', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/invoices/invoice-123')
        .send({ status: 'sent' })
        .expect(200);

      expect(response.body.status).toBe('sent');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .put('/api/invoices/non-existent')
        .send({ amount: 12000 })
        .expect(404);
    });
  });

  describe('POST /api/invoices/:id/send', () => {
    it('should mark invoice as sent', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      mockSheetsService.read.mockResolvedValue([draftInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/invoices/invoice-123/send')
        .expect(200);

      expect(response.body.invoice.status).toBe(InvoiceStatus.SENT);
      expect(mockSheetsService.update).toHaveBeenCalled();
    });
  });

  describe('POST /api/invoices/:id/pay', () => {
    it('should mark invoice as paid', async () => {
      const sentInvoice = { ...mockInvoice, status: InvoiceStatus.SENT };
      mockSheetsService.read.mockResolvedValue([sentInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/invoices/invoice-123/pay')
        .send({
          payment_method: 'bank_transfer',
          transaction_id: 'TXN123456'
        })
        .expect(200);

      expect(response.body.invoice.status).toBe(InvoiceStatus.PAID);
      expect(response.body.payment_details.payment_method).toBe('bank_transfer');
      expect(response.body.payment_details.transaction_id).toBe('TXN123456');
    });
  });

  describe('GET /api/invoices/:id/pdf', () => {
    it('should generate and return PDF', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoice]) // Invoice
        .mockResolvedValueOnce([mockClient]) // Client
        .mockResolvedValueOnce([mockProject]); // Project

      const mockPDFBuffer = Buffer.from('mock-pdf-content');
      mockedGenerateInvoicePDF.mockResolvedValue(mockPDFBuffer);

      const response = await request(app)
        .get('/api/invoices/invoice-123/pdf')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('invoice-INV-202401-001.pdf');
      expect(mockedGenerateInvoicePDF).toHaveBeenCalledWith(
        expect.any(Invoice),
        expect.any(Client),
        expect.any(Project)
      );
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .get('/api/invoices/non-existent/pdf')
        .expect(404);
    });

    it('should return 400 when client or project data is missing', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoice]) // Invoice found
        .mockResolvedValueOnce([]) // Client not found
        .mockResolvedValueOnce([mockProject]); // Project found

      await request(app)
        .get('/api/invoices/invoice-123/pdf')
        .expect(400);
    });
  });

  describe('POST /api/invoices/:id/recurring', () => {
    it('should set up recurring invoice', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);

      const recurringConfig = {
        frequency: 'monthly',
        next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        max_occurrences: 12
      };

      const response = await request(app)
        .post('/api/invoices/invoice-123/recurring')
        .send(recurringConfig)
        .expect(200);

      expect(response.body.message).toContain('scheduled successfully');
      expect(response.body.config.frequency).toBe('monthly');
    });

    it('should validate recurring frequency', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);

      await request(app)
        .post('/api/invoices/invoice-123/recurring')
        .send({
          frequency: 'invalid',
          next_date: new Date().toISOString()
        })
        .expect(400);
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    it('should delete a draft invoice', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      mockSheetsService.read.mockResolvedValue([draftInvoice]);
      mockSheetsService.delete.mockResolvedValue(true);

      await request(app)
        .delete('/api/invoices/invoice-123')
        .expect(200);

      expect(mockSheetsService.delete).toHaveBeenCalledWith('Invoices', 'invoice-123');
    });

    it('should not delete a paid invoice', async () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      mockSheetsService.read.mockResolvedValue([paidInvoice]);

      await request(app)
        .delete('/api/invoices/invoice-123')
        .expect(400);

      expect(mockSheetsService.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .delete('/api/invoices/non-existent')
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle Google Sheets service errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Sheets API error'));

      await request(app)
        .get('/api/invoices')
        .expect(500);
    });

    it('should handle PDF generation errors', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoice])
        .mockResolvedValueOnce([mockClient])
        .mockResolvedValueOnce([mockProject]);

      mockedGenerateInvoicePDF.mockRejectedValue(new Error('PDF generation failed'));

      await request(app)
        .get('/api/invoices/invoice-123/pdf')
        .expect(500);
    });
  });
});