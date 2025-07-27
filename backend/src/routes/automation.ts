import express from 'express';
import { AutomationService } from '../services/automation';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = express.Router();
const automationService = AutomationService.getInstance();

// Validation schemas
const reminderConfigSchema = [
  body('days_before').optional().isInt({ min: 0 }).withMessage('Days before must be a non-negative integer'),
  body('days_after').optional().isInt({ min: 0 }).withMessage('Days after must be a non-negative integer'),
  body('template').isString().notEmpty().withMessage('Template is required'),
  body('method').isIn(['email', 'sms', 'both']).withMessage('Method must be email, sms, or both'),
  body('priority').isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('escalation_rules').optional().isArray().withMessage('Escalation rules must be an array')
];

const automationRuleSchema = [
  body('name').isString().notEmpty().withMessage('Rule name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('trigger').isObject().withMessage('Trigger configuration is required'),
  body('trigger.type').isString().notEmpty().withMessage('Trigger type is required'),
  body('conditions').optional().isArray().withMessage('Conditions must be an array'),
  body('actions').isArray().notEmpty().withMessage('Actions array is required'),
  body('is_active').isBoolean().withMessage('is_active must be a boolean')
];

const recurringTaskSchema = [
  body('title').isString().notEmpty().withMessage('Task title is required'),
  body('project_id').isString().notEmpty().withMessage('Project ID is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('estimated_hours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be non-negative'),
  body('due_date').isISO8601().withMessage('Due date must be a valid date'),
  body('recurring_config').isObject().withMessage('Recurring configuration is required'),
  body('recurring_config.frequency').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).withMessage('Invalid frequency'),
  body('recurring_config.interval').isInt({ min: 1 }).withMessage('Interval must be a positive integer'),
  body('recurring_config.max_occurrences').optional().isInt({ min: 1 }).withMessage('Max occurrences must be positive')
];

// Project deadline reminders
router.post('/reminders/project-deadline/:projectId',
  authenticateToken,
  requireRole(['admin']),
  param('projectId').isString().notEmpty().withMessage('Project ID is required'),
  ...reminderConfigSchema,
  validateRequest,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const reminderConfig = req.body;

      const scheduleId = await automationService.scheduleProjectDeadlineReminder(
        projectId,
        reminderConfig
      );

      res.status(201).json({
        success: true,
        data: {
          schedule_id: scheduleId,
          project_id: projectId,
          config: reminderConfig
        },
        message: 'Project deadline reminder scheduled successfully'
      });
    } catch (error) {
      console.error('Error scheduling project deadline reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule project deadline reminder',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Invoice payment reminders
router.post('/reminders/invoice-payment/:invoiceId',
  authenticateToken,
  requireRole(['admin']),
  param('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
  ...reminderConfigSchema,
  validateRequest,
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const reminderConfig = req.body;

      const scheduleId = await automationService.scheduleInvoicePaymentReminder(
        invoiceId,
        reminderConfig
      );

      res.status(201).json({
        success: true,
        data: {
          schedule_id: scheduleId,
          invoice_id: invoiceId,
          config: reminderConfig
        },
        message: 'Invoice payment reminder scheduled successfully'
      });
    } catch (error) {
      console.error('Error scheduling invoice payment reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule invoice payment reminder',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Task due reminders
router.post('/reminders/task-due/:taskId',
  authenticateToken,
  requireRole(['admin']),
  param('taskId').isString().notEmpty().withMessage('Task ID is required'),
  ...reminderConfigSchema,
  validateRequest,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const reminderConfig = req.body;

      const scheduleId = await automationService.scheduleTaskDueReminder(
        taskId,
        reminderConfig
      );

      res.status(201).json({
        success: true,
        data: {
          schedule_id: scheduleId,
          task_id: taskId,
          config: reminderConfig
        },
        message: 'Task due reminder scheduled successfully'
      });
    } catch (error) {
      console.error('Error scheduling task due reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule task due reminder',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Client follow-up automation
router.post('/reminders/client-followup',
  authenticateToken,
  requireRole(['admin']),
  body('client_id').isString().notEmpty().withMessage('Client ID is required'),
  body('project_id').isString().notEmpty().withMessage('Project ID is required'),
  body('milestone_type').isString().notEmpty().withMessage('Milestone type is required'),
  ...reminderConfigSchema,
  validateRequest,
  async (req, res) => {
    try {
      const { client_id, project_id, milestone_type, ...reminderConfig } = req.body;

      const scheduleId = await automationService.scheduleClientFollowup(
        client_id,
        project_id,
        milestone_type,
        reminderConfig
      );

      res.status(201).json({
        success: true,
        data: {
          schedule_id: scheduleId,
          client_id,
          project_id,
          milestone_type,
          config: reminderConfig
        },
        message: 'Client follow-up scheduled successfully'
      });
    } catch (error) {
      console.error('Error scheduling client follow-up:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule client follow-up',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Proposal to invoice conversion
router.post('/convert-proposal/:proposalId',
  authenticateToken,
  requireRole(['admin']),
  param('proposalId').isString().notEmpty().withMessage('Proposal ID is required'),
  body('client_id').isString().notEmpty().withMessage('Client ID is required'),
  body('client_name').optional().isString().withMessage('Client name must be a string'),
  body('line_items').optional().isArray().withMessage('Line items must be an array'),
  body('subtotal').optional().isFloat({ min: 0 }).withMessage('Subtotal must be non-negative'),
  body('total_amount').isFloat({ min: 0 }).withMessage('Total amount must be non-negative'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('payment_terms').optional().isString().withMessage('Payment terms must be a string'),
  body('create_project').optional().isBoolean().withMessage('Create project must be boolean'),
  body('project_name').optional().isString().withMessage('Project name must be a string'),
  body('project_end_date').optional().isISO8601().withMessage('Project end date must be valid'),
  validateRequest,
  async (req, res) => {
    try {
      const { proposalId } = req.params;
      const acceptanceData = req.body;

      const result = await automationService.convertProposalToInvoice(
        proposalId,
        acceptanceData
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Proposal converted to invoice successfully'
      });
    } catch (error) {
      console.error('Error converting proposal to invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to convert proposal to invoice',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Automation rules management
router.get('/rules',
  authenticateToken,
  requireRole(['admin']),
  query('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const { is_active } = req.query;
      const filters: any = {};
      
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true';
      }

      const rules = await automationService['sheetsService'].query('Automation_Rules', filters);

      // Parse JSON fields for response
      const parsedRules = rules.map(rule => ({
        ...rule,
        trigger: JSON.parse(rule.trigger),
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions)
      }));

      res.json({
        success: true,
        data: parsedRules,
        count: parsedRules.length
      });
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch automation rules',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/rules',
  authenticateToken,
  requireRole(['admin']),
  ...automationRuleSchema,
  validateRequest,
  async (req, res) => {
    try {
      const ruleData = req.body;

      const ruleId = await automationService.createAutomationRule(ruleData);

      res.status(201).json({
        success: true,
        data: {
          rule_id: ruleId,
          ...ruleData
        },
        message: 'Automation rule created successfully'
      });
    } catch (error) {
      console.error('Error creating automation rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create automation rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.put('/rules/:ruleId',
  authenticateToken,
  requireRole(['admin']),
  param('ruleId').isString().notEmpty().withMessage('Rule ID is required'),
  body('name').optional().isString().notEmpty().withMessage('Rule name must be non-empty'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('trigger').optional().isObject().withMessage('Trigger must be an object'),
  body('conditions').optional().isArray().withMessage('Conditions must be an array'),
  body('actions').optional().isArray().withMessage('Actions must be an array'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const success = await automationService.updateAutomationRule(ruleId, updates);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Automation rule not found'
        });
      }

      res.json({
        success: true,
        data: {
          rule_id: ruleId,
          ...updates
        },
        message: 'Automation rule updated successfully'
      });
    } catch (error) {
      console.error('Error updating automation rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update automation rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.delete('/rules/:ruleId',
  authenticateToken,
  requireRole(['admin']),
  param('ruleId').isString().notEmpty().withMessage('Rule ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const { ruleId } = req.params;

      const success = await automationService['sheetsService'].delete('Automation_Rules', ruleId);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Automation rule not found'
        });
      }

      res.json({
        success: true,
        message: 'Automation rule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting automation rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete automation rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Recurring tasks
router.post('/recurring-tasks',
  authenticateToken,
  requireRole(['admin']),
  ...recurringTaskSchema,
  validateRequest,
  async (req, res) => {
    try {
      const { recurring_config, ...taskData } = req.body;

      const taskIds = await automationService.scheduleRecurringTask(taskData, recurring_config);

      res.status(201).json({
        success: true,
        data: {
          task_ids: taskIds,
          task_data: taskData,
          recurring_config
        },
        message: `${taskIds.length} recurring tasks scheduled successfully`
      });
    } catch (error) {
      console.error('Error scheduling recurring tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule recurring tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Send notification
router.post('/notifications/send',
  authenticateToken,
  requireRole(['admin']),
  body('type').isIn(['email', 'sms', 'in_app', 'webhook']).withMessage('Invalid notification type'),
  body('recipient').isString().notEmpty().withMessage('Recipient is required'),
  body('template_id').isString().notEmpty().withMessage('Template ID is required'),
  body('variables').optional().isObject().withMessage('Variables must be an object'),
  validateRequest,
  async (req, res) => {
    try {
      const { type, recipient, template_id, variables = {} } = req.body;

      const success = await automationService.sendNotification(
        type,
        recipient,
        template_id,
        variables
      );

      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to send notification'
        });
      }

      res.json({
        success: true,
        data: {
          type,
          recipient,
          template_id,
          variables
        },
        message: 'Notification sent successfully'
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Workflow triggers (for manual triggering)
router.post('/triggers/:triggerType/:entityId',
  authenticateToken,
  requireRole(['admin']),
  param('triggerType').isString().notEmpty().withMessage('Trigger type is required'),
  param('entityId').isString().notEmpty().withMessage('Entity ID is required'),
  body('trigger_data').optional().isObject().withMessage('Trigger data must be an object'),
  validateRequest,
  async (req, res) => {
    try {
      const { triggerType, entityId } = req.params;
      const { trigger_data = {} } = req.body;

      await automationService.executeWorkflowTrigger(triggerType, entityId, trigger_data);

      res.json({
        success: true,
        data: {
          trigger_type: triggerType,
          entity_id: entityId,
          trigger_data
        },
        message: 'Workflow trigger executed successfully'
      });
    } catch (error) {
      console.error('Error executing workflow trigger:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute workflow trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Analytics and performance tracking
router.get('/analytics',
  authenticateToken,
  requireRole(['admin']),
  query('start_date').isISO8601().withMessage('Start date must be valid'),
  query('end_date').isISO8601().withMessage('End date must be valid'),
  validateRequest,
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query as { start_date: string; end_date: string };

      const analytics = await automationService.getAutomationAnalytics({
        start: start_date,
        end: end_date
      });

      res.json({
        success: true,
        data: analytics,
        date_range: {
          start: start_date,
          end: end_date
        }
      });
    } catch (error) {
      console.error('Error fetching automation analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch automation analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get scheduled reminders
router.get('/reminders',
  authenticateToken,
  requireRole(['admin']),
  query('type').optional().isString().withMessage('Type must be a string'),
  query('status').optional().isIn(['pending', 'sent', 'failed', 'cancelled']).withMessage('Invalid status'),
  query('entity_id').optional().isString().withMessage('Entity ID must be a string'),
  validateRequest,
  async (req, res) => {
    try {
      const { type, status, entity_id } = req.query;
      const filters: any = {};

      if (type) filters.type = type;
      if (status) filters.status = status;
      if (entity_id) filters.entity_id = entity_id;

      const reminders = await automationService['sheetsService'].query('Reminder_Schedules', filters);

      // Parse reminder configs for response
      const parsedReminders = reminders.map(reminder => ({
        ...reminder,
        reminder_config: JSON.parse(reminder.reminder_config)
      }));

      res.json({
        success: true,
        data: parsedReminders,
        count: parsedReminders.length,
        filters
      });
    } catch (error) {
      console.error('Error fetching reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reminders',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Cancel reminder
router.delete('/reminders/:reminderId',
  authenticateToken,
  requireRole(['admin']),
  param('reminderId').isString().notEmpty().withMessage('Reminder ID is required'),
  validateRequest,
  async (req, res) => {
    try {
      const { reminderId } = req.params;

      const success = await automationService['sheetsService'].update('Reminder_Schedules', reminderId, {
        status: 'cancelled'
      });

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found'
        });
      }

      res.json({
        success: true,
        message: 'Reminder cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel reminder',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get notification templates
router.get('/templates',
  authenticateToken,
  requireRole(['admin']),
  query('type').optional().isIn(['email', 'sms']).withMessage('Invalid template type'),
  query('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const { type, is_active } = req.query;
      const filters: any = {};

      if (type) filters.type = type;
      if (is_active !== undefined) filters.is_active = is_active === 'true';

      const templates = await automationService['sheetsService'].query('Notification_Templates', filters);

      // Parse variables for response
      const parsedTemplates = templates.map(template => ({
        ...template,
        variables: JSON.parse(template.variables)
      }));

      res.json({
        success: true,
        data: parsedTemplates,
        count: parsedTemplates.length,
        filters
      });
    } catch (error) {
      console.error('Error fetching notification templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Create notification template
router.post('/templates',
  authenticateToken,
  requireRole(['admin']),
  body('name').isString().notEmpty().withMessage('Template name is required'),
  body('type').isIn(['email', 'sms']).withMessage('Template type must be email or sms'),
  body('subject').optional().isString().withMessage('Subject must be a string'),
  body('body').isString().notEmpty().withMessage('Template body is required'),
  body('variables').isArray().withMessage('Variables must be an array'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean'),
  validateRequest,
  async (req, res) => {
    try {
      const templateData = {
        ...req.body,
        variables: JSON.stringify(req.body.variables),
        is_active: req.body.is_active !== false // Default to true
      };

      const templateId = await automationService['sheetsService'].create('Notification_Templates', templateData);

      res.status(201).json({
        success: true,
        data: {
          template_id: templateId,
          ...req.body
        },
        message: 'Notification template created successfully'
      });
    } catch (error) {
      console.error('Error creating notification template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Service control endpoints
router.post('/service/start',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      await automationService.start();
      
      res.json({
        success: true,
        message: 'Automation service started successfully'
      });
    } catch (error) {
      console.error('Error starting automation service:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start automation service',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

router.post('/service/stop',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      await automationService.stop();
      
      res.json({
        success: true,
        message: 'Automation service stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping automation service:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop automation service',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;