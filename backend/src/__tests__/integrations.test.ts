import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import app from '../server';
import { GSTReportsService } from '../services/gst-reports.service';
import { EInvoiceService } from '../services/e-invoice.service';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { WebhookService } from '../services/webhook.service';

// Mock services
jest.mock('../services/gst-reports.service');
jest.mock('../services/e-invoice.service');
jest.mock('../services/workflow-engine.service');
jest.mock('../services/webhook.service');

const mockGSTReportsService = GSTReportsService as jest.MockedClass<typeof GSTReportsService>;
const mockEInvoiceService = EInvoiceService as jest.MockedClass<typeof EInvoiceService>;
const mockWorkflowEngineService = WorkflowEngineService as jest.MockedClass<typeof WorkflowEngineService>;
const mockWebhookService = WebhookService as jest.MockedClass<typeof WebhookService>;

describe('Integrations API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GST Reports', () => {
    describe('GET /api/integrations/gst/gstr1/:month/:year', () => {
      it('should generate GSTR1 report successfully', async () => {
        const mockReport = [
          {
            gstin: '27ABCDE1234F1Z5',
            invoiceNumber: 'INV-001',
            invoiceDate: '2024-01-15',
            invoiceValue: 11800,
            placeOfSupply: '27',
            reverseCharge: false,
            invoiceType: 'B2B' as 'B2B',
            rate: 18,
            taxableValue: 10000,
            integratedTax: 0,
            centralTax: 900,
            stateTax: 900,
            cessAmount: 0,
            hsnCode: '998314'
          }
        ];

        mockGSTReportsService.prototype.generateGSTR1Report.mockResolvedValue(mockReport);

        const response = await request(app)
          .get('/api/integrations/gst/gstr1/1/2024')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockReport);
        expect(mockGSTReportsService.prototype.generateGSTR1Report).toHaveBeenCalledWith(1, 2024);
      });

      it('should handle errors when generating GSTR1 report', async () => {
        mockGSTReportsService.prototype.generateGSTR1Report.mockRejectedValue(
          new Error('Failed to generate report')
        );

        const response = await request(app)
          .get('/api/integrations/gst/gstr1/1/2024')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Failed to generate report');
      });
    });

    describe('GET /api/integrations/gst/gstr3b/:month/:year', () => {
      it('should generate GSTR3B report successfully', async () => {
        const mockReport = {
          outwardSupplies: {
            taxableSupplies: 100000,
            exemptSupplies: 0,
            nilRatedSupplies: 0
          },
          inwardSupplies: {
            reverseChargeSupplies: 5000,
            importOfGoods: 0,
            importOfServices: 0
          },
          taxLiability: {
            integratedTax: 5000,
            centralTax: 9000,
            stateTax: 9000,
            cessAmount: 0
          },
          taxPaid: {
            integratedTax: 5000,
            centralTax: 9000,
            stateTax: 9000,
            cessAmount: 0
          }
        };

        mockGSTReportsService.prototype.generateGSTR3BReport.mockResolvedValue(mockReport);

        const response = await request(app)
          .get('/api/integrations/gst/gstr3b/1/2024')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockReport);
      });
    });

    describe('GET /api/integrations/gst/gstr1/:month/:year/export', () => {
      it('should export GSTR1 report as JSON', async () => {
        const mockJsonData = JSON.stringify([{ test: 'data' }], null, 2);
        mockGSTReportsService.prototype.exportGSTR1ToJSON.mockResolvedValue(mockJsonData);

        const response = await request(app)
          .get('/api/integrations/gst/gstr1/1/2024/export')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.headers['content-disposition']).toBe('attachment; filename=GSTR1_1_2024.json');
        expect(response.text).toBe(mockJsonData);
      });
    });
  });

  describe('E-Invoice', () => {
    describe('POST /api/integrations/e-invoice/generate/:invoiceId', () => {
      it('should generate e-invoice successfully', async () => {
        const mockResult = {
          irn: 'IRN123456789',
          ackNo: 'ACK123',
          ackDt: '2024-01-15T10:30:00Z',
          signedInvoice: 'signed_invoice_data',
          signedQRCode: 'qr_code_data',
          status: 'success'
        };

        mockEInvoiceService.prototype.generateEInvoice.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/integrations/e-invoice/generate/invoice123')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockResult);
        expect(mockEInvoiceService.prototype.generateEInvoice).toHaveBeenCalledWith('invoice123');
      });

      it('should handle e-invoice generation errors', async () => {
        mockEInvoiceService.prototype.generateEInvoice.mockRejectedValue(
          new Error('GSTN API error')
        );

        const response = await request(app)
          .post('/api/integrations/e-invoice/generate/invoice123')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('GSTN API error');
      });
    });

    describe('GET /api/integrations/e-invoice/qr/:invoiceId', () => {
      it('should generate QR code successfully', async () => {
        const mockQRCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';
        mockEInvoiceService.prototype.generateQRCode.mockResolvedValue(mockQRCode);

        const response = await request(app)
          .get('/api/integrations/e-invoice/qr/invoice123')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.qrCode).toBe(mockQRCode);
      });
    });

    describe('POST /api/integrations/e-invoice/cancel/:invoiceId', () => {
      it('should cancel e-invoice successfully', async () => {
        mockEInvoiceService.prototype.cancelEInvoice.mockResolvedValue(true);

        const response = await request(app)
          .post('/api/integrations/e-invoice/cancel/invoice123')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Duplicate invoice' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.cancelled).toBe(true);
        expect(mockEInvoiceService.prototype.cancelEInvoice).toHaveBeenCalledWith('invoice123', 'Duplicate invoice');
      });
    });
  });

  describe('Workflow Engine', () => {
    describe('GET /api/integrations/workflows/rules', () => {
      it('should get workflow rules successfully', async () => {
        const mockRules = [
          {
            id: 'rule1',
            name: 'Payment Reminder',
            description: 'Send reminder when invoice is overdue',
            trigger: { type: 'payment_overdue', entityType: 'payment', event: 'overdue' },
            conditions: [],
            actions: [{ type: 'send_email', parameters: { template: 'payment_reminder' } }],
            enabled: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ];

        mockWorkflowEngineService.prototype.getWorkflowRules.mockResolvedValue(mockRules);

        const response = await request(app)
          .get('/api/integrations/workflows/rules')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockRules);
      });
    });

    describe('POST /api/integrations/workflows/rules', () => {
      it('should create workflow rule successfully', async () => {
        const mockRuleId = 'rule123';
        mockWorkflowEngineService.prototype.createWorkflowRule.mockResolvedValue(mockRuleId);

        const ruleData = {
          name: 'Test Rule',
          description: 'Test workflow rule',
          trigger: { type: 'invoice_created' as 'invoice_created', entityType: 'invoice' as 'invoice', event: 'created' },
          conditions: [],
          actions: [{ type: 'send_email', parameters: { template: 'invoice_created' } }],
          enabled: true
        };

        const response = await request(app)
          .post('/api/integrations/workflows/rules')
          .set('Authorization', `Bearer ${authToken}`)
          .send(ruleData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.ruleId).toBe(mockRuleId);
        expect(mockWorkflowEngineService.prototype.createWorkflowRule).toHaveBeenCalledWith(ruleData);
      });
    });

    describe('POST /api/integrations/workflows/trigger', () => {
      it('should trigger workflow successfully', async () => {
        mockWorkflowEngineService.prototype.triggerWorkflow.mockResolvedValue();

        const triggerData = {
          triggerType: 'invoice_created',
          entityType: 'invoice',
          data: { id: 'invoice123', amount: 1000 }
        };

        const response = await request(app)
          .post('/api/integrations/workflows/trigger')
          .set('Authorization', `Bearer ${authToken}`)
          .send(triggerData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Workflow triggered successfully');
        expect(mockWorkflowEngineService.prototype.triggerWorkflow).toHaveBeenCalledWith(
          'invoice_created',
          'invoice',
          { id: 'invoice123', amount: 1000 }
        );
      });
    });

    describe('GET /api/integrations/workflows/metrics', () => {
      it('should get workflow metrics successfully', async () => {
        const mockMetrics = {
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          averageExecutionTime: 1500,
          executionsByRule: {
            'rule1': { total: 50, successful: 48, failed: 2 },
            'rule2': { total: 50, successful: 47, failed: 3 }
          }
        };

        mockWorkflowEngineService.prototype.getWorkflowMetrics.mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/api/integrations/workflows/metrics')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockMetrics);
      });
    });
  });

  describe('Webhooks', () => {
    describe('POST /api/integrations/webhooks/register', () => {
      it('should register webhook successfully', async () => {
        // Mock SheetsService.create to return webhook ID
        const mockCreate = jest.fn().mockResolvedValue('webhook123');
        jest.doMock('../services/sheets.service', () => ({
          SheetsService: jest.fn().mockImplementation(() => ({
            create: mockCreate
          }))
        }));

        const webhookData = {
          url: 'https://example.com/webhook',
          events: ['invoice.created', 'invoice.paid'],
          secret: 'webhook_secret'
        };

        const response = await request(app)
          .post('/api/integrations/webhooks/register')
          .set('Authorization', `Bearer ${authToken}`)
          .send(webhookData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.webhookId).toBe('webhook123');
      });
    });
  });

  describe('API Keys', () => {
    describe('POST /api/integrations/api-keys', () => {
      it('should create API key successfully', async () => {
        // Mock SheetsService.create to return key ID
        const mockCreate = jest.fn().mockResolvedValue('key123');
        jest.doMock('../services/sheets.service', () => ({
          SheetsService: jest.fn().mockImplementation(() => ({
            create: mockCreate
          }))
        }));

        const keyData = {
          name: 'Test API Key',
          permissions: ['read:invoices', 'write:invoices'],
          expiresAt: '2024-12-31T23:59:59Z'
        };

        const response = await request(app)
          .post('/api/integrations/api-keys')
          .set('Authorization', `Bearer ${authToken}`)
          .send(keyData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.keyId).toBe('key123');
        expect(response.body.data.apiKey).toMatch(/^pk_[A-Za-z0-9]{32}$/);
      });
    });
  });

  describe('Third-party Integrations', () => {
    describe('POST /api/integrations/quickbooks/sync', () => {
      it('should sync with QuickBooks successfully', async () => {
        // Mock SheetsService methods
        const mockRead = jest.fn().mockResolvedValue([
          { id: 'inv1', invoice_number: 'INV-001', total_amount: 1000, client_id: 'client1' }
        ]);
        const mockUpdate = jest.fn().mockResolvedValue(true);

        jest.doMock('../services/sheets.service', () => ({
          SheetsService: jest.fn().mockImplementation(() => ({
            read: mockRead,
            update: mockUpdate
          }))
        }));

        // Mock QuickBooks API response
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            QueryResponse: {
              Invoice: [{ Id: 'qb123' }]
            }
          })
        });

        const syncData = {
          accessToken: 'qb_access_token',
          companyId: 'company123'
        };

        const response = await request(app)
          .post('/api/integrations/quickbooks/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .send(syncData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.syncResults).toHaveLength(1);
        expect(response.body.data.syncResults[0]).toEqual({
          invoiceId: 'inv1',
          quickbooksId: 'qb123',
          status: 'created'
        });
      });
    });
  });

  describe('Compliance and Audit', () => {
    describe('GET /api/integrations/compliance/audit-trail', () => {
      it('should get audit trail successfully', async () => {
        const mockAuditLogs = [
          {
            id: 'log1',
            entity_type: 'invoice',
            entity_id: 'inv1',
            action: 'created',
            user_id: 'user1',
            created_at: '2024-01-15T10:00:00Z'
          }
        ];

        // Mock SheetsService.read
        const mockRead = jest.fn().mockResolvedValue(mockAuditLogs);
        jest.doMock('../services/sheets.service', () => ({
          SheetsService: jest.fn().mockImplementation(() => ({
            read: mockRead
          }))
        }));

        const response = await request(app)
          .get('/api/integrations/compliance/audit-trail?entityType=invoice&entityId=inv1')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(mockAuditLogs);
      });
    });
  });
});

