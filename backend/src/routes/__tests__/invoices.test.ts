import request from 'supertest';
import express from 'express';
import invoiceRoutes from '../invoices';
import { SheetsService } from '../../services/sheets.service';
import { Invoice } from '../../models/Invoice';
import { Client } from '../../models/Client';
import { Project } from '../../models/Project';
import { InvoiceStatus, PaymentStatus } from '../../types';

// Mock dependencies
jest.mock('../../services/sheets.service');
jest.mock('../../services/invoice.service');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user1', email: 'test@example.com', role: 'admin' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/invoices', invoiceRoutes);

const mockSheetsService = SheetsService.getInstance as jest.MockedFunction<typeof SheetsService.getInstance>;

// Helper function to create complete mock invoice data
const createMockInvoiceData = (overrides: any = {}) => ({
  id: 'inv1',
  invoice_number: 'INV-2024-0001',
  client_id: 'client1',
  project_id: 'project1',
  line_items: JSON.stringify([{
    id: 'li1',
    description: 'Development work',
    quantity: 10,
    unit_price: 100,
    total_price: 1000,
    tax_rate: 18,
    tax_amount: 180
  }]),
  subtotal: 1000,
  tax_breakdown: JSON.stringify({
    cgst_rate: 9,
    cgst_amount: 90,
    sgst_rate: 9,
    sgst_amount: 90,
    igst_rate: 0,
    igst_amount: 0,
    total_tax_amount: 180
  }),
  total_amount: 1180,
  currency: 'INR',
  status: InvoiceStatus.DRAFT,
  issue_date: '2024-01-15',
  due_date: '2024-02-14',
  payment_terms: 'Net 30',
  notes: 'Test notes',
  terms_conditions: 'Test terms',
  payment_status: PaymentStatus.PENDING,
  paid_amount: 0,
  payment_date: '2024-01-20',
  payment_method: 'Bank Transfer',
  late_fee_applied: 0,
  discount_percentage: 0,
  discount_amount: 0,
  is_recurring: false,
  recurring_frequency: 'monthly',
  next_invoice_date: '2024-02-15',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  ...overrides
});

