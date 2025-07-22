import request from 'supertest';
import express from 'express';
import integrationRoutes from '../integrations';
import { GoogleSheetsService } from '../../../services/googleSheets';
import { GSTReportingService } from '../../../services/gstReporting';
import { EInvoicingService } from '../../../services/eInvoicing';
import { authMiddleware } from '../../../middleware/auth';

// Mock dependencies
jest.mock('../../../services/googleSheets');
jest.mock('../../../services/gstReporting');
jest.mock('../../../services/eInvoicing');
jest.mock('../../../middleware/auth');

// Mock auth middleware to pass through
(authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
  req.user = { id: 'test_user' };
  next();
});

describe('Integration API Routes', () => {
  let app: express.Application;
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;
  let mockGstReportingService: jest.Mocked<GSTReportingService>;
  let mockEInvoicingService: jest.Mocked<EInvoicingService>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockSheetsService = new GoogleSheetsService() as jest.Mocked<GoogleSheetsService>;
    mockGstReportingService = {} as jest.Mocked<GSTReportingService>;
    mockEInvoicingService = {} as jest.Mocked<EInvoicingService>;
    
    // Mock methods
    mockGstReportingService.generateGSTR1Report = jest.fn().mockResolvedValue({});
    mockGstReportingService.generateGSTR3BReport = jest.fn().mockResolvedValue({});
    mockGstReportingService.exportGSTReport = jest.fn().mockResolvedValue(JSON.stringify({ data: 'test' }));
    
    mockEInvoicingService.generateEInvoice = jest.fn().mockResolvedValue({
      id: 'einv_123',
      invoice_id: 'inv_1',
      irn: '123456789012345678901234567890123456',
      status: 'generated'
    });
    
    mockEInvoicingService.getEInvoiceByInvoiceId = jest.fn().mockResolvedValue({
      id: 'einv_123',
      invoice_id: 'inv_1',
      irn: '123456789012345678901234567890123456',
      status: 'generated'
    });
    
    mockEInvoicingService.cancelEInvoice = jest.fn().mockResolvedValue(true);
    mockEInvoicingService.generateEInvoicePDF = jest.fn().mockResolvedValue(Buffer.from('mock_pdf_data'));
    
    // Create express app
    app = express();
    app.use(express.json());
    app.use('/api/integrations', integrationRoutes);
  });
  
  describe('GET /api/integrations/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/integrations/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
  
  describe('GET /api/integrations/gst/reports', () => {
    it('should generate GST report in JSON format', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports')
        .query({
          type: 'gstr1',
          startDate: '2023-01-01',
          endDate: '2023-01-31',
          format: 'json'
        });
      
      expect(response.status).toBe(200);
      expect(mockGstReportingService.generateGSTR1Report).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        })
      );
      expect(mockGstReportingService.exportGSTReport).toHaveBeenCalledWith(
        'gstr1',
        expect.anything(),
        'json'
      );
    });
    
    it('should return 400 for invalid report type', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports')
        .query({
          type: 'invalid',
          startDate: '2023-01-01',
          endDate: '2023-01-31'
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports')
        .query({
          type: 'gstr1'
          // Missing startDate and endDate
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/integrations/einvoice/:invoiceId', () => {
    it('should generate e-invoice for a valid invoice', async () => {
      const response = await request(app)
        .post('/api/integrations/einvoice/inv_1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', 'einv_123');
      expect(mockEInvoicingService.generateEInvoice).toHaveBeenCalledWith('inv_1');
    });
    
    it('should return 500 if e-invoice generation fails', async () => {
      mockEInvoicingService.generateEInvoice = jest.fn().mockRejectedValue(new Error('Failed to generate e-invoice'));
      
      const response = await request(app)
        .post('/api/integrations/einvoice/inv_1');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /api/integrations/einvoice/:invoiceId', () => {
    it('should return e-invoice details for a valid invoice', async () => {
      const response = await request(app)
        .get('/api/integrations/einvoice/inv_1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', 'einv_123');
      expect(mockEInvoicingService.getEInvoiceByInvoiceId).toHaveBeenCalledWith('inv_1');
    });
    
    it('should return 404 if e-invoice not found', async () => {
      mockEInvoicingService.getEInvoiceByInvoiceId = jest.fn().mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/integrations/einvoice/inv_1');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /api/integrations/einvoice/:invoiceId/pdf', () => {
    it('should return e-invoice PDF for a valid invoice', async () => {
      const response = await request(app)
        .get('/api/integrations/einvoice/inv_1/pdf');
      
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('application/pdf');
      expect(response.header['content-disposition']).toContain('attachment; filename=einvoice_inv_1.pdf');
      expect(mockEInvoicingService.generateEInvoicePDF).toHaveBeenCalledWith('inv_1');
    });
    
    it('should return 500 if PDF generation fails', async () => {
      mockEInvoicingService.generateEInvoicePDF = jest.fn().mockRejectedValue(new Error('Failed to generate PDF'));
      
      const response = await request(app)
        .get('/api/integrations/einvoice/inv_1/pdf');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /api/integrations/einvoice/:invoiceId/cancel', () => {
    it('should cancel e-invoice for a valid invoice', async () => {
      const response = await request(app)
        .post('/api/integrations/einvoice/inv_1/cancel')
        .send({ reason: 'Testing cancellation' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockEInvoicingService.cancelEInvoice).toHaveBeenCalledWith('inv_1', 'Testing cancellation');
    });
    
    it('should return 400 if reason is missing', async () => {
      const response = await request(app)
        .post('/api/integrations/einvoice/inv_1/cancel')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 500 if cancellation fails', async () => {
      mockEInvoicingService.cancelEInvoice = jest.fn().mockRejectedValue(new Error('Failed to cancel e-invoice'));
      
      const response = await request(app)
        .post('/api/integrations/einvoice/inv_1/cancel')
        .send({ reason: 'Testing cancellation' });
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /api/integrations/automation/workflow', () => {
    it('should create a new workflow rule', async () => {
      mockSheetsService.create = jest.fn().mockResolvedValue('rule_123');
      
      const workflowRule = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        trigger: {
          type: 'invoice_amount_threshold',
          conditions: {
            amount_threshold: 50000
          }
        },
        actions: [
          {
            type: 'generate_e_invoice',
            parameters: {
              notify_client: true
            }
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/integrations/automation/workflow')
        .send(workflowRule);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name', 'Test Workflow');
      expect(mockSheetsService.create).toHaveBeenCalledWith('AdvancedWorkflowRules', expect.objectContaining({
        name: 'Test Workflow',
        trigger: expect.any(String),
        actions: expect.any(String)
      }));
    });
    
    it('should update an existing workflow rule', async () => {
      mockSheetsService.update = jest.fn().mockResolvedValue(true);
      
      const workflowRule = {
        id: 'rule_123',
        name: 'Updated Workflow',
        trigger: {
          type: 'invoice_amount_threshold',
          conditions: {
            amount_threshold: 75000
          }
        },
        actions: [
          {
            type: 'generate_e_invoice',
            parameters: {
              notify_client: true
            }
          }
        ]
      };
      
      const response = await request(app)
        .post('/api/integrations/automation/workflow')
        .send(workflowRule);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name', 'Updated Workflow');
      expect(mockSheetsService.update).toHaveBeenCalledWith('AdvancedWorkflowRules', 'rule_123', expect.objectContaining({
        name: 'Updated Workflow',
        trigger: expect.any(String),
        actions: expect.any(String)
      }));
    });
    
    it('should return 400 for invalid workflow rule', async () => {
      const response = await request(app)
        .post('/api/integrations/automation/workflow')
        .send({
          // Missing required fields
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /api/integrations/automation/workflows', () => {
    it('should return all workflow rules', async () => {
      const mockRules = [
        {
          id: 'rule_1',
          name: 'Test Rule 1',
          description: 'Test rule description',
          is_active: 'true',
          trigger: JSON.stringify({
            type: 'invoice_amount_threshold',
            conditions: { amount_threshold: 50000 }
          }),
          actions: JSON.stringify([
            { type: 'generate_e_invoice', parameters: { notify_client: true } }
          ]),
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        },
        {
          id: 'rule_2',
          name: 'Test Rule 2',
          description: 'Another test rule',
          is_active: 'false',
          trigger: JSON.stringify({
            type: 'project_budget_threshold',
            conditions: { percentage_threshold: 80 }
          }),
          actions: JSON.stringify([
            { type: 'escalate_notification', parameters: { priority: 'high' } }
          ]),
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z'
        }
      ];
      
      mockSheetsService.read = jest.fn().mockResolvedValue(mockRules);
      
      const response = await request(app)
        .get('/api/integrations/automation/workflows');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('id', 'rule_1');
      expect(response.body.data[0]).toHaveProperty('is_active', true);
      expect(response.body.data[0].trigger).toEqual({
        type: 'invoice_amount_threshold',
        conditions: { amount_threshold: 50000 }
      });
    });
  });
  
  describe('DELETE /api/integrations/automation/workflow/:id', () => {
    it('should delete a workflow rule', async () => {
      mockSheetsService.delete = jest.fn().mockResolvedValue(true);
      
      const response = await request(app)
        .delete('/api/integrations/automation/workflow/rule_123');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('AdvancedWorkflowRules', 'rule_123');
    });
    
    it('should return 500 if deletion fails', async () => {
      mockSheetsService.delete = jest.fn().mockRejectedValue(new Error('Failed to delete workflow rule'));
      
      const response = await request(app)
        .delete('/api/integrations/automation/workflow/rule_123');
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
});