describe('Webhook Service', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService();
    jest.clearAllMocks();
  });

  describe('registerWebhook', () => {
    it('should register webhook successfully', async () => {
      const mockCreate = jest.fn().mockResolvedValue('webhook123');
      (webhookService as any).sheetsService.create = mockCreate;

      const webhookId = await webhookService.registerWebhook(
        'https://example.com/webhook',
        ['invoice.created'],
        'secret123'
      );

      expect(webhookId).toBe('webhook123');
      expect(mockCreate).toHaveBeenCalledWith('Webhooks', expect.objectContaining({
        url: 'https://example.com/webhook',
        events: ['invoice.created'],
        secret: 'secret123',
        active: true
      }));
    });
  });

  describe('triggerWebhook', () => {
    it('should trigger webhook for matching events', async () => {
      const mockQuery = jest.fn().mockResolvedValue([
        {
          id: 'webhook1',
          url: 'https://example.com/webhook',
          events: ['invoice.created'],
          secret: 'secret123',
          active: true
        }
      ]);
      const mockCreate = jest.fn().mockResolvedValue('event123');

      (webhookService as any).sheetsService.query = mockQuery;
      (webhookService as any).sheetsService.create = mockCreate;

      // Mock successful HTTP request
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      await webhookService.triggerWebhook('invoice.created', { id: 'inv1', amount: 1000 });

      expect(mockQuery).toHaveBeenCalledWith('Webhooks', {
        active: true,
        events: { contains: 'invoice.created' }
      });
      expect(mockCreate).toHaveBeenCalledWith('Webhook_Events', expect.objectContaining({
        event: 'invoice.created',
        data: { id: 'inv1', amount: 1000 },
        status: 'pending'
      }));
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate webhook signature correctly', async () => {
      const payload = '{"test":"data"}';
      const secret = 'secret123';
      const validSignature = require('crypto')
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = await webhookService.validateWebhookSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);

      const isInvalid = await webhookService.validateWebhookSignature(payload, 'invalid_signature', secret);
      expect(isInvalid).toBe(false);
    });
  });
});