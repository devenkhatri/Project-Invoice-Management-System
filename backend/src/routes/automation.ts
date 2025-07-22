import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { automationService, WorkflowTriggerType, WorkflowActionType } from '../services/automation';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/automation/workflow-rules
 * @desc    Get all workflow rules
 * @access  Private
 */
router.get('/workflow-rules', authenticateToken, async (req, res) => {
  try {
    const rules = await automationService.getWorkflowRules();
    res.json(rules);
  } catch (error) {
    console.error('Error getting workflow rules:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/automation/workflow-rules/:id
 * @desc    Get a workflow rule by ID
 * @access  Private
 */
router.get('/workflow-rules/:id', 
  authenticateToken,
  param('id').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const rules = await automationService.getWorkflowRules();
      const rule = rules.find(r => r.id === req.params.id);
      
      if (!rule) {
        return res.status(404).json({ message: 'Workflow rule not found' });
      }
      
      res.json(rule);
    } catch (error) {
      console.error(`Error getting workflow rule ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/automation/workflow-rules
 * @desc    Create a new workflow rule
 * @access  Private
 */
router.post('/workflow-rules',
  authenticateToken,
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('description').optional().isString(),
  body('is_active').isBoolean(),
  body('trigger.type').isIn(Object.values(WorkflowTriggerType)).withMessage('Invalid trigger type'),
  body('trigger.conditions').isObject(),
  body('actions').isArray().withMessage('Actions must be an array'),
  body('actions.*.type').isIn(Object.values(WorkflowActionType)).withMessage('Invalid action type'),
  body('actions.*.parameters').isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const newRule = await automationService.createWorkflowRule(req.body);
      res.status(201).json(newRule);
    } catch (error) {
      console.error('Error creating workflow rule:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   PUT /api/automation/workflow-rules/:id
 * @desc    Update a workflow rule
 * @access  Private
 */
router.put('/workflow-rules/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('name').optional().isString().notEmpty(),
  body('description').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('trigger.type').optional().isIn(Object.values(WorkflowTriggerType)),
  body('trigger.conditions').optional().isObject(),
  body('actions').optional().isArray(),
  body('actions.*.type').optional().isIn(Object.values(WorkflowActionType)),
  body('actions.*.parameters').optional().isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const updatedRule = await automationService.updateWorkflowRule(req.params.id, req.body);
      res.json(updatedRule);
    } catch (error) {
      console.error(`Error updating workflow rule ${req.params.id}:`, error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ message: 'Workflow rule not found' });
      }
      
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   DELETE /api/automation/workflow-rules/:id
 * @desc    Delete a workflow rule
 * @access  Private
 */
router.delete('/workflow-rules/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const deleted = await automationService.deleteWorkflowRule(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Workflow rule not found' });
      }
      
      res.json({ message: 'Workflow rule deleted successfully' });
    } catch (error) {
      console.error(`Error deleting workflow rule ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/automation/check-deadlines
 * @desc    Manually trigger deadline check
 * @access  Private
 */
router.post('/check-deadlines',
  authenticateToken,
  async (req, res) => {
    try {
      const results = await automationService.checkDeadlines();
      res.json({
        message: 'Deadline check completed',
        results
      });
    } catch (error) {
      console.error('Error checking deadlines:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/automation/task-status-change
 * @desc    Manually trigger task status change workflow
 * @access  Private
 */
router.post('/task-status-change',
  authenticateToken,
  body('taskId').isString().notEmpty(),
  body('oldStatus').isString().notEmpty(),
  body('newStatus').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { taskId, oldStatus, newStatus } = req.body;
      await automationService.processTaskStatusChange(taskId, oldStatus, newStatus);
      res.json({ message: 'Task status change processed successfully' });
    } catch (error) {
      console.error('Error processing task status change:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/automation/invoice-status-change
 * @desc    Manually trigger invoice status change workflow
 * @access  Private
 */
router.post('/invoice-status-change',
  authenticateToken,
  body('invoiceId').isString().notEmpty(),
  body('oldStatus').isString().notEmpty(),
  body('newStatus').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { invoiceId, oldStatus, newStatus } = req.body;
      await automationService.processInvoiceStatusChange(invoiceId, oldStatus, newStatus);
      res.json({ message: 'Invoice status change processed successfully' });
    } catch (error) {
      console.error('Error processing invoice status change:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   POST /api/automation/proposal-acceptance
 * @desc    Manually trigger proposal acceptance workflow
 * @access  Private
 */
router.post('/proposal-acceptance',
  authenticateToken,
  body('proposalId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { proposalId } = req.body;
      await automationService.processProposalAcceptance(proposalId);
      res.json({ message: 'Proposal acceptance processed successfully' });
    } catch (error) {
      console.error('Error processing proposal acceptance:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   GET /api/automation/notifications
 * @desc    Get notifications for the current user
 * @access  Private
 */
router.get('/notifications',
  authenticateToken,
  query('limit').optional().isInt({ min: 1 }),
  query('unreadOnly').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const unreadOnly = req.query.unreadOnly === 'true';
      
      const notifications = await automationService.getNotifications(userId, { limit, unreadOnly });
      res.json(notifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   PUT /api/automation/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/notifications/:id/read',
  authenticateToken,
  param('id').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const success = await automationService.markNotificationAsRead(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: 'Notification not found' });
      }
      
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error(`Error marking notification ${req.params.id} as read:`, error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @route   PUT /api/automation/notifications/read-all
 * @desc    Mark all notifications as read for the current user
 * @access  Private
 */
router.put('/notifications/read-all',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await automationService.markAllNotificationsAsRead(userId);
      res.json({ message: `${count} notifications marked as read` });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;