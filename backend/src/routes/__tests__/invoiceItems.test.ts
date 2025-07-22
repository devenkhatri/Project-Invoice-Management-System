import request from 'supertest';
import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { initializeInvoiceItemRoutes } from '../invoiceItems';
import { InvoiceItem, Invoice, InvoiceItemType, InvoiceStatus } from '../../models';

// Mock the dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;

describe('Invoice Items Routes', () => {
  let app: express.Application;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

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

  const mockInvoiceItem = {
    id: 'item-123',
    invoice_id: 'invoice-123',
    description: 'Web Development Services',
    quantity: 40,
    rate: 1500,
    amount: 60000,
    type: InvoiceItemType.SERVICE,
    hsn_sac: '998314'
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
    app.use('/api/invoice-items', initializeInvoiceItemRoutes(mockSheetsService));
  });

  describe('GET /api/invoice-items/invoice/:invoiceId', () => {
    it('should return all items for a specific invoice', async () => {
      const items = [
        mockInvoiceItem,
        {
          ...mockInvoiceItem,
          id: 'item-456',
          description: 'UI/UX Design',
          quantity: 20,
          rate: 2000,
          amount: 40000
        }
      ];

      mockSheetsService.read.mockResolvedValue([mockInvoice]); // Invoice exists
      mockSheetsService.query.mockResolvedValue(items);

      const response = await request(app)
        .get('/api/invoice-items/invoice/invoice-123')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].description).toBe('Web Development Services');
      expect(response.body[1].description).toBe('UI/UX Design');
      expect(mockSheetsService.query).toHaveBeenCalledWith('Invoice_Items', { invoice_id: 'invoice-123' });
    });

    it('should return 404 for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]); // Invoice not found

      await request(app)
        .get('/api/invoice-items/invoice/non-existent')
        .expect(404);
    });

    it('should return empty array for invoice with no items', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]); // Invoice exists
      mockSheetsService.query.mockResolvedValue([]); // No items

      const response = await request(app)
        .get('/api/invoice-items/invoice/invoice-123')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/invoice-items/:id', () => {
    it('should return a specific invoice item', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);

      const response = await request(app)
        .get('/api/invoice-items/item-123')
        .expect(200);

      expect(response.body.id).toBe('item-123');
      expect(response.body.description).toBe('Web Development Services');
      expect(response.body.amount).toBe(60000);
    });

    it('should return 404 for non-existent item', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .get('/api/invoice-items/non-existent')
        .expect(404);
    });
  });

  describe('POST /api/invoice-items', () => {
    it('should create a new invoice item', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]); // Invoice exists
      mockSheetsService.create.mockResolvedValue('new-item-id');
      mockSheetsService.query.mockResolvedValue([]); // No existing items
      mockSheetsService.update.mockResolvedValue(true); // Invoice update

      const itemData = {
        invoice_id: 'invoice-123',
        description: 'Database Design',
        quantity: 10,
        rate: 2500,
        type: 'service',
        hsn_sac: '998314'
      };

      const response = await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(201);

      expect(response.body.description).toBe('Database Design');
      expect(response.body.quantity).toBe(10);
      expect(response.body.rate).toBe(2500);
      expect(response.body.amount).toBe(25000); // 10 * 2500
      expect(response.body.type).toBe(InvoiceItemType.SERVICE);
      expect(mockSheetsService.create).toHaveBeenCalledWith('Invoice_Items', expect.any(Object));
    });

    it('should return 400 for invalid invoice_id', async () => {
      mockSheetsService.read.mockResolvedValue([]); // Invoice not found

      const itemData = {
        invoice_id: 'invalid-invoice',
        description: 'Test Service',
        quantity: 1,
        rate: 1000,
        type: 'service'
      };

      await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/invoice-items')
        .send({})
        .expect(400);
    });

    it('should validate quantity is positive', async () => {
      await request(app)
        .post('/api/invoice-items')
        .send({
          invoice_id: 'invoice-123',
          description: 'Test Service',
          quantity: 0,
          rate: 1000,
          type: 'service'
        })
        .expect(400);
    });

    it('should validate rate is non-negative', async () => {
      await request(app)
        .post('/api/invoice-items')
        .send({
          invoice_id: 'invoice-123',
          description: 'Test Service',
          quantity: 1,
          rate: -100,
          type: 'service'
        })
        .expect(400);
    });

    it('should validate item type', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);

      await request(app)
        .post('/api/invoice-items')
        .send({
          invoice_id: 'invoice-123',
          description: 'Test Service',
          quantity: 1,
          rate: 1000,
          type: 'invalid-type'
        })
        .expect(400);
    });

    it('should handle different item types', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.create.mockResolvedValue('new-item-id');
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.update.mockResolvedValue(true);

      const itemTypes = ['service', 'product', 'expense', 'discount'];

      for (const type of itemTypes) {
        const itemData = {
          invoice_id: 'invoice-123',
          description: `Test ${type}`,
          quantity: 1,
          rate: 1000,
          type
        };

        const response = await request(app)
          .post('/api/invoice-items')
          .send(itemData)
          .expect(201);

        expect(response.body.type).toBe(type);
      }
    });
  });

  describe('PUT /api/invoice-items/:id', () => {
    it('should update an existing invoice item', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.update.mockResolvedValue(true);
      mockSheetsService.query.mockResolvedValue([mockInvoiceItem]); // For invoice total update

      const updates = {
        description: 'Updated Web Development Services',
        quantity: 50,
        rate: 1800
      };

      const response = await request(app)
        .put('/api/invoice-items/item-123')
        .send(updates)
        .expect(200);

      expect(response.body.description).toBe('Updated Web Development Services');
      expect(response.body.quantity).toBe(50);
      expect(response.body.rate).toBe(1800);
      expect(response.body.amount).toBe(90000); // 50 * 1800
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoice_Items', 'item-123', expect.any(Object));
    });

    it('should return 404 for non-existent item', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .put('/api/invoice-items/non-existent')
        .send({ description: 'Updated' })
        .expect(404);
    });

    it('should validate updated fields', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);

      await request(app)
        .put('/api/invoice-items/item-123')
        .send({ quantity: 0 })
        .expect(400);

      await request(app)
        .put('/api/invoice-items/item-123')
        .send({ rate: -100 })
        .expect(400);

      await request(app)
        .put('/api/invoice-items/item-123')
        .send({ type: 'invalid-type' })
        .expect(400);
    });

    it('should update only provided fields', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.update.mockResolvedValue(true);
      mockSheetsService.query.mockResolvedValue([mockInvoiceItem]);

      const response = await request(app)
        .put('/api/invoice-items/item-123')
        .send({ quantity: 30 })
        .expect(200);

      expect(response.body.quantity).toBe(30);
      expect(response.body.description).toBe('Web Development Services'); // Unchanged
      expect(response.body.rate).toBe(1500); // Unchanged
      expect(response.body.amount).toBe(45000); // Recalculated: 30 * 1500
    });
  });

  describe('DELETE /api/invoice-items/:id', () => {
    it('should delete an invoice item', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.delete.mockResolvedValue(true);
      mockSheetsService.query.mockResolvedValue([]); // No items left after deletion

      await request(app)
        .delete('/api/invoice-items/item-123')
        .expect(200);

      expect(mockSheetsService.delete).toHaveBeenCalledWith('Invoice_Items', 'item-123');
    });

    it('should return 404 for non-existent item', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await request(app)
        .delete('/api/invoice-items/non-existent')
        .expect(404);
    });

    it('should update invoice totals after deletion', async () => {
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoiceItem]) // Item exists
        .mockResolvedValueOnce([mockInvoice]); // Invoice for total update
      mockSheetsService.delete.mockResolvedValue(true);
      mockSheetsService.query.mockResolvedValue([]); // No items left
      mockSheetsService.update.mockResolvedValue(true); // Invoice update

      await request(app)
        .delete('/api/invoice-items/item-123')
        .expect(200);

      // Should update invoice totals
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'invoice-123', expect.any(Object));
    });
  });

  describe('Invoice Total Updates', () => {
    it('should update invoice totals when item is added', async () => {
      const existingItems = [mockInvoiceItem];
      
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoice]) // Invoice exists for creation
        .mockResolvedValueOnce([mockInvoice]); // Invoice for total update
      mockSheetsService.create.mockResolvedValue('new-item-id');
      mockSheetsService.query.mockResolvedValue(existingItems);
      mockSheetsService.update.mockResolvedValue(true);

      const itemData = {
        invoice_id: 'invoice-123',
        description: 'Additional Service',
        quantity: 5,
        rate: 1000,
        type: 'service'
      };

      await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(201);

      // Should update invoice with recalculated totals
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'invoice-123', expect.any(Object));
    });

    it('should handle invoice total update errors gracefully', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.delete.mockResolvedValue(true);
      mockSheetsService.query.mockRejectedValue(new Error('Sheets API error'));

      // Should still delete the item even if total update fails
      await request(app)
        .delete('/api/invoice-items/item-123')
        .expect(500); // Error due to total update failure
    });
  });

  describe('Error Handling', () => {
    it('should handle Google Sheets service errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Sheets API error'));

      await request(app)
        .get('/api/invoice-items/item-123')
        .expect(500);
    });

    it('should handle creation errors', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.create.mockRejectedValue(new Error('Creation failed'));

      const itemData = {
        invoice_id: 'invoice-123',
        description: 'Test Service',
        quantity: 1,
        rate: 1000,
        type: 'service'
      };

      await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(500);
    });

    it('should handle update errors', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.update.mockRejectedValue(new Error('Update failed'));

      await request(app)
        .put('/api/invoice-items/item-123')
        .send({ description: 'Updated' })
        .expect(500);
    });

    it('should handle deletion errors', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoiceItem]);
      mockSheetsService.delete.mockRejectedValue(new Error('Deletion failed'));

      await request(app)
        .delete('/api/invoice-items/item-123')
        .expect(500);
    });
  });

  describe('HSN/SAC Code Handling', () => {
    it('should handle items with HSN/SAC codes', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.create.mockResolvedValue('new-item-id');
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.update.mockResolvedValue(true);

      const itemData = {
        invoice_id: 'invoice-123',
        description: 'Software Development',
        quantity: 1,
        rate: 50000,
        type: 'service',
        hsn_sac: '998314'
      };

      const response = await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(201);

      expect(response.body.hsn_sac).toBe('998314');
    });

    it('should handle items without HSN/SAC codes', async () => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
      mockSheetsService.create.mockResolvedValue('new-item-id');
      mockSheetsService.query.mockResolvedValue([]);
      mockSheetsService.update.mockResolvedValue(true);

      const itemData = {
        invoice_id: 'invoice-123',
        description: 'Consulting Service',
        quantity: 1,
        rate: 25000,
        type: 'service'
      };

      const response = await request(app)
        .post('/api/invoice-items')
        .send(itemData)
        .expect(201);

      expect(response.body.hsn_sac).toBeUndefined();
    });
  });
});