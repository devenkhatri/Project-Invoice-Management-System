import express from 'express';
import { authenticateToken as auth } from '../middleware/auth';
import { GSTReportsService } from '../services/gst-reports.service';
import { EInvoiceService } from '../services/e-invoice.service';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { SheetsService } from '../services/sheets.service';

const router = express.Router();
const gstReportsService = new GSTReportsService();
const eInvoiceService = new EInvoiceService();
const workflowEngine = new WorkflowEngineService();
const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
const sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);

// GST Reports Endpoints
router.get('/gst/gstr1/:month/:year', auth, async (req, res) => {
  try {
    const { month, year } = req.params;
    const report = await gstReportsService.generateGSTR1Report(parseInt(month), parseInt(year));
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gst/gstr3b/:month/:year', auth, async (req, res) => {
  try {
    const { month, year } = req.params;
    const report = await gstReportsService.generateGSTR3BReport(parseInt(month), parseInt(year));
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gst/gstr1/:month/:year/export', auth, async (req, res) => {
  try {
    const { month, year } = req.params;
    const jsonData = await gstReportsService.exportGSTR1ToJSON(parseInt(month), parseInt(year));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${month}_${year}.json`);
    res.send(jsonData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gst/gstr3b/:month/:year/export', auth, async (req, res) => {
  try {
    const { month, year } = req.params;
    const jsonData = await gstReportsService.exportGSTR3BToJSON(parseInt(month), parseInt(year));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR3B_${month}_${year}.json`);
    res.send(jsonData);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// E-Invoice Endpoints
router.post('/e-invoice/generate/:invoiceId', auth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const result = await eInvoiceService.generateEInvoice(invoiceId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/e-invoice/qr/:invoiceId', auth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const qrCode = await eInvoiceService.generateQRCode(invoiceId);
    res.json({ success: true, data: { qrCode } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/e-invoice/cancel/:invoiceId', auth, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { reason } = req.body;
    const result = await eInvoiceService.cancelEInvoice(invoiceId, reason);
    res.json({ success: true, data: { cancelled: result } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/e-invoice/status/:irn', auth, async (req, res) => {
  try {
    const { irn } = req.params;
    const status = await eInvoiceService.getEInvoiceStatus(irn);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow Engine Endpoints
router.get('/workflows/rules', auth, async (req, res) => {
  try {
    const rules = await workflowEngine.getWorkflowRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workflows/rules', auth, async (req, res) => {
  try {
    const ruleId = await workflowEngine.createWorkflowRule(req.body);
    res.json({ success: true, data: { ruleId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/workflows/rules/:ruleId', auth, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = await workflowEngine.updateWorkflowRule(ruleId, req.body);
    res.json({ success, data: { updated: success } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/workflows/rules/:ruleId', auth, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const success = await workflowEngine.deleteWorkflowRule(ruleId);
    res.json({ success, data: { deleted: success } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/workflows/executions', auth, async (req, res) => {
  try {
    const { ruleId } = req.query;
    const executions = await workflowEngine.getWorkflowExecutions(ruleId as string);
    res.json({ success: true, data: executions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/workflows/metrics', auth, async (req, res) => {
  try {
    const metrics = await workflowEngine.getWorkflowMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/workflows/trigger', auth, async (req, res) => {
  try {
    const { triggerType, entityType, data } = req.body;
    await workflowEngine.triggerWorkflow(triggerType, entityType, data);
    res.json({ success: true, message: 'Workflow triggered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook Management
router.post('/webhooks/register', auth, async (req, res) => {
  try {
    const { url, events, secret } = req.body;
    
    const webhookData = {
      url,
      events: Array.isArray(events) ? events : [events],
      secret,
      active: true,
      created_at: new Date().toISOString()
    };

    const webhookId = await sheetsService.create('Webhooks', webhookData);
    res.json({ success: true, data: { webhookId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/webhooks', auth, async (req, res) => {
  try {
    const webhooks = await sheetsService.read('Webhooks');
    res.json({ success: true, data: webhooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/webhooks/:webhookId', auth, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const success = await sheetsService.update('Webhooks', webhookId, {
      ...req.body,
      updated_at: new Date().toISOString()
    });
    res.json({ success, data: { updated: success } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/webhooks/:webhookId', auth, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const success = await sheetsService.delete('Webhooks', webhookId);
    res.json({ success, data: { deleted: success } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Key Management
router.post('/api-keys', auth, async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;
    
    const apiKey = generateApiKey();
    const apiKeyData = {
      name,
      key: apiKey,
      permissions: Array.isArray(permissions) ? permissions : [permissions],
      expires_at: expiresAt,
      active: true,
      created_at: new Date().toISOString(),
      last_used: null
    };

    const keyId = await sheetsService.create('API_Keys', apiKeyData);
    res.json({ success: true, data: { keyId, apiKey } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api-keys', auth, async (req, res) => {
  try {
    const apiKeys = await sheetsService.read('API_Keys');
    // Remove actual keys from response for security
    const sanitizedKeys = apiKeys.map(key => ({
      ...key,
      key: key.key.substring(0, 8) + '...'
    }));
    res.json({ success: true, data: sanitizedKeys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api-keys/:keyId', auth, async (req, res) => {
  try {
    const { keyId } = req.params;
    const success = await sheetsService.delete('API_Keys', keyId);
    res.json({ success, data: { deleted: success } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Third-party Integration Endpoints
router.post('/integrations/quickbooks/sync', auth, async (req, res) => {
  try {
    // QuickBooks integration logic
    const { accessToken, companyId } = req.body;
    
    // Sync invoices to QuickBooks
    const invoices = await sheetsService.read('Invoices');
    const syncResults = [];

    for (const invoice of invoices) {
      if (!invoice.quickbooks_id) {
        // Create invoice in QuickBooks
        const qbInvoice = await createQuickBooksInvoice(invoice, accessToken, companyId);
        
        // Update local invoice with QuickBooks ID
        await sheetsService.update('Invoices', invoice.id, {
          quickbooks_id: qbInvoice.Id,
          synced_at: new Date().toISOString()
        });

        syncResults.push({ invoiceId: invoice.id, quickbooksId: qbInvoice.Id, status: 'created' });
      }
    }

    res.json({ success: true, data: { syncResults } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/integrations/xero/sync', auth, async (req, res) => {
  try {
    // Xero integration logic
    const { accessToken, tenantId } = req.body;
    
    // Similar to QuickBooks sync
    const invoices = await sheetsService.read('Invoices');
    const syncResults = [];

    for (const invoice of invoices) {
      if (!invoice.xero_id) {
        const xeroInvoice = await createXeroInvoice(invoice, accessToken, tenantId);
        
        await sheetsService.update('Invoices', invoice.id, {
          xero_id: xeroInvoice.InvoiceID,
          synced_at: new Date().toISOString()
        });

        syncResults.push({ invoiceId: invoice.id, xeroId: xeroInvoice.InvoiceID, status: 'created' });
      }
    }

    res.json({ success: true, data: { syncResults } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compliance and Audit Trail
router.get('/compliance/audit-trail', auth, async (req, res) => {
  try {
    const { entityType, entityId, startDate, endDate } = req.query;
    
    let auditLogs = await sheetsService.read('Audit_Logs');
    
    // Filter by parameters
    if (entityType) {
      auditLogs = auditLogs.filter(log => log.entity_type === entityType);
    }
    if (entityId) {
      auditLogs = auditLogs.filter(log => log.entity_id === entityId);
    }
    if (startDate) {
      auditLogs = auditLogs.filter(log => new Date(log.created_at) >= new Date(startDate as string));
    }
    if (endDate) {
      auditLogs = auditLogs.filter(log => new Date(log.created_at) <= new Date(endDate as string));
    }

    res.json({ success: true, data: auditLogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/compliance/data-retention', auth, async (req, res) => {
  try {
    const retentionPolicies = await sheetsService.read('Data_Retention_Policies');
    res.json({ success: true, data: retentionPolicies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'pk_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createQuickBooksInvoice(invoice: any, accessToken: string, companyId: string): Promise<any> {
  // QuickBooks API integration
  const qbInvoiceData = {
    Line: [{
      Amount: invoice.total_amount,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1' } // Default service item
      }
    }],
    CustomerRef: { value: invoice.client_id }
  };

  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(qbInvoiceData)
  });

  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.QueryResponse.Invoice[0];
}

async function createXeroInvoice(invoice: any, accessToken: string, tenantId: string): Promise<any> {
  // Xero API integration
  const xeroInvoiceData = {
    Type: 'ACCREC',
    Contact: { ContactID: invoice.client_id },
    LineItems: [{
      Description: invoice.description,
      Quantity: 1,
      UnitAmount: invoice.total_amount,
      AccountCode: '200'
    }]
  };

  const response = await fetch('https://api.xero.com/api.xro/2.0/Invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(xeroInvoiceData)
  });

  if (!response.ok) {
    throw new Error(`Xero API error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.Invoices[0];
}

export default router;