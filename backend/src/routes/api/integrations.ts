import express from 'express';
import { GoogleSheetsService } from '../../services/googleSheets';
import { GSTReportingService } from '../../services/gstReporting';
import { EInvoicingService } from '../../services/eInvoicing';
import { AdvancedAutomationService } from '../../services/advancedAutomation';
import { FinancialReportingService } from '../../services/financialReporting';
import { AutomationService } from '../../services/automation';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { body, param, query } from 'express-validator';

const router = express.Router();

// Initialize services
const sheetsService = new GoogleSheetsService();
const financialReportingService = new FinancialReportingService(sheetsService);
const gstReportingService = new GSTReportingService(sheetsService, financialReportingService);
const eInvoicingService = new EInvoicingService(sheetsService);
const automationService = new AutomationService();
const advancedAutomationService = new AdvancedAutomationService(
  sheetsService,
  automationService,
  gstReportingService,
  eInvoicingService
);

/**
 * @route   GET /api/integrations/health
 * @desc    Health check endpoint for integrations
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/integrations/gst/reports
 * @desc    Generate GST report
 * @access  Private
 */
router.get('/gst/reports', 
  authMiddleware,
  [
    query('type').isIn(['gstr1', 'gstr2', 'gstr3b', 'gstr9']).withMessage('Invalid GST report type'),
    query('startDate').isISO8601().withMessage('Start date must be a valid ISO date'),
    query('endDate').isISO8601().withMessage('End date must be a valid ISO date'),
    query('format').optional().isIn(['json', 'pdf', 'csv', 'excel']).withMessage('Invalid format')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { type, startDate, endDate, format = 'json', gstType } = req.query;
      
      const filters = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        gstType: gstType as 'intra' | 'inter' | 'all'
      };
      
      let reportData;
      
      if (type === 'gstr1') {
        reportData = await gstReportingService.generateGSTR1Report(filters);
      } else if (type === 'gstr3b') {
        reportData = await gstReportingService.generateGSTR3BReport(filters);
      } else {
        return res.status(400).json({ error: 'Report type not implemented yet' });
      }
      
      // Export in requested format
      const exportedData = await gstReportingService.exportGSTReport(
        type as any,
        reportData,
        format as any
      );
      
      if (format === 'json') {
        return res.json(JSON.parse(exportedData as string));
      } else if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=gst_report_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(exportedData);
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=gst_report_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
        return res.send(exportedData);
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=gst_report_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
        return res.send(exportedData);
      }
    } catch (error) {
      console.error('Error generating GST report:', error);
      res.status(500).json({ error: 'Failed to generate GST report' });
    }
  }
);

/**
 * @route   POST /api/integrations/einvoice/:invoiceId
 * @desc    Generate e-invoice for an invoice
 * @access  Private
 */
router.post('/einvoice/:invoiceId',
  authMiddleware,
  [
    param('invoiceId').isString().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      
      const eInvoiceData = await eInvoicingService.generateEInvoice(invoiceId);
      
      res.json({
        success: true,
        data: eInvoiceData
      });
    } catch (error) {
      console.error('Error generating e-invoice:', error);
      res.status(500).json({ error: 'Failed to generate e-invoice' });
    }
  }
);

/**
 * @route   GET /api/integrations/einvoice/:invoiceId
 * @desc    Get e-invoice details for an invoice
 * @access  Private
 */
router.get('/einvoice/:invoiceId',
  authMiddleware,
  [
    param('invoiceId').isString().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      
      const eInvoiceData = await eInvoicingService.getEInvoiceByInvoiceId(invoiceId);
      
      if (!eInvoiceData) {
        return res.status(404).json({ error: 'E-invoice not found' });
      }
      
      res.json({
        success: true,
        data: eInvoiceData
      });
    } catch (error) {
      console.error('Error getting e-invoice:', error);
      res.status(500).json({ error: 'Failed to get e-invoice' });
    }
  }
);

