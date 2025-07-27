import request from 'supertest';
import express from 'express';
import automationRoutes from '../automation';
import { AutomationService } from '../../services/automation';
import { authenticateToken, requireRole } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/automation');
jest.mock('../../middleware/auth');

const MockedAutomationService = AutomationService as jest.MockedClass<typeof AutomationService>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockRequireRole = requireRole as jest.MockedFunction<typeof requireRole>;

describe('Automation Routes', () => {
  let app: express.Application;
  let mockAutomationService: jest.Mocked<AutomationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      req.user = {
        id: 'user_123',
        email: 'admin@example.com',
        role: 'admin',
        name: 'Admin User'
      };
      next();
    });

    mockRequireRole.mockImplementation(() => (req: any, res: any, next: any) => next());

    // Mock automation service
    mockAutomationService = {
      scheduleProjectDeadlineReminder: jest.fn(),
      scheduleInvoicePaymentReminder: jest.fn(),
      scheduleTaskDueReminder: jest.fn(),
      scheduleClientFollowup: jest.fn(),
      convertProposalToInvoice: jest.fn(),
      createAutomationRule: jest.fn(),
      updateAutomationRule: jest.fn(),
      scheduleRecurringTask: jest.fn(),
      sendNotification: jest.fn(),
      executeWorkflowTrigger: jest.fn(),
      getAutomationAnalytics: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      sheetsService: {
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    } as any;

    MockedAutomationService.getInstance = jest.fn().mockReturnValue(mockAutomationService);

    app.use('/api/automation', automationRoutes);
  });

  describe('POST /api/automation/reminders/project-deadline/:projectId', () => {
    it('should schedule project deadline reminder successfully', async () => {
      const projectId = 'proj_123';
      const reminderConfig = {
        days_before: 3,
        template: 'project_deadline_reminder',
        method: 'email',
        priority: 'high'
      };

      mockAutomationService.scheduleProjectDeadlineReminder.mockResolvedValue('schedule_123');

      const response = await request(app)
        .post(`/api/automation/reminders/project-deadline/${projectId}`)
        .send(reminderConfig);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule_id).toBe('schedule_123');
      expect(response.body.data.project_id).toBe(projectId);
      expect(mockAutomationService.scheduleProjectDeadlineReminder).toHaveBeenCalledWith(
        projectId,
        reminderConfig
      );
    });

    it('should return 400 for invalid reminder config', async () => {
      const projectId = 'proj_123';
      const invalidConfig = {
        days_before: -1, // Invalid negative value
        template: '', // Empty template
        method: 'invalid', // Invalid method
        priority: 'urgent' // Invalid priority
      };

      const response = await request(app)
        .post(`/api/automation/reminders/project-deadline/${projectId}`)
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle service errors', async () => {
      const projectId = 'proj_123';
      const reminderConfig = {
        days_before: 3,
        template: 'project_deadline_reminder',
        method: 'email',
        priority: 'high'
      };

      mockAutomationService.scheduleProjectDeadlineReminder.mockRejectedValue(
        new Error('Project not found')
      );

      const response = await request(app)
        .post(`/api/automation/reminders/project-deadline/${projectId}`)
        .send(reminderConfig);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to schedule project deadline reminder');
    });
  });

  describe('POST /api/automation/reminders/invoice-payment/:invoiceId', () => {
    it('should schedule invoice payment reminder successfully', async () => {
      const invoiceId = 'inv_123';
      const reminderConfig = {
        days_before: 7,
        days_after: 1,
        template: 'invoice_payment_reminder',
        method: 'email',
        priority: 'medium'
      };

      mockAutomationService.scheduleInvoicePaymentReminder.mockResolvedValue('schedule_456');

      const response = await request(app)
        .post(`/api/automation/reminders/invoice-payment/${invoiceId}`)
        .send(reminderConfig);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule_id).toBe('schedule_456');
      expect(response.body.data.invoice_id).toBe(invoiceId);
    });
  });

  describe('POST /api/automation/reminders/task-due/:taskId', () => {
    it('should schedule task due reminder successfully', async () => {
      const taskId = 'task_123';
      const reminderConfig = {
        days_before: 2,
        template: 'task_due_reminder',
        method: 'email',
        priority: 'high'
      };

      mockAutomationService.scheduleTaskDueReminder.mockResolvedValue('schedule_789');

      const response = await request(app)
        .post(`/api/automation/reminders/task-due/${taskId}`)
        .send(reminderConfig);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule_id).toBe('schedule_789');
      expect(response.body.data.task_id).toBe(taskId);
    });
  });

  describe('POST /api/automation/reminders/client-followup', () => {
    it('should schedule client follow-up successfully', async () => {
      const followupData = {
        client_id: 'client_123',
        project_id: 'proj_123',
        milestone_type: 'project_started',
        template: 'client_followup',
        method: 'email',
        priority: 'medium'
      };

      mockAutomationService.scheduleClientFollowup.mockResolvedValue('schedule_followup');

      const response = await request(app)
        .post('/api/automation/reminders/client-followup')
        .send(followupData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule_id).toBe('schedule_followup');
      expect(mockAutomationService.scheduleClientFollowup).toHaveBeenCalledWith(
        followupData.client_id,
        followupData.project_id,
        followupData.milestone_type,
        expect.objectContaining({
          template: followupData.template,
          method: followupData.method,
          priority: followupData.priority
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        client_id: 'client_123',
        // Missing project_id and milestone_type
        template: 'client_followup',
        method: 'email',
        priority: 'medium'
      };

      const response = await request(app)
        .post('/api/automation/reminders/client-followup')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/automation/convert-proposal/:proposalId', () => {
    it('should convert proposal to invoice successfully', async () => {
      const proposalId = 'proposal_123';
      const acceptanceData = {
        client_id: 'client_123',
        client_name: 'Test Client',
        total_amount: 1000,
        create_project: true,
        project_name: 'New Project'
      };

      const conversionResult = {
        invoiceId: 'inv_new_123',
        projectId: 'proj_new_123'
      };

      mockAutomationService.convertProposalToInvoice.mockResolvedValue(conversionResult);

      const response = await request(app)
        .post(`/api/automation/convert-proposal/${proposalId}`)
        .send(acceptanceData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(conversionResult);
      expect(mockAutomationService.convertProposalToInvoice).toHaveBeenCalledWith(
        proposalId,
        acceptanceData
      );
    });

    it('should return 400 for invalid total amount', async () => {
      const proposalId = 'proposal_123';
      const invalidData = {
        client_id: 'client_123',
        total_amount: -100 // Invalid negative amount
      };

      const response = await request(app)
        .post(`/api/automation/convert-proposal/${proposalId}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/automation/rules', () => {
    it('should fetch automation rules successfully', async () => {
      const mockRules = [
        {
          id: 'rule_123',
          name: 'Test Rule',
          trigger: '{"type":"task_completed"}',
          conditions: '[]',
          actions: '[{"type":"send_email"}]',
          is_active: true
        }
      ];

      mockAutomationService.sheetsService.query.mockResolvedValue(mockRules);

      const response = await request(app)
        .get('/api/automation/rules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].trigger).toEqual({ type: 'task_completed' });
      expect(response.body.data[0].conditions).toEqual([]);
      expect(response.body.data[0].actions).toEqual([{ type: 'send_email' }]);
    });

    it('should filter rules by is_active parameter', async () => {
      mockAutomationService.sheetsService.query.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/automation/rules?is_active=true');

      expect(response.status).toBe(200);
      expect(mockAutomationService.sheetsService.query).toHaveBeenCalledWith(
        'Automation_Rules',
        { is_active: true }
      );
    });
  });

  describe('POST /api/automation/rules', () => {
    it('should create automation rule successfully', async () => {
      const ruleData = {
        name: 'New Rule',
        description: 'Test automation rule',
        trigger: {
          type: 'task_completed',
          config: {}
        },
        conditions: [],
        actions: [{
          type: 'send_email',
          config: { template: 'test_template', recipient: 'test@example.com' }
        }],
        is_active: true
      };

      mockAutomationService.createAutomationRule.mockResolvedValue('rule_new_123');

      const response = await request(app)
        .post('/api/automation/rules')
        .send(ruleData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_id).toBe('rule_new_123');
      expect(mockAutomationService.createAutomationRule).toHaveBeenCalledWith(ruleData);
    });

    it('should return 400 for invalid rule data', async () => {
      const invalidRuleData = {
        name: '', // Empty name
        trigger: 'invalid', // Should be object
        actions: 'invalid' // Should be array
      };

      const response = await request(app)
        .post('/api/automation/rules')
        .send(invalidRuleData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/automation/rules/:ruleId', () => {
    it('should update automation rule successfully', async () => {
      const ruleId = 'rule_123';
      const updates = {
        name: 'Updated Rule',
        is_active: false
      };

      mockAutomationService.updateAutomationRule.mockResolvedValue(true);

      const response = await request(app)
        .put(`/api/automation/rules/${ruleId}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rule_id).toBe(ruleId);
      expect(mockAutomationService.updateAutomationRule).toHaveBeenCalledWith(ruleId, updates);
    });

    it('should return 404 for non-existent rule', async () => {
      const ruleId = 'nonexistent_rule';
      const updates = { name: 'Updated Rule' };

      mockAutomationService.updateAutomationRule.mockResolvedValue(false);

      const response = await request(app)
        .put(`/api/automation/rules/${ruleId}`)
        .send(updates);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Automation rule not found');
    });
  });

  describe('DELETE /api/automation/rules/:ruleId', () => {
    it('should delete automation rule successfully', async () => {
      const ruleId = 'rule_123';

      mockAutomationService.sheetsService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/automation/rules/${ruleId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAutomationService.sheetsService.delete).toHaveBeenCalledWith(
        'Automation_Rules',
        ruleId
      );
    });

    it('should return 404 for non-existent rule', async () => {
      const ruleId = 'nonexistent_rule';

      mockAutomationService.sheetsService.delete.mockResolvedValue(false);

      const response = await request(app)
        .delete(`/api/automation/rules/${ruleId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/automation/recurring-tasks', () => {
    it('should schedule recurring tasks successfully', async () => {
      const taskData = {
        title: 'Weekly Report',
        project_id: 'proj_123',
        description: 'Generate weekly report',
        priority: 'medium',
        estimated_hours: 2,
        due_date: '2024-01-01',
        recurring_config: {
          frequency: 'weekly',
          interval: 1,
          max_occurrences: 4
        }
      };

      const taskIds = ['task_1', 'task_2', 'task_3', 'task_4'];
      mockAutomationService.scheduleRecurringTask.mockResolvedValue(taskIds);

      const response = await request(app)
        .post('/api/automation/recurring-tasks')
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.task_ids).toEqual(taskIds);
      expect(response.body.message).toBe('4 recurring tasks scheduled successfully');
    });

    it('should return 400 for invalid recurring config', async () => {
      const invalidTaskData = {
        title: 'Weekly Report',
        project_id: 'proj_123',
        due_date: '2024-01-01',
        recurring_config: {
          frequency: 'invalid', // Invalid frequency
          interval: 0 // Invalid interval
        }
      };

      const response = await request(app)
        .post('/api/automation/recurring-tasks')
        .send(invalidTaskData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/automation/notifications/send', () => {
    it('should send notification successfully', async () => {
      const notificationData = {
        type: 'email',
        recipient: 'test@example.com',
        template_id: 'template_123',
        variables: { name: 'John Doe', amount: 1000 }
      };

      mockAutomationService.sendNotification.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/automation/notifications/send')
        .send(notificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAutomationService.sendNotification).toHaveBeenCalledWith(
        notificationData.type,
        notificationData.recipient,
        notificationData.template_id,
        notificationData.variables
      );
    });

    it('should return 400 when notification fails', async () => {
      const notificationData = {
        type: 'email',
        recipient: 'test@example.com',
        template_id: 'template_123'
      };

      mockAutomationService.sendNotification.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/automation/notifications/send')
        .send(notificationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to send notification');
    });
  });

  describe('POST /api/automation/triggers/:triggerType/:entityId', () => {
    it('should execute workflow trigger successfully', async () => {
      const triggerType = 'task_completed';
      const entityId = 'task_123';
      const triggerData = { completion_date: '2024-01-01' };

      mockAutomationService.executeWorkflowTrigger.mockResolvedValue();

      const response = await request(app)
        .post(`/api/automation/triggers/${triggerType}/${entityId}`)
        .send({ trigger_data: triggerData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAutomationService.executeWorkflowTrigger).toHaveBeenCalledWith(
        triggerType,
        entityId,
        triggerData
      );
    });
  });

  describe('GET /api/automation/analytics', () => {
    it('should fetch automation analytics successfully', async () => {
      const mockAnalytics = {
        total_executions: 100,
        successful_executions: 95,
        failed_executions: 5,
        execution_rate: 95.0,
        most_triggered_rules: [
          { rule_id: 'rule_123', rule_name: 'Email Rule', count: 50 }
        ],
        performance_metrics: {
          avg_execution_time: 1500,
          total_notifications_sent: 80,
          total_reminders_sent: 20
        }
      };

      mockAutomationService.getAutomationAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/automation/analytics?start_date=2024-01-01&end_date=2024-01-31');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(mockAutomationService.getAutomationAnalytics).toHaveBeenCalledWith({
        start: '2024-01-01',
        end: '2024-01-31'
      });
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/automation/analytics?start_date=invalid&end_date=2024-01-31');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/automation/reminders', () => {
    it('should fetch reminders successfully', async () => {
      const mockReminders = [
        {
          id: 'reminder_123',
          type: 'project_deadline',
          entity_id: 'proj_123',
          status: 'pending',
          reminder_config: '{"days_before":3,"template":"test"}'
        }
      ];

      mockAutomationService.sheetsService.query.mockResolvedValue(mockReminders);

      const response = await request(app)
        .get('/api/automation/reminders?type=project_deadline&status=pending');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].reminder_config).toEqual({
        days_before: 3,
        template: 'test'
      });
    });
  });

  describe('DELETE /api/automation/reminders/:reminderId', () => {
    it('should cancel reminder successfully', async () => {
      const reminderId = 'reminder_123';

      mockAutomationService.sheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/automation/reminders/${reminderId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAutomationService.sheetsService.update).toHaveBeenCalledWith(
        'Reminder_Schedules',
        reminderId,
        { status: 'cancelled' }
      );
    });
  });

  describe('GET /api/automation/templates', () => {
    it('should fetch notification templates successfully', async () => {
      const mockTemplates = [
        {
          id: 'template_123',
          name: 'Test Template',
          type: 'email',
          variables: '["name","amount"]',
          is_active: true
        }
      ];

      mockAutomationService.sheetsService.query.mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/automation/templates?type=email&is_active=true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].variables).toEqual(['name', 'amount']);
    });
  });

  describe('POST /api/automation/templates', () => {
    it('should create notification template successfully', async () => {
      const templateData = {
        name: 'New Template',
        type: 'email',
        subject: 'Test Subject',
        body: 'Test body with {{variable}}',
        variables: ['variable'],
        is_active: true
      };

      mockAutomationService.sheetsService.create.mockResolvedValue('template_new_123');

      const response = await request(app)
        .post('/api/automation/templates')
        .send(templateData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.template_id).toBe('template_new_123');
    });
  });

  describe('Service Control', () => {
    describe('POST /api/automation/service/start', () => {
      it('should start automation service successfully', async () => {
        mockAutomationService.start.mockResolvedValue();

        const response = await request(app)
          .post('/api/automation/service/start');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockAutomationService.start).toHaveBeenCalled();
      });
    });

    describe('POST /api/automation/service/stop', () => {
      it('should stop automation service successfully', async () => {
        mockAutomationService.stop.mockResolvedValue();

        const response = await request(app)
          .post('/api/automation/service/stop');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(mockAutomationService.stop).toHaveBeenCalled();
      });
    });
  });
});