describe('Invoice Routes', () => {
  let sheetsServiceMock: any;

  beforeEach(() => {
    sheetsServiceMock = {
      query: jest.fn(),
      read: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    mockSheetsService.mockReturnValue(sheetsServiceMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/invoices', () => {

    const mockClientData = {
      id: 'client1',
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+91-9876543210',
      address: 'Test Address',
      country: 'India',
      gstin: '07AABCU9603R1ZX',
      payment_terms: 'Net 30',
      default_currency: 'INR',
      is_active: true,
      created_at: '2024-01-01T10:00:00Z'
    };

    it('should fetch all invoices successfully', async () => {
      const mockInvoiceData = createMockInvoiceData();
      sheetsServiceMock.query.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);

      const response = await request(app)
        .get('/api/invoices')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].invoice_number).toBe('INV-2024-0001');
      expect(response.body.data[0].client).toBeDefined();
    });

    it('should filter invoices by status', async () => {
      const mockInvoiceData = createMockInvoiceData();
      sheetsServiceMock.query.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);

      const response = await request(app)
        .get('/api/invoices?status=draft')
        .expect(200);

      expect(sheetsServiceMock.query).toHaveBeenCalledWith('Invoices', {
        filters: [{ column: 'status', operator: 'eq', value: 'draft' }],
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: undefined,
        offset: undefined
      });
    });

    it('should filter invoices by client', async () => {
      const mockInvoiceData = createMockInvoiceData();
      sheetsServiceMock.query.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);

      const response = await request(app)
        .get('/api/invoices?client_id=client1')
        .expect(200);

      expect(sheetsServiceMock.query).toHaveBeenCalledWith('Invoices', {
        filters: [{ column: 'client_id', operator: 'eq', value: 'client1' }],
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: undefined,
        offset: undefined
      });
    });

    it('should handle pagination', async () => {
      const mockInvoiceData = createMockInvoiceData();
      sheetsServiceMock.query.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);

      const response = await request(app)
        .get('/api/invoices?limit=10&offset=0')
        .expect(200);

      expect(response.body.pagination).toEqual({
        total: 1,
        limit: 10,
        offset: 0
      });
    });

    it('should handle errors gracefully', async () => {
      sheetsServiceMock.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/invoices')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch invoices');
    });
  });

  describe('GET /api/invoices/:id', () => {
    const mockInvoiceData = {
      id: 'inv1',
      invoice_number: 'INV-2024-0001',
      client_id: 'client1',
      project_id: 'project1',
      line_items: JSON.stringify([{
        id: 'li1',
        description: 'Development work',
        quantity: 10,
        unit_price: 100,
        total_price: 1000,
        tax_rate: 18,
        tax_amount: 180
      }]),
      subtotal: 1000,
      tax_breakdown: JSON.stringify({
        cgst_rate: 9,
        cgst_amount: 90,
        sgst_rate: 9,
        sgst_amount: 90,
        igst_rate: 0,
        igst_amount: 0,
        total_tax_amount: 180
      }),
      total_amount: 1180,
      currency: 'INR',
      status: InvoiceStatus.DRAFT,
      issue_date: '2024-01-15',
      due_date: '2024-02-14',
      payment_terms: 'Net 30',
      payment_status: PaymentStatus.PENDING,
      paid_amount: 0,
      is_recurring: false,
      created_at: '2024-01-15T10:00:00Z'
    };

    const mockClientData = {
      id: 'client1',
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+91-9876543210',
      address: 'Test Address',
      country: 'India',
      gstin: '07AABCU9603R1ZX',
      payment_terms: 'Net 30',
      default_currency: 'INR',
      is_active: true,
      created_at: '2024-01-01T10:00:00Z'
    };

    const mockProjectData = {
      id: 'project1',
      name: 'Test Project',
      client_id: 'client1',
      status: 'active',
      start_date: '2024-01-01',
      end_date: '2024-03-01',
      budget: 10000,
      description: 'Test project description',
      is_billable: true,
      currency: 'INR',
      created_at: '2024-01-01T10:00:00Z'
    };

    it('should fetch single invoice successfully', async () => {
      sheetsServiceMock.read
        .mockResolvedValueOnce([mockInvoiceData])
        .mockResolvedValueOnce([mockClientData])
        .mockResolvedValueOnce([mockProjectData]);

      const response = await request(app)
        .get('/api/invoices/inv1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.invoice_number).toBe('INV-2024-0001');
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.project).toBeDefined();
      expect(response.body.data.payment_history).toBeDefined();
    });

    it('should return 404 for non-existent invoice', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/invoices/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invoice not found');
    });

    it('should handle missing client gracefully', async () => {
      sheetsServiceMock.read
        .mockResolvedValueOnce([mockInvoiceData])
        .mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/invoices/inv1')
        .expect(200);

      expect(response.body.data.client).toBeNull();
    });
  });

  describe('POST /api/invoices', () => {
    const mockClientData = {
      id: 'client1',
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+91-9876543210',
      address: 'Test Address',
      country: 'India',
      gstin: '07AABCU9603R1ZX',
      payment_terms: 'Net 30',
      default_currency: 'INR',
      is_active: true,
      created_at: '2024-01-01T10:00:00Z'
    };

    const validInvoiceData = {
      client_id: 'client1',
      line_items: [{
        description: 'Development work',
        quantity: 10,
        unit_price: 100,
        tax_rate: 18
      }],
      issue_date: '2024-01-15',
      due_date: '2024-02-14',
      currency: 'INR'
    };

    it('should create invoice successfully', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);
      sheetsServiceMock.query.mockResolvedValue([]);
      sheetsServiceMock.create.mockResolvedValue('inv1');

      const response = await request(app)
        .post('/api/invoices')
        .send(validInvoiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invoice created successfully');
      expect(response.body.data.id).toBe('inv1');
      expect(response.body.data.client).toBeDefined();
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/invoices')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate client exists', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/invoices')
        .send(validInvoiceData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Client not found');
    });

    it('should validate line items', async () => {
      const invalidData = {
        ...validInvoiceData,
        line_items: []
      };

      const response = await request(app)
        .post('/api/invoices')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should generate invoice number automatically', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockClientData]);
      sheetsServiceMock.query.mockResolvedValue([]);
      sheetsServiceMock.create.mockResolvedValue('inv1');

      const response = await request(app)
        .post('/api/invoices')
        .send(validInvoiceData)
        .expect(201);

      expect(response.body.data.invoice_number).toMatch(/^INV-\d{4}-\d{4}$/);
    });
  });

  describe('POST /api/invoices/from-project/:projectId', () => {
    const mockProjectData = {
      id: 'project1',
      name: 'Test Project',
      client_id: 'client1',
      status: 'active',
      start_date: '2024-01-01',
      end_date: '2024-03-01',
      budget: 10000,
      description: 'Test project description',
      is_billable: true,
      hourly_rate: 50,
      currency: 'INR',
      created_at: '2024-01-01T10:00:00Z'
    };

    const mockClientData = {
      id: 'client1',
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+91-9876543210',
      address: 'Test Address',
      country: 'India',
      gstin: '07AABCU9603R1ZX',
      payment_terms: 'Net 30',
      default_currency: 'INR',
      is_active: true,
      created_at: '2024-01-01T10:00:00Z'
    };

    const mockTimeEntries = [
      {
        id: 'te1',
        task_id: 'task1',
        project_id: 'project1',
        hours: 8,
        description: 'Development work',
        date: '2024-01-15',
        is_billable: true
      },
      {
        id: 'te2',
        task_id: 'task2',
        project_id: 'project1',
        hours: 6,
        description: 'Testing work',
        date: '2024-01-16',
        is_billable: true
      }
    ];

    it('should create invoice from project time entries', async () => {
      sheetsServiceMock.read
        .mockResolvedValueOnce([mockProjectData])
        .mockResolvedValueOnce([mockClientData]);
      sheetsServiceMock.query
        .mockResolvedValueOnce(mockTimeEntries)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      sheetsServiceMock.create.mockResolvedValue('inv1');

      const response = await request(app)
        .post('/api/invoices/from-project/project1')
        .send({ include_time_entries: true })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invoice created from project data');
      expect(response.body.data.line_items).toHaveLength(1);
      expect(response.body.data.line_items[0].quantity).toBe(14); // 8 + 6 hours
    });

    it('should return 404 for non-existent project', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/invoices/from-project/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project not found');
    });

    it('should handle no billable items', async () => {
      sheetsServiceMock.read
        .mockResolvedValueOnce([mockProjectData])
        .mockResolvedValueOnce([mockClientData]);
      sheetsServiceMock.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/invoices/from-project/project1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No billable items found for this project');
    });
  });

  describe('PUT /api/invoices/:id', () => {
    const mockInvoiceData = {
      id: 'inv1',
      invoice_number: 'INV-2024-0001',
      client_id: 'client1',
      project_id: 'project1',
      line_items: JSON.stringify([{
        id: 'li1',
        description: 'Development work',
        quantity: 10,
        unit_price: 100,
        total_price: 1000,
        tax_rate: 18,
        tax_amount: 180
      }]),
      subtotal: 1000,
      tax_breakdown: JSON.stringify({
        cgst_rate: 9,
        cgst_amount: 90,
        sgst_rate: 9,
        sgst_amount: 90,
        igst_rate: 0,
        igst_amount: 0,
        total_tax_amount: 180
      }),
      total_amount: 1180,
      currency: 'INR',
      status: InvoiceStatus.DRAFT,
      issue_date: '2024-01-15',
      due_date: '2024-02-14',
      payment_terms: 'Net 30',
      payment_status: PaymentStatus.PENDING,
      paid_amount: 0,
      is_recurring: false,
      created_at: '2024-01-15T10:00:00Z'
    };

    it('should update invoice successfully', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.update.mockResolvedValue(true);

      const updateData = {
        notes: 'Updated notes'
      };

      const response = await request(app)
        .put('/api/invoices/inv1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invoice updated successfully');
    });

    it('should return 404 for non-existent invoice', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/invoices/nonexistent')
        .send({ notes: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invoice not found');
    });

    it('should prevent updating paid invoices', async () => {
      const paidInvoice = {
        ...mockInvoiceData,
        status: InvoiceStatus.PAID
      };

      sheetsServiceMock.read.mockResolvedValue([paidInvoice]);

      const response = await request(app)
        .put('/api/invoices/inv1')
        .send({ notes: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot update paid or cancelled invoices');
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    const mockInvoiceData = {
      id: 'inv1',
      invoice_number: 'INV-2024-0001',
      client_id: 'client1',
      status: InvoiceStatus.DRAFT,
      created_at: '2024-01-15T10:00:00Z'
    };

    it('should cancel invoice successfully', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.update.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/invoices/inv1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invoice cancelled successfully');
    });

    it('should return 404 for non-existent invoice', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/invoices/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invoice not found');
    });

    it('should prevent cancelling paid invoices', async () => {
      const paidInvoice = {
        ...mockInvoiceData,
        status: InvoiceStatus.PAID
      };

      sheetsServiceMock.read.mockResolvedValue([paidInvoice]);

      const response = await request(app)
        .delete('/api/invoices/inv1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot cancel a paid invoice');
    });
  });

  describe('POST /api/invoices/:id/payment', () => {
    const mockInvoiceData = {
      id: 'inv1',
      invoice_number: 'INV-2024-0001',
      client_id: 'client1',
      line_items: JSON.stringify([{
        id: 'li1',
        description: 'Development work',
        quantity: 10,
        unit_price: 100,
        total_price: 1000,
        tax_rate: 18,
        tax_amount: 180
      }]),
      subtotal: 1000,
      tax_breakdown: JSON.stringify({
        total_tax_amount: 180
      }),
      total_amount: 1180,
      currency: 'INR',
      status: InvoiceStatus.SENT,
      payment_status: PaymentStatus.PENDING,
      paid_amount: 0,
      created_at: '2024-01-15T10:00:00Z'
    };

    it('should record payment successfully', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.update.mockResolvedValue(true);

      const paymentData = {
        amount: 1180,
        payment_date: '2024-01-20',
        payment_method: 'Bank Transfer'
      };

      const response = await request(app)
        .post('/api/invoices/inv1/payment')
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment recorded successfully');
      expect(response.body.data.is_fully_paid).toBe(true);
    });

    it('should handle partial payments', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockInvoiceData]);
      sheetsServiceMock.update.mockResolvedValue(true);

      const paymentData = {
        amount: 500,
        payment_date: '2024-01-20',
        payment_method: 'Bank Transfer'
      };

      const response = await request(app)
        .post('/api/invoices/inv1/payment')
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.is_fully_paid).toBe(false);
      expect(response.body.data.remaining_amount).toBe(680);
    });

    it('should prevent overpayment', async () => {
      sheetsServiceMock.read.mockResolvedValue([mockInvoiceData]);

      const paymentData = {
        amount: 2000,
        payment_date: '2024-01-20',
        payment_method: 'Bank Transfer'
      };

      const response = await request(app)
        .post('/api/invoices/inv1/payment')
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('exceeds remaining balance');
    });

    it('should validate payment amount', async () => {
      const response = await request(app)
        .post('/api/invoices/inv1/payment')
        .send({
          amount: -100,
          payment_date: '2024-01-20'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/invoices/analytics/summary', () => {
    const mockInvoicesData = [
      {
        id: 'inv1',
        total_amount: 1180,
        paid_amount: 1180,
        status: InvoiceStatus.PAID,
        payment_status: PaymentStatus.PAID,
        client_id: 'client1',
        is_recurring: false,
        issue_date: '2024-01-15',
        due_date: '2024-02-14',
        payment_date: '2024-01-20'
      },
      {
        id: 'inv2',
        total_amount: 2360,
        paid_amount: 0,
        status: InvoiceStatus.SENT,
        payment_status: PaymentStatus.PENDING,
        client_id: 'client2',
        is_recurring: true,
        issue_date: '2024-01-20',
        due_date: '2024-02-19'
      }
    ];

    it('should generate analytics summary', async () => {
      sheetsServiceMock.read.mockResolvedValue(mockInvoicesData);

      const response = await request(app)
        .get('/api/invoices/analytics/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_invoices).toBe(2);
      expect(response.body.data.total_amount).toBe(3540);
      expect(response.body.data.total_paid).toBe(1180);
      expect(response.body.data.total_outstanding).toBe(2360);
      expect(response.body.data.by_status.paid).toBe(1);
      expect(response.body.data.by_status.sent).toBe(1);
      expect(response.body.data.recurring_invoices).toBe(1);
    });

    it('should handle empty invoice list', async () => {
      sheetsServiceMock.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/invoices/analytics/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_invoices).toBe(0);
      expect(response.body.data.total_amount).toBe(0);
    });
  });
});