/**
 * @route   GET /api/integrations/einvoice/:invoiceId/pdf
 * @desc    Get e-invoice PDF for an invoice
 * @access  Private
 */
router.get('/einvoice/:invoiceId/pdf',
  authMiddleware,
  [
    param('invoiceId').isString().withMessage('Invoice ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      
      const pdfBuffer = await eInvoicingService.generateEInvoicePDF(invoiceId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=einvoice_${invoiceId}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating e-invoice PDF:', error);
      res.status(500).json({ error: 'Failed to generate e-invoice PDF' });
    }
  }
);

/**
 * @route   POST /api/integrations/einvoice/:invoiceId/cancel
 * @desc    Cancel e-invoice for an invoice
 * @access  Private
 */
router.post('/einvoice/:invoiceId/cancel',
  authMiddleware,
  [
    param('invoiceId').isString().withMessage('Invoice ID is required'),
    body('reason').isString().withMessage('Cancellation reason is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { reason } = req.body;
      
      const success = await eInvoicingService.cancelEInvoice(invoiceId, reason);
      
      res.json({
        success,
        message: 'E-invoice cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling e-invoice:', error);
      res.status(500).json({ error: 'Failed to cancel e-invoice' });
    }
  }
);

/**
 * @route   POST /api/integrations/automation/workflow
 * @desc    Create or update a workflow rule
 * @access  Private
 */
router.post('/automation/workflow',
  authMiddleware,
  [
    body('name').isString().withMessage('Workflow name is required'),
    body('trigger').isObject().withMessage('Trigger configuration is required'),
    body('actions').isArray().withMessage('Actions must be an array')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id, name, description, is_active, trigger, actions } = req.body;
      
      // Format the workflow rule
      const workflowRule = {
        id: id || `rule_${Date.now().toString(36)}`,
        name,
        description: description || '',
        is_active: is_active !== undefined ? is_active : true,
        trigger,
        actions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Save to Google Sheets
      if (id) {
        // Update existing rule
        await sheetsService.update('AdvancedWorkflowRules', id, {
          id: workflowRule.id,
          name: workflowRule.name,
          description: workflowRule.description,
          is_active: workflowRule.is_active.toString(),
          trigger: JSON.stringify(workflowRule.trigger),
          actions: JSON.stringify(workflowRule.actions),
          updated_at: workflowRule.updated_at
        });
      } else {
        // Create new rule
        await sheetsService.create('AdvancedWorkflowRules', {
          id: workflowRule.id,
          name: workflowRule.name,
          description: workflowRule.description,
          is_active: workflowRule.is_active.toString(),
          trigger: JSON.stringify(workflowRule.trigger),
          actions: JSON.stringify(workflowRule.actions),
          created_at: workflowRule.created_at,
          updated_at: workflowRule.updated_at
        });
      }
      
      res.json({
        success: true,
        data: workflowRule
      });
    } catch (error) {
      console.error('Error creating/updating workflow rule:', error);
      res.status(500).json({ error: 'Failed to create/update workflow rule' });
    }
  }
);

/**
 * @route   GET /api/integrations/automation/workflows
 * @desc    Get all workflow rules
 * @access  Private
 */
router.get('/automation/workflows',
  authMiddleware,
  async (req, res) => {
    try {
      const rulesData = await sheetsService.read('AdvancedWorkflowRules');
      
      // Format the workflow rules
      const workflowRules = rulesData.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        is_active: row.is_active === 'true' || row.is_active === true,
        trigger: JSON.parse(row.trigger),
        actions: JSON.parse(row.actions),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
      
      res.json({
        success: true,
        data: workflowRules
      });
    } catch (error) {
      console.error('Error getting workflow rules:', error);
      res.status(500).json({ error: 'Failed to get workflow rules' });
    }
  }
);

/**
 * @route   DELETE /api/integrations/automation/workflow/:id
 * @desc    Delete a workflow rule
 * @access  Private
 */
router.delete('/automation/workflow/:id',
  authMiddleware,
  [
    param('id').isString().withMessage('Workflow ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete the workflow rule
      await sheetsService.delete('AdvancedWorkflowRules', id);
      
      res.json({
        success: true,
        message: 'Workflow rule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting workflow rule:', error);
      res.status(500).json({ error: 'Failed to delete workflow rule' });
    }
  }
);

/**
 * @route   POST /api/integrations/webhook
 * @desc    Register a webhook endpoint
 * @access  Private
 */
router.post('/webhook',
  authMiddleware,
  [
    body('key').isString().withMessage('Webhook key is required'),
    body('url').isURL().withMessage('Valid webhook URL is required'),
    body('events').isArray().withMessage('Events must be an array')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { key, url, events, description } = req.body;
      
      // Format the webhook
      const webhook = {
        id: `webhook_${Date.now().toString(36)}`,
        key,
        url,
        events: JSON.stringify(events),
        description: description || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Check if Webhooks sheet exists
      try {
        await sheetsService.read('Webhooks', null, 1);
      } catch (error) {
        // Create the sheet
        await sheetsService.createSheet('Webhooks', [
          'id',
          'key',
          'url',
          'events',
          'description',
          'created_at',
          'updated_at'
        ]);
      }
      
      // Check if webhook with same key already exists
      const existingWebhooks = await sheetsService.query('Webhooks', { key });
      
      if (existingWebhooks.length > 0) {
        // Update existing webhook
        await sheetsService.update('Webhooks', existingWebhooks[0].id, {
          ...webhook,
          id: existingWebhooks[0].id,
          created_at: existingWebhooks[0].created_at
        });
      } else {
        // Create new webhook
        await sheetsService.create('Webhooks', webhook);
      }
      
      res.json({
        success: true,
        data: {
          ...webhook,
          events: JSON.parse(webhook.events)
        }
      });
    } catch (error) {
      console.error('Error registering webhook:', error);
      res.status(500).json({ error: 'Failed to register webhook' });
    }
  }
);

/**
 * @route   GET /api/integrations/webhooks
 * @desc    Get all registered webhooks
 * @access  Private
 */
router.get('/webhooks',
  authMiddleware,
  async (req, res) => {
    try {
      // Check if Webhooks sheet exists
      try {
        const webhooksData = await sheetsService.read('Webhooks');
        
        // Format the webhooks
        const webhooks = webhooksData.map(row => ({
          id: row.id,
          key: row.key,
          url: row.url,
          events: JSON.parse(row.events),
          description: row.description,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        
        res.json({
          success: true,
          data: webhooks
        });
      } catch (error) {
        // Sheet doesn't exist
        res.json({
          success: true,
          data: []
        });
      }
    } catch (error) {
      console.error('Error getting webhooks:', error);
      res.status(500).json({ error: 'Failed to get webhooks' });
    }
  }
);

/**
 * @route   DELETE /api/integrations/webhook/:id
 * @desc    Delete a webhook
 * @access  Private
 */
router.delete('/webhook/:id',
  authMiddleware,
  [
    param('id').isString().withMessage('Webhook ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete the webhook
      await sheetsService.delete('Webhooks', id);
      
      res.json({
        success: true,
        message: 'Webhook deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  }
);

/**
 * @route   POST /api/integrations/test-webhook/:key
 * @desc    Test a webhook by sending a test payload
 * @access  Private
 */
router.post('/test-webhook/:key',
  authMiddleware,
  [
    param('key').isString().withMessage('Webhook key is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { key } = req.params;
      
      // Get webhook details
      const webhooks = await sheetsService.query('Webhooks', { key });
      
      if (webhooks.length === 0) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      
      // Trigger webhook with test payload
      await advancedAutomationService.triggerWebhook(key, {
        event: 'test',
        message: 'This is a test webhook payload',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Test webhook triggered successfully'
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  }
);

export default router;