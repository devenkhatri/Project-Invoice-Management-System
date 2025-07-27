import { AutomationService } from '../automation';
import { SheetsService } from '../sheets.service';
import { ProjectStatus, TaskStatus, InvoiceStatus, TaskPriority } from '../../types';

// Mock SheetsService
jest.mock('../sheets.service');
const MockedSheetsService = SheetsService as jest.MockedClass<typeof SheetsService>;

describe('AutomationService', () => {
  let automationService: AutomationService;
  let mockSheetsService: jest.Mocked<SheetsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instance
    mockSheetsService = {
      create: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      aggregate: jest.fn(),
      initializeSheets: jest.fn(),
    } as any;

    // Mock getInstance to return our mock
    MockedSheetsService.getInstance = jest.fn().mockReturnValue(mockSheetsService);
    
    automationService = new AutomationService();
  });

  afterEach(async () => {
    await automationService.stop();
  });

  describe('Project Deadline Reminders', () => {
    it('should schedule project deadline reminder successfully', async () => {
      const projectId = 'proj_123';
      const reminderConfig = {
        days_before: 3,
        template: 'project_deadline_reminder',
        method: 'email' as const,
        priority: 'high' as const
      };

      // Mock project data
      mockSheetsService.query.mockResolvedValueOnce([{
        id: projectId,
        name: 'Test Project',
        client_id: 'client_123',
        end_date: '2024-12-31',
        status: ProjectStatus.ACTIVE
      }]);

      // Mock schedule creation
      mockSheetsService.create.mockResolvedValueOnce('schedule_123');

      const scheduleId = await automationService.scheduleProjectDeadlineReminder(
        projectId,
        reminderConfig
      );

      expect(scheduleId).toBe('schedule_123');
      expect(mockSheetsService.query).toHaveBeenCalledWith('Projects', { id: projectId });
      expect(mockSheetsService.create).toHaveBeenCalledWith('Reminder_Schedules', 
        expect.objectContaining({
          type: 'project_deadline',
          entity_id: projectId,
          status: 'pending'
        })
      );
    });

    it('should throw error for non-existent project', async () => {
      const projectId = 'nonexistent_proj';
      const reminderConfig = {
        days_before: 3,
        template: 'project_deadline_reminder',
        method: 'email' as const,
        priority: 'high' as const
      };

      mockSheetsService.query.mockResolvedValueOnce([]);

      await expect(
        automationService.scheduleProjectDeadlineReminder(projectId, reminderConfig)
      ).rejects.toThrow('Project not found: nonexistent_proj');
    });
  });

  describe('Invoice Payment Reminders', () => {
    it('should schedule invoice payment reminder successfully', async () => {
      const invoiceId = 'inv_123';
      const reminderConfig = {
        days_before: 7,
        days_after: 1,
        template: 'invoice_payment_reminder',
        method: 'email' as const,
        priority: 'medium' as const
      };

      // Mock invoice data
      mockSheetsService.query.mockResolvedValueOnce([{
        id: invoiceId,
        invoice_number: 'INV-001',
        client_id: 'client_123',
        due_date: '2024-12-31',
        total_amount: 1000,
        status: InvoiceStatus.SENT
      }]);

      // Mock schedule creation
      mockSheetsService.create.mockResolvedValueOnce('schedule_456');

      const scheduleId = await automationService.scheduleInvoicePaymentReminder(
        invoiceId,
        reminderConfig
      );

      expect(scheduleId).toBe('schedule_456');
      expect(mockSheetsService.query).toHaveBeenCalledWith('Invoices', { id: invoiceId });
      expect(mockSheetsService.create).toHaveBeenCalledWith('Reminder_Schedules',
        expect.objectContaining({
          type: 'invoice_payment',
          entity_id: invoiceId,
          status: 'pending'
        })
      );
    });
  });

  describe('Task Due Reminders', () => {
    it('should schedule task due reminder with priority adjustment', async () => {
      const taskId = 'task_123';
      const reminderConfig = {
        days_before: 2,
        template: 'task_due_reminder',
        method: 'email' as const,
        priority: 'medium' as const
      };

      // Mock task data with high priority
      mockSheetsService.query.mockResolvedValueOnce([{
        id: taskId,
        title: 'Important Task',
        project_id: 'proj_123',
        due_date: '2024-12-31',
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS
      }]);

      // Mock schedule creation
      mockSheetsService.create.mockResolvedValueOnce('schedule_789');

      const scheduleId = await automationService.scheduleTaskDueReminder(
        taskId,
        reminderConfig
      );

      expect(scheduleId).toBe('schedule_789');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Reminder_Schedules',
        expect.objectContaining({
          type: 'task_due',
          entity_id: taskId,
          reminder_config: expect.stringContaining('"priority":"high"')
        })
      );
    });
  });

  describe('Client Follow-up Automation', () => {
    it('should schedule client follow-up successfully', async () => {
      const clientId = 'client_123';
      const projectId = 'proj_123';
      const milestoneType = 'project_started';
      const reminderConfig = {
        template: 'client_followup',
        method: 'email' as const,
        priority: 'medium' as const
      };

      // Mock schedule creation
      mockSheetsService.create.mockResolvedValueOnce('schedule_followup');

      const scheduleId = await automationService.scheduleClientFollowup(
        clientId,
        projectId,
        milestoneType,
        reminderConfig
      );

      expect(scheduleId).toBe('schedule_followup');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Reminder_Schedules',
        expect.objectContaining({
          type: 'client_followup',
          entity_id: `${clientId}:${projectId}:${milestoneType}`,
          status: 'pending'
        })
      );
    });
  });

  describe('Workflow Triggers', () => {
    it('should execute task completion trigger', async () => {
      const taskId = 'task_123';
      
      // Mock task data
      mockSheetsService.query.mockResolvedValueOnce([{
        id: taskId,
        title: 'Completed Task',
        project_id: 'proj_123',
        status: TaskStatus.COMPLETED
      }]);

      // Mock automation rules
      mockSheetsService.query.mockResolvedValueOnce([{
        id: 'rule_123',
        name: 'Task Completion Rule',
        trigger: JSON.stringify({ type: 'task_completed' }),
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{
          type: 'send_email',
          config: { template: 'task_completed', recipient: 'admin@example.com' }
        }]),
        is_active: true
      }]);

      // Mock workflow execution creation
      mockSheetsService.create.mockResolvedValueOnce('execution_123');

      await automationService.onTaskCompleted(taskId);

      expect(mockSheetsService.query).toHaveBeenCalledWith('Tasks', { id: taskId });
      expect(mockSheetsService.query).toHaveBeenCalledWith('Automation_Rules', { is_active: true });
    });

    it('should execute payment received trigger', async () => {
      const invoiceId = 'inv_123';
      const paymentAmount = 1000;
      const paymentData = { method: 'stripe', transaction_id: 'txn_123' };

      // Mock automation rules
      mockSheetsService.query.mockResolvedValueOnce([{
        id: 'rule_payment',
        name: 'Payment Received Rule',
        trigger: JSON.stringify({ type: 'payment_received' }),
        conditions: JSON.stringify([]),
        actions: JSON.stringify([{
          type: 'send_email',
          config: { template: 'payment_thank_you', recipient: 'client@example.com' }
        }]),
        is_active: true
      }]);

      // Mock pending reminders to cancel
      mockSheetsService.query.mockResolvedValueOnce([{
        id: 'reminder_123',
        type: 'invoice_payment',
        entity_id: invoiceId,
        status: 'pending'
      }]);

      // Mock workflow execution creation
      mockSheetsService.create.mockResolvedValueOnce('execution_payment');

      await automationService.onPaymentReceived(invoiceId, paymentAmount, paymentData);

      expect(mockSheetsService.query).toHaveBeenCalledWith('Automation_Rules', { is_active: true });
      expect(mockSheetsService.query).toHaveBeenCalledWith('Reminder_Schedules', {
        type: 'invoice_payment',
        entity_id: invoiceId,
        status: 'pending'
      });
    });
  });

  describe('Proposal to Invoice Conversion', () => {
    it('should convert proposal to invoice successfully', async () => {
      const proposalId = 'proposal_123';
      const acceptanceData = {
        client_id: 'client_123',
        client_name: 'Test Client',
        line_items: [{ description: 'Service', quantity: 1, unit_price: 1000 }],
        subtotal: 1000,
        total_amount: 1180,
        currency: 'INR',
        payment_terms: 'Net 30',
        create_project: true,
        project_name: 'New Project',
        project_end_date: '2024-12-31'
      };

      // Mock invoice creation
      mockSheetsService.create
        .mockResolvedValueOnce('inv_new_123') // Invoice creation
        .mockResolvedValueOnce('proj_new_123'); // Project creation

      const result = await automationService.convertProposalToInvoice(
        proposalId,
        acceptanceData
      );

      expect(result.invoiceId).toBe('inv_new_123');
      expect(result.projectId).toBe('proj_new_123');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Invoices',
        expect.objectContaining({
          client_id: acceptanceData.client_id,
          total_amount: acceptanceData.total_amount,
          status: InvoiceStatus.DRAFT
        })
      );
      expect(mockSheetsService.create).toHaveBeenCalledWith('Projects',
        expect.objectContaining({
          name: acceptanceData.project_name,
          client_id: acceptanceData.client_id,
          status: ProjectStatus.ACTIVE
        })
      );
    });

    it('should convert proposal to invoice without creating project', async () => {
      const proposalId = 'proposal_456';
      const acceptanceData = {
        client_id: 'client_123',
        total_amount: 500,
        create_project: false
      };

      // Mock invoice creation only
      mockSheetsService.create.mockResolvedValueOnce('inv_simple_123');

      const result = await automationService.convertProposalToInvoice(
        proposalId,
        acceptanceData
      );

      expect(result.invoiceId).toBe('inv_simple_123');
      expect(result.projectId).toBeUndefined();
      expect(mockSheetsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Automation Rules Management', () => {
    it('should create automation rule successfully', async () => {
      const ruleData = {
        name: 'Test Rule',
        description: 'Test automation rule',
        trigger: {
          type: 'task_completed' as const,
          config: {}
        },
        conditions: [],
        actions: [{
          type: 'send_email' as const,
          config: { template: 'test_template', recipient: 'test@example.com' }
        }],
        is_active: true
      };

      mockSheetsService.create.mockResolvedValueOnce('rule_new_123');

      const ruleId = await automationService.createAutomationRule(ruleData);

      expect(ruleId).toBe('rule_new_123');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Automation_Rules',
        expect.objectContaining({
          name: ruleData.name,
          description: ruleData.description,
          trigger: JSON.stringify(ruleData.trigger),
          conditions: JSON.stringify(ruleData.conditions),
          actions: JSON.stringify(ruleData.actions),
          is_active: true
        })
      );
    });

    it('should update automation rule successfully', async () => {
      const ruleId = 'rule_123';
      const updates = {
        name: 'Updated Rule',
        is_active: false,
        actions: [{
          type: 'send_sms' as const,
          config: { template: 'sms_template', recipient: '+1234567890' }
        }]
      };

      mockSheetsService.update.mockResolvedValueOnce(true);

      const success = await automationService.updateAutomationRule(ruleId, updates);

      expect(success).toBe(true);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Automation_Rules', ruleId,
        expect.objectContaining({
          name: updates.name,
          is_active: updates.is_active,
          actions: JSON.stringify(updates.actions)
        })
      );
    });
  });

  describe('Recurring Tasks', () => {
    it('should schedule recurring tasks successfully', async () => {
      const taskData = {
        title: 'Weekly Report',
        project_id: 'proj_123',
        description: 'Generate weekly report',
        priority: TaskPriority.MEDIUM,
        estimated_hours: 2,
        due_date: '2024-01-01'
      };

      const recurringConfig = {
        frequency: 'weekly' as const,
        interval: 1,
        max_occurrences: 4
      };

      // Mock task creation for each occurrence
      mockSheetsService.create
        .mockResolvedValueOnce('task_rec_1')
        .mockResolvedValueOnce('task_rec_2')
        .mockResolvedValueOnce('task_rec_3')
        .mockResolvedValueOnce('task_rec_4');

      const taskIds = await automationService.scheduleRecurringTask(taskData, recurringConfig);

      expect(taskIds).toHaveLength(4);
      expect(taskIds).toEqual(['task_rec_1', 'task_rec_2', 'task_rec_3', 'task_rec_4']);
      expect(mockSheetsService.create).toHaveBeenCalledTimes(4);
    });

    it('should handle monthly recurring tasks', async () => {
      const taskData = {
        title: 'Monthly Invoice Review',
        project_id: 'proj_123',
        due_date: '2024-01-31'
      };

      const recurringConfig = {
        frequency: 'monthly' as const,
        interval: 1,
        max_occurrences: 3
      };

      mockSheetsService.create
        .mockResolvedValueOnce('task_monthly_1')
        .mockResolvedValueOnce('task_monthly_2')
        .mockResolvedValueOnce('task_monthly_3');

      const taskIds = await automationService.scheduleRecurringTask(taskData, recurringConfig);

      expect(taskIds).toHaveLength(3);
      expect(mockSheetsService.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Notification System', () => {
    it('should send email notification successfully', async () => {
      const templateId = 'template_123';
      const recipient = 'test@example.com';
      const variables = { name: 'John Doe', amount: 1000 };

      // Mock template data
      mockSheetsService.query.mockResolvedValueOnce([{
        id: templateId,
        name: 'Test Template',
        type: 'email',
        subject: 'Hello {{name}}',
        body: 'Your amount is ${{amount}}',
        is_active: true
      }]);

      // Mock the private email sending method by spying on console.log
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const success = await automationService.sendNotification(
        'email',
        recipient,
        templateId,
        variables
      );

      expect(success).toBe(true);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Notification_Templates', {
        id: templateId,
        is_active: true
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Sending email to ${recipient}`)
      );

      consoleSpy.mockRestore();
    });

    it('should handle template not found', async () => {
      const templateId = 'nonexistent_template';
      const recipient = 'test@example.com';
      const variables = {};

      mockSheetsService.query.mockResolvedValueOnce([]);

      const success = await automationService.sendNotification(
        'email',
        recipient,
        templateId,
        variables
      );

      expect(success).toBe(false);
    });
  });

  describe('Analytics and Performance Tracking', () => {
    it('should generate automation analytics successfully', async () => {
      const dateRange = { start: '2024-01-01', end: '2024-01-31' };

      // Mock logs data
      mockSheetsService.query
        .mockResolvedValueOnce([
          { action: 'email_sent', status: 'success', timestamp: '2024-01-15T10:00:00Z' },
          { action: 'reminder_sent', status: 'success', timestamp: '2024-01-20T10:00:00Z' },
          { action: 'notification_failed', status: 'error', timestamp: '2024-01-25T10:00:00Z' }
        ])
        .mockResolvedValueOnce([
          { 
            id: 'exec_1', 
            rule_id: 'rule_123', 
            status: 'completed', 
            started_at: '2024-01-15T10:00:00Z',
            completed_at: '2024-01-15T10:01:00Z'
          },
          { 
            id: 'exec_2', 
            rule_id: 'rule_123', 
            status: 'completed', 
            started_at: '2024-01-20T10:00:00Z',
            completed_at: '2024-01-20T10:02:00Z'
          },
          { 
            id: 'exec_3', 
            rule_id: 'rule_456', 
            status: 'failed', 
            started_at: '2024-01-25T10:00:00Z'
          }
        ])
        .mockResolvedValueOnce([
          { id: 'rule_123', name: 'Email Rule' },
          { id: 'rule_456', name: 'SMS Rule' }
        ]);

      const analytics = await automationService.getAutomationAnalytics(dateRange);

      expect(analytics.total_executions).toBe(3);
      expect(analytics.successful_executions).toBe(2);
      expect(analytics.failed_executions).toBe(1);
      expect(analytics.execution_rate).toBe(66.67);
      expect(analytics.most_triggered_rules).toHaveLength(2);
      expect(analytics.most_triggered_rules[0]).toEqual({
        rule_id: 'rule_123',
        rule_name: 'Email Rule',
        count: 2
      });
      expect(analytics.performance_metrics.avg_execution_time).toBeGreaterThan(0);
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop service correctly', async () => {
      // Mock existing reminders
      mockSheetsService.query.mockResolvedValueOnce([]);

      const startSpy = jest.spyOn(automationService, 'emit');
      const stopSpy = jest.spyOn(automationService, 'emit');

      await automationService.start();
      expect(startSpy).toHaveBeenCalledWith('service_started');

      await automationService.stop();
      expect(stopSpy).toHaveBeenCalledWith('service_stopped');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in workflow execution gracefully', async () => {
      const taskId = 'task_error';
      
      // Mock task data
      mockSheetsService.query.mockResolvedValueOnce([{
        id: taskId,
        title: 'Error Task',
        project_id: 'proj_123'
      }]);

      // Mock error in automation rules query
      mockSheetsService.query.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw error
      await expect(automationService.onTaskCompleted(taskId)).resolves.not.toThrow();
    });

    it('should log errors appropriately', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const taskId = 'task_error';
      mockSheetsService.query.mockRejectedValueOnce(new Error('Test error'));

      await automationService.onTaskCompleted(taskId);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to execute workflow trigger:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});