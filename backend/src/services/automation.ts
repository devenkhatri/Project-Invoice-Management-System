import { SheetsService } from './sheets.service';
import { 
  Project, 
  Task, 
  Invoice, 
  Client,
  ProjectStatus,
  TaskStatus,
  InvoiceStatus,
  TaskPriority
} from '../types';
import { EventEmitter } from 'events';

// Automation types
export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationTrigger {
  type: 'project_deadline' | 'invoice_due' | 'task_due' | 'task_completed' | 
        'project_milestone' | 'payment_received' | 'invoice_overdue' | 
        'proposal_accepted' | 'time_based';
  config: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface AutomationAction {
  type: 'send_email' | 'send_sms' | 'create_task' | 'update_status' | 
        'generate_invoice' | 'apply_late_fee' | 'send_notification' | 
        'webhook' | 'create_project';
  config: Record<string, any>;
}

export interface ReminderSchedule {
  id: string;
  type: 'project_deadline' | 'invoice_payment' | 'task_due' | 'client_followup';
  entity_id: string;
  scheduled_at: string;
  reminder_config: ReminderConfig;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  last_attempt_at?: string;
  created_at: string;
}

export interface ReminderConfig {
  days_before?: number;
  days_after?: number;
  escalation_rules?: EscalationRule[];
  template: string;
  method: 'email' | 'sms' | 'both';
  priority: 'low' | 'medium' | 'high';
}

export interface EscalationRule {
  days_offset: number;
  template: string;
  method: 'email' | 'sms' | 'both';
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms';
  subject?: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  rule_id: string;
  trigger_data: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  actions_executed: string[];
}

export class AutomationService extends EventEmitter {
  private static instance: AutomationService;
  public sheetsService: SheetsService;
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    super();
    this.sheetsService = SheetsService.getInstance();
    this.initializeAutomationSheets();
  }

  public static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  private async initializeAutomationSheets(): Promise<void> {
    try {
      // Add automation-specific sheets to the sheets service
      const automationSheets = [
        {
          name: 'Automation_Rules',
          headers: ['id', 'name', 'description', 'trigger', 'conditions', 'actions', 'is_active', 'created_at', 'updated_at']
        },
        {
          name: 'Reminder_Schedules',
          headers: ['id', 'type', 'entity_id', 'scheduled_at', 'reminder_config', 'status', 'attempts', 'last_attempt_at', 'created_at']
        },
        {
          name: 'Notification_Templates',
          headers: ['id', 'name', 'type', 'subject', 'body', 'variables', 'is_active', 'created_at', 'updated_at']
        },
        {
          name: 'Workflow_Executions',
          headers: ['id', 'rule_id', 'trigger_data', 'status', 'started_at', 'completed_at', 'error_message', 'actions_executed']
        },
        {
          name: 'Automation_Logs',
          headers: ['id', 'type', 'entity_id', 'action', 'status', 'details', 'timestamp']
        }
      ];

      // Check if sheets exist, but don't fail if they don't
      for (const sheet of automationSheets) {
        try {
          await this.sheetsService.read(sheet.name);
        } catch (error) {
          console.log(`Automation sheet '${sheet.name}' not found, it will be created when sheets are initialized`);
          // Don't fail here, just log that the sheet doesn't exist
        }
      }

      // Initialize default templates and rules only if sheets exist
      try {
        await this.initializeDefaultTemplates();
        await this.initializeDefaultRules();
      } catch (error) {
        console.log('Skipping default automation setup - sheets not initialized yet');
      }

    } catch (error) {
      console.error('Failed to initialize automation sheets:', error);
    }
  }

  // Start the automation service
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('Starting Automation Service...');

    // Load and schedule existing reminders
    await this.loadScheduledReminders();

    // Start periodic checks
    this.startPeriodicChecks();

    this.emit('service_started');
  }

  // Stop the automation service
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    console.log('Stopping Automation Service...');

    // Clear all scheduled jobs
    this.scheduledJobs.forEach((timeout, id) => {
      clearTimeout(timeout);
    });
    this.scheduledJobs.clear();

    this.emit('service_stopped');
  }

  // Project deadline reminders
  async scheduleProjectDeadlineReminder(
    projectId: string, 
    reminderConfig: ReminderConfig
  ): Promise<string> {
    try {
      const projects = await this.sheetsService.query('Projects', { id: projectId });
      if (projects.length === 0) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const project = projects[0] as Project;
      const deadlineDate = new Date(project.end_date);
      
      // Calculate reminder dates
      const reminderDates = this.calculateReminderDates(deadlineDate, reminderConfig);
      
      const scheduleIds: string[] = [];
      
      for (const reminderDate of reminderDates) {
        const scheduleId = await this.sheetsService.create('Reminder_Schedules', {
          type: 'project_deadline',
          entity_id: projectId,
          scheduled_at: reminderDate.toISOString(),
          reminder_config: JSON.stringify(reminderConfig),
          status: 'pending',
          attempts: 0
        });
        
        scheduleIds.push(scheduleId);
        
        // Schedule the reminder
        this.scheduleReminder(scheduleId, reminderDate, async () => {
          await this.executeProjectDeadlineReminder(projectId, reminderConfig);
        });
      }

      await this.logAutomationAction('project_deadline_reminder_scheduled', projectId, 'success', {
        reminder_dates: reminderDates.map(d => d.toISOString()),
        config: reminderConfig
      });

      return scheduleIds[0]; // Return first schedule ID
    } catch (error) {
      await this.logAutomationAction('project_deadline_reminder_scheduled', projectId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Invoice payment reminders
  async scheduleInvoicePaymentReminder(
    invoiceId: string,
    reminderConfig: ReminderConfig
  ): Promise<string> {
    try {
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (invoices.length === 0) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      const invoice = invoices[0] as Invoice;
      const dueDate = new Date(invoice.due_date);
      
      // Calculate reminder dates
      const reminderDates = this.calculateReminderDates(dueDate, reminderConfig);
      
      const scheduleIds: string[] = [];
      
      for (const reminderDate of reminderDates) {
        const scheduleId = await this.sheetsService.create('Reminder_Schedules', {
          type: 'invoice_payment',
          entity_id: invoiceId,
          scheduled_at: reminderDate.toISOString(),
          reminder_config: JSON.stringify(reminderConfig),
          status: 'pending',
          attempts: 0
        });
        
        scheduleIds.push(scheduleId);
        
        // Schedule the reminder
        this.scheduleReminder(scheduleId, reminderDate, async () => {
          await this.executeInvoicePaymentReminder(invoiceId, reminderConfig);
        });
      }

      await this.logAutomationAction('invoice_payment_reminder_scheduled', invoiceId, 'success', {
        reminder_dates: reminderDates.map(d => d.toISOString()),
        config: reminderConfig
      });

      return scheduleIds[0];
    } catch (error) {
      await this.logAutomationAction('invoice_payment_reminder_scheduled', invoiceId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Task due date notifications
  async scheduleTaskDueReminder(
    taskId: string,
    reminderConfig: ReminderConfig
  ): Promise<string> {
    try {
      const tasks = await this.sheetsService.query('Tasks', { id: taskId });
      if (tasks.length === 0) {
        throw new Error(`Task not found: ${taskId}`);
      }

      const task = tasks[0] as Task;
      const dueDate = new Date(task.due_date);
      
      // Calculate reminder dates based on priority
      const priorityConfig = this.adjustConfigForPriority(reminderConfig, task.priority);
      const reminderDates = this.calculateReminderDates(dueDate, priorityConfig);
      
      const scheduleIds: string[] = [];
      
      for (const reminderDate of reminderDates) {
        const scheduleId = await this.sheetsService.create('Reminder_Schedules', {
          type: 'task_due',
          entity_id: taskId,
          scheduled_at: reminderDate.toISOString(),
          reminder_config: JSON.stringify(priorityConfig),
          status: 'pending',
          attempts: 0
        });
        
        scheduleIds.push(scheduleId);
        
        // Schedule the reminder
        this.scheduleReminder(scheduleId, reminderDate, async () => {
          await this.executeTaskDueReminder(taskId, priorityConfig);
        });
      }

      await this.logAutomationAction('task_due_reminder_scheduled', taskId, 'success', {
        reminder_dates: reminderDates.map(d => d.toISOString()),
        config: priorityConfig
      });

      return scheduleIds[0];
    } catch (error) {
      await this.logAutomationAction('task_due_reminder_scheduled', taskId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Client follow-up automation
  async scheduleClientFollowup(
    clientId: string,
    projectId: string,
    milestoneType: string,
    reminderConfig: ReminderConfig
  ): Promise<string> {
    try {
      const scheduleId = await this.sheetsService.create('Reminder_Schedules', {
        type: 'client_followup',
        entity_id: `${clientId}:${projectId}:${milestoneType}`,
        scheduled_at: new Date().toISOString(),
        reminder_config: JSON.stringify(reminderConfig),
        status: 'pending',
        attempts: 0
      });

      // Execute immediately for milestone-based follow-ups
      await this.executeClientFollowup(clientId, projectId, milestoneType, reminderConfig);

      await this.logAutomationAction('client_followup_scheduled', clientId, 'success', {
        project_id: projectId,
        milestone_type: milestoneType,
        config: reminderConfig
      });

      return scheduleId;
    } catch (error) {
      await this.logAutomationAction('client_followup_scheduled', clientId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Workflow triggers and actions
  async executeWorkflowTrigger(
    triggerType: string,
    entityId: string,
    triggerData: Record<string, any>
  ): Promise<void> {
    try {
      // Find matching automation rules
      const rules = await this.sheetsService.query('Automation_Rules', {
        is_active: true
      });

      const matchingRules = rules.filter(rule => {
        const trigger = JSON.parse(rule.trigger);
        return trigger.type === triggerType;
      });

      for (const rule of matchingRules) {
        await this.executeWorkflowRule(rule, entityId, triggerData);
      }
    } catch (error) {
      console.error('Failed to execute workflow trigger:', error);
      await this.logAutomationAction('workflow_trigger_failed', entityId, 'error', {
        trigger_type: triggerType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Task completion triggers
  async onTaskCompleted(taskId: string): Promise<void> {
    try {
      const tasks = await this.sheetsService.query('Tasks', { id: taskId });
      if (tasks.length === 0) return;

      const task = tasks[0] as Task;
      
      // Execute workflow triggers
      await this.executeWorkflowTrigger('task_completed', taskId, {
        task_id: taskId,
        project_id: task.project_id,
        task_title: task.title,
        completion_date: new Date().toISOString()
      });

      // Check if this completes the project
      await this.checkProjectCompletion(task.project_id);

      await this.logAutomationAction('task_completed_trigger', taskId, 'success', {
        project_id: task.project_id
      });
    } catch (error) {
      await this.logAutomationAction('task_completed_trigger', taskId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Project milestone triggers
  async onProjectMilestone(
    projectId: string, 
    milestoneType: string, 
    milestoneData: Record<string, any>
  ): Promise<void> {
    try {
      await this.executeWorkflowTrigger('project_milestone', projectId, {
        project_id: projectId,
        milestone_type: milestoneType,
        milestone_data: milestoneData,
        timestamp: new Date().toISOString()
      });

      await this.logAutomationAction('project_milestone_trigger', projectId, 'success', {
        milestone_type: milestoneType,
        milestone_data: milestoneData
      });
    } catch (error) {
      await this.logAutomationAction('project_milestone_trigger', projectId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Payment received triggers
  async onPaymentReceived(
    invoiceId: string, 
    paymentAmount: number, 
    paymentData: Record<string, any>
  ): Promise<void> {
    try {
      await this.executeWorkflowTrigger('payment_received', invoiceId, {
        invoice_id: invoiceId,
        payment_amount: paymentAmount,
        payment_data: paymentData,
        timestamp: new Date().toISOString()
      });

      // Cancel pending payment reminders
      await this.cancelPendingReminders('invoice_payment', invoiceId);

      await this.logAutomationAction('payment_received_trigger', invoiceId, 'success', {
        payment_amount: paymentAmount
      });
    } catch (error) {
      await this.logAutomationAction('payment_received_trigger', invoiceId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Overdue invoice triggers
  async onInvoiceOverdue(invoiceId: string): Promise<void> {
    try {
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (invoices.length === 0) return;

      const invoice = invoices[0] as Invoice;
      
      await this.executeWorkflowTrigger('invoice_overdue', invoiceId, {
        invoice_id: invoiceId,
        client_id: invoice.client_id,
        amount: invoice.total_amount,
        days_overdue: this.calculateDaysOverdue(invoice.due_date),
        timestamp: new Date().toISOString()
      });

      await this.logAutomationAction('invoice_overdue_trigger', invoiceId, 'success', {
        days_overdue: this.calculateDaysOverdue(invoice.due_date)
      });
    } catch (error) {
      await this.logAutomationAction('invoice_overdue_trigger', invoiceId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Proposal to invoice conversion
  async convertProposalToInvoice(
    proposalId: string,
    acceptanceData: Record<string, any>
  ): Promise<{ invoiceId: string; projectId?: string }> {
    try {
      // This would typically fetch proposal data from a proposals sheet
      // For now, we'll create a basic invoice structure
      
      const invoiceData = {
        client_id: acceptanceData.client_id,
        project_id: acceptanceData.project_id,
        line_items: JSON.stringify(acceptanceData.line_items || []),
        subtotal: acceptanceData.subtotal || 0,
        tax_breakdown: JSON.stringify(acceptanceData.tax_breakdown || {}),
        total_amount: acceptanceData.total_amount || 0,
        currency: acceptanceData.currency || 'INR',
        status: InvoiceStatus.DRAFT,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: this.calculateDueDate(acceptanceData.payment_terms || 'Net 30'),
        payment_terms: acceptanceData.payment_terms || 'Net 30',
        payment_status: 'pending',
        paid_amount: 0,
        is_recurring: false
      };

      const invoiceId = await this.sheetsService.create('Invoices', invoiceData);

      // Create project if specified
      let projectId: string | undefined;
      if (acceptanceData.create_project) {
        const projectData = {
          name: acceptanceData.project_name || `Project for ${acceptanceData.client_name}`,
          client_id: acceptanceData.client_id,
          status: ProjectStatus.ACTIVE,
          start_date: new Date().toISOString().split('T')[0],
          end_date: acceptanceData.project_end_date || this.calculateProjectEndDate(),
          budget: acceptanceData.total_amount || 0,
          description: acceptanceData.project_description || '',
          is_billable: true,
          currency: acceptanceData.currency || 'INR'
        };

        projectId = await this.sheetsService.create('Projects', projectData);
        
        // Update invoice with project ID
        await this.sheetsService.update('Invoices', invoiceId, { project_id: projectId });
      }

      await this.logAutomationAction('proposal_converted', proposalId, 'success', {
        invoice_id: invoiceId,
        project_id: projectId
      });

      return { invoiceId, projectId };
    } catch (error) {
      await this.logAutomationAction('proposal_converted', proposalId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Notification system
  async sendNotification(
    type: 'email' | 'sms' | 'in_app' | 'webhook',
    recipient: string,
    templateId: string,
    variables: Record<string, any>
  ): Promise<boolean> {
    try {
      const templates = await this.sheetsService.query('Notification_Templates', {
        id: templateId,
        is_active: true
      });

      if (templates.length === 0) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const template = templates[0] as NotificationTemplate;
      const content = this.renderTemplate(template.body, variables);
      const subject = template.subject ? this.renderTemplate(template.subject, variables) : undefined;

      switch (type) {
        case 'email':
          return await this.sendEmail(recipient, subject || 'Notification', content);
        case 'sms':
          return await this.sendSMS(recipient, content);
        case 'in_app':
          return await this.sendInAppNotification(recipient, content);
        case 'webhook':
          return await this.sendWebhook(recipient, { subject, content, variables });
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // Workflow rules engine
  async createAutomationRule(ruleData: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const ruleId = await this.sheetsService.create('Automation_Rules', {
        ...ruleData,
        trigger: JSON.stringify(ruleData.trigger),
        conditions: JSON.stringify(ruleData.conditions),
        actions: JSON.stringify(ruleData.actions)
      });

      await this.logAutomationAction('automation_rule_created', ruleId, 'success', ruleData);
      return ruleId;
    } catch (error) {
      await this.logAutomationAction('automation_rule_created', '', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>): Promise<boolean> {
    try {
      const updateData: any = { ...updates };
      
      if (updates.trigger) {
        updateData.trigger = JSON.stringify(updates.trigger);
      }
      if (updates.conditions) {
        updateData.conditions = JSON.stringify(updates.conditions);
      }
      if (updates.actions) {
        updateData.actions = JSON.stringify(updates.actions);
      }

      const success = await this.sheetsService.update('Automation_Rules', ruleId, updateData);
      
      if (success) {
        await this.logAutomationAction('automation_rule_updated', ruleId, 'success', updates);
      }
      
      return success;
    } catch (error) {
      await this.logAutomationAction('automation_rule_updated', ruleId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Scheduling system for recurring tasks and reminders
  async scheduleRecurringTask(
    taskData: Partial<Task>,
    recurringConfig: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      interval: number;
      end_date?: string;
      max_occurrences?: number;
    }
  ): Promise<string[]> {
    try {
      const taskIds: string[] = [];
      const startDate = new Date(taskData.due_date || new Date());
      let currentDate = new Date(startDate);
      let occurrences = 0;

      const maxOccurrences = recurringConfig.max_occurrences || 12;
      const endDate = recurringConfig.end_date ? new Date(recurringConfig.end_date) : null;

      while (occurrences < maxOccurrences) {
        if (endDate && currentDate > endDate) break;

        const taskId = await this.sheetsService.create('Tasks', {
          ...taskData,
          due_date: currentDate.toISOString().split('T')[0],
          title: `${taskData.title} (${occurrences + 1})`
        });

        taskIds.push(taskId);
        occurrences++;

        // Calculate next occurrence
        switch (recurringConfig.frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + recurringConfig.interval);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + (7 * recurringConfig.interval));
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + recurringConfig.interval);
            break;
          case 'quarterly':
            currentDate.setMonth(currentDate.getMonth() + (3 * recurringConfig.interval));
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + recurringConfig.interval);
            break;
        }
      }

      await this.logAutomationAction('recurring_tasks_scheduled', '', 'success', {
        task_ids: taskIds,
        config: recurringConfig
      });

      return taskIds;
    } catch (error) {
      await this.logAutomationAction('recurring_tasks_scheduled', '', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Analytics and performance tracking
  async getAutomationAnalytics(dateRange: { start: string; end: string }): Promise<{
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    execution_rate: number;
    most_triggered_rules: Array<{ rule_id: string; rule_name: string; count: number }>;
    performance_metrics: {
      avg_execution_time: number;
      total_notifications_sent: number;
      total_reminders_sent: number;
    };
  }> {
    try {
      const logs = await this.sheetsService.query('Automation_Logs', {
        timestamp: {
          '>=': dateRange.start,
          '<=': dateRange.end
        }
      });

      const executions = await this.sheetsService.query('Workflow_Executions', {
        started_at: {
          '>=': dateRange.start,
          '<=': dateRange.end
        }
      });

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'completed').length;
      const failedExecutions = executions.filter(e => e.status === 'failed').length;
      const executionRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      // Calculate most triggered rules
      const ruleExecutions = executions.reduce((acc, exec) => {
        acc[exec.rule_id] = (acc[exec.rule_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const rules = await this.sheetsService.read('Automation_Rules');
      const mostTriggeredRules = Object.entries(ruleExecutions)
        .map(([ruleId, count]) => {
          const rule = rules.find(r => r.id === ruleId);
          return {
            rule_id: ruleId,
            rule_name: rule?.name || 'Unknown Rule',
            count: count as number
          };
        })
        .sort((a, b) => (b.count as number) - (a.count as number))
        .slice(0, 10);

      // Calculate performance metrics
      const completedExecutions = executions.filter(e => e.status === 'completed' && e.completed_at);
      const avgExecutionTime = completedExecutions.length > 0
        ? completedExecutions.reduce((sum, exec) => {
            const startTime = new Date(exec.started_at).getTime();
            const endTime = new Date(exec.completed_at!).getTime();
            return sum + (endTime - startTime);
          }, 0) / completedExecutions.length
        : 0;

      const notificationLogs = logs.filter(log => log.action.includes('notification') || log.action.includes('email') || log.action.includes('sms'));
      const reminderLogs = logs.filter(log => log.action.includes('reminder'));

      return {
        total_executions: totalExecutions,
        successful_executions: successfulExecutions,
        failed_executions: failedExecutions,
        execution_rate: Math.round(executionRate * 100) / 100,
        most_triggered_rules: mostTriggeredRules,
        performance_metrics: {
          avg_execution_time: Math.round(avgExecutionTime),
          total_notifications_sent: notificationLogs.filter(log => log.status === 'success').length,
          total_reminders_sent: reminderLogs.filter(log => log.status === 'success').length
        }
      };
    } catch (error) {
      console.error('Failed to get automation analytics:', error);
      throw error;
    }
  }

  // Private helper methods
  private async loadScheduledReminders(): Promise<void> {
    try {
      const pendingReminders = await this.sheetsService.query('Reminder_Schedules', {
        status: 'pending'
      });

      for (const reminder of pendingReminders) {
        const scheduledDate = new Date(reminder.scheduled_at);
        if (scheduledDate > new Date()) {
          this.scheduleReminder(reminder.id, scheduledDate, async () => {
            await this.executeScheduledReminder(reminder);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load scheduled reminders:', error);
    }
  }

  private startPeriodicChecks(): void {
    // Check for overdue invoices every hour
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.checkOverdueInvoices();
    }, 60 * 60 * 1000);

    // Check for approaching deadlines every 6 hours
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.checkApproachingDeadlines();
    }, 6 * 60 * 60 * 1000);

    // Clean up completed executions daily
    setInterval(async () => {
      if (!this.isRunning) return;
      await this.cleanupOldExecutions();
    }, 24 * 60 * 60 * 1000);
  }

  private scheduleReminder(
    reminderId: string,
    scheduledDate: Date,
    callback: () => Promise<void>
  ): void {
    const delay = scheduledDate.getTime() - Date.now();
    
    if (delay > 0) {
      const timeout = setTimeout(async () => {
        try {
          await callback();
          this.scheduledJobs.delete(reminderId);
        } catch (error) {
          console.error(`Failed to execute reminder ${reminderId}:`, error);
        }
      }, delay);
      
      this.scheduledJobs.set(reminderId, timeout);
    }
  }

  private calculateReminderDates(
    targetDate: Date,
    config: ReminderConfig
  ): Date[] {
    const dates: Date[] = [];
    
    // Before target date reminders
    if (config.days_before) {
      const beforeDate = new Date(targetDate);
      beforeDate.setDate(beforeDate.getDate() - config.days_before);
      dates.push(beforeDate);
    }
    
    // After target date reminders (for overdue scenarios)
    if (config.days_after) {
      const afterDate = new Date(targetDate);
      afterDate.setDate(afterDate.getDate() + config.days_after);
      dates.push(afterDate);
    }
    
    // Escalation reminders
    if (config.escalation_rules) {
      for (const rule of config.escalation_rules) {
        const escalationDate = new Date(targetDate);
        escalationDate.setDate(escalationDate.getDate() + rule.days_offset);
        dates.push(escalationDate);
      }
    }
    
    return dates.filter(date => date > new Date()); // Only future dates
  }

  private adjustConfigForPriority(
    config: ReminderConfig,
    priority: TaskPriority
  ): ReminderConfig {
    const adjustedConfig = { ...config };
    
    switch (priority) {
      case TaskPriority.HIGH:
        // More frequent reminders for high priority
        if (adjustedConfig.days_before) {
          adjustedConfig.days_before = Math.max(1, adjustedConfig.days_before - 1);
        }
        adjustedConfig.priority = 'high';
        break;
      case TaskPriority.MEDIUM:
        adjustedConfig.priority = 'medium';
        break;
      case TaskPriority.LOW:
        // Less frequent reminders for low priority
        if (adjustedConfig.days_before) {
          adjustedConfig.days_before = adjustedConfig.days_before + 1;
        }
        adjustedConfig.priority = 'low';
        break;
    }
    
    return adjustedConfig;
  }

  private async executeProjectDeadlineReminder(
    projectId: string,
    config: ReminderConfig
  ): Promise<void> {
    try {
      const projects = await this.sheetsService.query('Projects', { id: projectId });
      if (projects.length === 0) return;

      const project = projects[0] as Project;
      const clients = await this.sheetsService.query('Clients', { id: project.client_id });
      const client = clients[0] as Client;

      const variables = {
        project_name: project.name,
        client_name: client.name,
        deadline: project.end_date,
        days_remaining: this.calculateDaysRemaining(project.end_date)
      };

      await this.sendNotification(config.method as any, client.email, config.template, variables);
      
      await this.logAutomationAction('project_deadline_reminder_sent', projectId, 'success', {
        client_email: client.email,
        days_remaining: variables.days_remaining
      });
    } catch (error) {
      await this.logAutomationAction('project_deadline_reminder_sent', projectId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeInvoicePaymentReminder(
    invoiceId: string,
    config: ReminderConfig
  ): Promise<void> {
    try {
      const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
      if (invoices.length === 0) return;

      const invoice = invoices[0] as Invoice;
      const clients = await this.sheetsService.query('Clients', { id: invoice.client_id });
      const client = clients[0] as Client;

      const variables = {
        invoice_number: invoice.invoice_number,
        client_name: client.name,
        amount: invoice.total_amount,
        due_date: invoice.due_date,
        days_overdue: this.calculateDaysOverdue(invoice.due_date)
      };

      await this.sendNotification(config.method as any, client.email, config.template, variables);
      
      await this.logAutomationAction('invoice_payment_reminder_sent', invoiceId, 'success', {
        client_email: client.email,
        amount: invoice.total_amount
      });
    } catch (error) {
      await this.logAutomationAction('invoice_payment_reminder_sent', invoiceId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeTaskDueReminder(
    taskId: string,
    config: ReminderConfig
  ): Promise<void> {
    try {
      const tasks = await this.sheetsService.query('Tasks', { id: taskId });
      if (tasks.length === 0) return;

      const task = tasks[0] as Task;
      const projects = await this.sheetsService.query('Projects', { id: task.project_id });
      const project = projects[0] as Project;
      const clients = await this.sheetsService.query('Clients', { id: project.client_id });
      const client = clients[0] as Client;

      const variables = {
        task_title: task.title,
        project_name: project.name,
        client_name: client.name,
        due_date: task.due_date,
        priority: task.priority,
        days_remaining: this.calculateDaysRemaining(task.due_date)
      };

      // Send to internal team (assuming admin email)
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      await this.sendNotification(config.method as any, adminEmail, config.template, variables);
      
      await this.logAutomationAction('task_due_reminder_sent', taskId, 'success', {
        task_title: task.title,
        priority: task.priority
      });
    } catch (error) {
      await this.logAutomationAction('task_due_reminder_sent', taskId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeClientFollowup(
    clientId: string,
    projectId: string,
    milestoneType: string,
    config: ReminderConfig
  ): Promise<void> {
    try {
      const clients = await this.sheetsService.query('Clients', { id: clientId });
      const projects = await this.sheetsService.query('Projects', { id: projectId });
      
      if (clients.length === 0 || projects.length === 0) return;

      const client = clients[0] as Client;
      const project = projects[0] as Project;

      const variables = {
        client_name: client.name,
        project_name: project.name,
        milestone_type: milestoneType,
        project_status: project.status,
        completion_percentage: project.progress_percentage || 0
      };

      await this.sendNotification(config.method as any, client.email, config.template, variables);
      
      await this.logAutomationAction('client_followup_sent', clientId, 'success', {
        project_id: projectId,
        milestone_type: milestoneType
      });
    } catch (error) {
      await this.logAutomationAction('client_followup_sent', clientId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeWorkflowRule(
    rule: any,
    entityId: string,
    triggerData: Record<string, any>
  ): Promise<void> {
    try {
      const executionId = await this.sheetsService.create('Workflow_Executions', {
        rule_id: rule.id,
        trigger_data: JSON.stringify(triggerData),
        status: 'running',
        started_at: new Date().toISOString(),
        actions_executed: JSON.stringify([])
      });

      const conditions = JSON.parse(rule.conditions);
      const actions = JSON.parse(rule.actions);

      // Check conditions
      const conditionsMet = await this.evaluateConditions(conditions, entityId, triggerData);
      
      if (!conditionsMet) {
        await this.sheetsService.update('Workflow_Executions', executionId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          error_message: 'Conditions not met'
        });
        return;
      }

      // Execute actions
      const executedActions: string[] = [];
      
      for (const action of actions) {
        try {
          await this.executeWorkflowAction(action, entityId, triggerData);
          executedActions.push(action.type);
        } catch (actionError) {
          console.error(`Failed to execute action ${action.type}:`, actionError);
        }
      }

      await this.sheetsService.update('Workflow_Executions', executionId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        actions_executed: JSON.stringify(executedActions)
      });

    } catch (error) {
      console.error('Failed to execute workflow rule:', error);
    }
  }

  private async evaluateConditions(
    conditions: AutomationCondition[],
    entityId: string,
    triggerData: Record<string, any>
  ): Promise<boolean> {
    // Simple condition evaluation - can be extended
    for (const condition of conditions) {
      const value = triggerData[condition.field];
      
      switch (condition.operator) {
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'ne':
          if (value === condition.value) return false;
          break;
        case 'gt':
          if (value <= condition.value) return false;
          break;
        case 'lt':
          if (value >= condition.value) return false;
          break;
        case 'gte':
          if (value < condition.value) return false;
          break;
        case 'lte':
          if (value > condition.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(String(condition.value))) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
      }
    }
    
    return true;
  }

  private async executeWorkflowAction(
    action: AutomationAction,
    entityId: string,
    triggerData: Record<string, any>
  ): Promise<void> {
    switch (action.type) {
      case 'send_email':
        await this.sendNotification('email', action.config.recipient, action.config.template, triggerData);
        break;
      case 'send_sms':
        await this.sendNotification('sms', action.config.recipient, action.config.template, triggerData);
        break;
      case 'create_task':
        await this.sheetsService.create('Tasks', {
          ...action.config.task_data,
          project_id: triggerData.project_id || entityId
        });
        break;
      case 'update_status':
        await this.sheetsService.update(action.config.entity_type, entityId, {
          status: action.config.new_status
        });
        break;
      case 'generate_invoice':
        // Implementation would depend on invoice generation logic
        break;
      case 'apply_late_fee':
        // Implementation would depend on late fee logic
        break;
      case 'send_notification':
        await this.sendNotification('in_app', action.config.recipient, action.config.template, triggerData);
        break;
      case 'webhook':
        await this.sendWebhook(action.config.url, triggerData);
        break;
    }
  }

  private async checkProjectCompletion(projectId: string): Promise<void> {
    try {
      const tasks = await this.sheetsService.query('Tasks', { project_id: projectId });
      const completedTasks = tasks.filter(task => task.status === TaskStatus.COMPLETED);
      
      if (tasks.length > 0 && completedTasks.length === tasks.length) {
        await this.sheetsService.update('Projects', projectId, {
          status: ProjectStatus.COMPLETED,
          progress_percentage: 100
        });
        
        await this.onProjectMilestone(projectId, 'project_completed', {
          total_tasks: tasks.length,
          completion_date: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to check project completion:', error);
    }
  }

  private async cancelPendingReminders(type: string, entityId: string): Promise<void> {
    try {
      const pendingReminders = await this.sheetsService.query('Reminder_Schedules', {
        type,
        entity_id: entityId,
        status: 'pending'
      });

      for (const reminder of pendingReminders) {
        await this.sheetsService.update('Reminder_Schedules', reminder.id, {
          status: 'cancelled'
        });
        
        // Cancel scheduled job if exists
        if (this.scheduledJobs.has(reminder.id)) {
          clearTimeout(this.scheduledJobs.get(reminder.id)!);
          this.scheduledJobs.delete(reminder.id);
        }
      }
    } catch (error) {
      console.error('Failed to cancel pending reminders:', error);
    }
  }

  private async checkOverdueInvoices(): Promise<void> {
    try {
      const invoices = await this.sheetsService.query('Invoices', {
        status: [InvoiceStatus.SENT],
        payment_status: ['pending', 'partial']
      });

      const now = new Date();
      
      for (const invoice of invoices) {
        const dueDate = new Date(invoice.due_date);
        if (now > dueDate) {
          await this.sheetsService.update('Invoices', invoice.id, {
            status: InvoiceStatus.OVERDUE
          });
          
          await this.onInvoiceOverdue(invoice.id);
        }
      }
    } catch (error) {
      console.error('Failed to check overdue invoices:', error);
    }
  }

  private async checkApproachingDeadlines(): Promise<void> {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      // Check project deadlines
      const projects = await this.sheetsService.query('Projects', {
        status: ProjectStatus.ACTIVE,
        end_date: {
          '<=': threeDaysFromNow.toISOString().split('T')[0]
        }
      });

      for (const project of projects) {
        // Schedule reminder if not already scheduled
        const existingReminders = await this.sheetsService.query('Reminder_Schedules', {
          type: 'project_deadline',
          entity_id: project.id,
          status: 'pending'
        });

        if (existingReminders.length === 0) {
          await this.scheduleProjectDeadlineReminder(project.id, {
            days_before: 1,
            template: 'project_deadline_approaching',
            method: 'email',
            priority: 'high'
          });
        }
      }

      // Check task deadlines
      const tasks = await this.sheetsService.query('Tasks', {
        status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        due_date: {
          '<=': threeDaysFromNow.toISOString().split('T')[0]
        }
      });

      for (const task of tasks) {
        const existingReminders = await this.sheetsService.query('Reminder_Schedules', {
          type: 'task_due',
          entity_id: task.id,
          status: 'pending'
        });

        if (existingReminders.length === 0) {
          await this.scheduleTaskDueReminder(task.id, {
            days_before: 1,
            template: 'task_due_approaching',
            method: 'email',
            priority: task.priority === TaskPriority.HIGH ? 'high' : 'medium'
          });
        }
      }
    } catch (error) {
      console.error('Failed to check approaching deadlines:', error);
    }
  }

  private async cleanupOldExecutions(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldExecutions = await this.sheetsService.query('Workflow_Executions', {
        status: 'completed',
        completed_at: {
          '<': thirtyDaysAgo.toISOString()
        }
      });

      for (const execution of oldExecutions) {
        await this.sheetsService.delete('Workflow_Executions', execution.id);
      }

      // Also cleanup old logs
      const oldLogs = await this.sheetsService.query('Automation_Logs', {
        timestamp: {
          '<': thirtyDaysAgo.toISOString()
        }
      });

      for (const log of oldLogs) {
        await this.sheetsService.delete('Automation_Logs', log.id);
      }
    } catch (error) {
      console.error('Failed to cleanup old executions:', error);
    }
  }

  private async executeScheduledReminder(reminder: any): Promise<void> {
    try {
      await this.sheetsService.update('Reminder_Schedules', reminder.id, {
        status: 'sent',
        attempts: reminder.attempts + 1,
        last_attempt_at: new Date().toISOString()
      });

      const config = JSON.parse(reminder.reminder_config);
      
      switch (reminder.type) {
        case 'project_deadline':
          await this.executeProjectDeadlineReminder(reminder.entity_id, config);
          break;
        case 'invoice_payment':
          await this.executeInvoicePaymentReminder(reminder.entity_id, config);
          break;
        case 'task_due':
          await this.executeTaskDueReminder(reminder.entity_id, config);
          break;
        case 'client_followup':
          const [clientId, projectId, milestoneType] = reminder.entity_id.split(':');
          await this.executeClientFollowup(clientId, projectId, milestoneType, config);
          break;
      }
    } catch (error) {
      await this.sheetsService.update('Reminder_Schedules', reminder.id, {
        status: 'failed',
        attempts: reminder.attempts + 1,
        last_attempt_at: new Date().toISOString()
      });
      console.error('Failed to execute scheduled reminder:', error);
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    try {
      const existingTemplates = await this.sheetsService.read('Notification_Templates');
      
      if (existingTemplates.length === 0) {
        const defaultTemplates = [
          {
            name: 'Project Deadline Approaching',
            type: 'email',
            subject: 'Project Deadline Reminder: {{project_name}}',
            body: 'Dear {{client_name}},\n\nThis is a reminder that your project "{{project_name}}" has a deadline approaching on {{deadline}}. You have {{days_remaining}} days remaining.\n\nPlease let us know if you have any questions.\n\nBest regards,\nYour Project Team',
            variables: JSON.stringify(['project_name', 'client_name', 'deadline', 'days_remaining']),
            is_active: true
          },
          {
            name: 'Invoice Payment Reminder',
            type: 'email',
            subject: 'Payment Reminder: Invoice {{invoice_number}}',
            body: 'Dear {{client_name}},\n\nThis is a reminder that invoice {{invoice_number}} for ${{amount}} is due on {{due_date}}.\n\nPlease process the payment at your earliest convenience.\n\nThank you,\nAccounts Team',
            variables: JSON.stringify(['client_name', 'invoice_number', 'amount', 'due_date']),
            is_active: true
          },
          {
            name: 'Task Due Reminder',
            type: 'email',
            subject: 'Task Due Reminder: {{task_title}}',
            body: 'Task "{{task_title}}" in project "{{project_name}}" is due on {{due_date}}.\n\nPriority: {{priority}}\nDays remaining: {{days_remaining}}',
            variables: JSON.stringify(['task_title', 'project_name', 'due_date', 'priority', 'days_remaining']),
            is_active: true
          }
        ];

        for (const template of defaultTemplates) {
          await this.sheetsService.create('Notification_Templates', template);
        }
      }
    } catch (error) {
      console.error('Failed to initialize default templates:', error);
    }
  }

  private async initializeDefaultRules(): Promise<void> {
    try {
      const existingRules = await this.sheetsService.read('Automation_Rules');
      
      if (existingRules.length === 0) {
        const defaultRules = [
          {
            name: 'Auto-complete project on all tasks done',
            description: 'Automatically mark project as completed when all tasks are done',
            trigger: JSON.stringify({
              type: 'task_completed',
              config: {}
            }),
            conditions: JSON.stringify([]),
            actions: JSON.stringify([
              {
                type: 'update_status',
                config: {
                  entity_type: 'Projects',
                  new_status: 'completed'
                }
              }
            ]),
            is_active: true
          },
          {
            name: 'Send thank you email on payment',
            description: 'Send thank you email when payment is received',
            trigger: JSON.stringify({
              type: 'payment_received',
              config: {}
            }),
            conditions: JSON.stringify([]),
            actions: JSON.stringify([
              {
                type: 'send_email',
                config: {
                  template: 'payment_thank_you',
                  recipient: '{{client_email}}'
                }
              }
            ]),
            is_active: true
          }
        ];

        for (const rule of defaultRules) {
          await this.sheetsService.create('Automation_Rules', rule);
        }
      }
    } catch (error) {
      console.error('Failed to initialize default rules:', error);
    }
  }

  // Notification implementation methods (simplified)
  private async sendEmail(recipient: string, subject: string, content: string): Promise<boolean> {
    try {
      // This would integrate with actual email service (SendGrid, Nodemailer, etc.)
      console.log(`Sending email to ${recipient}: ${subject}`);
      console.log(`Content: ${content}`);
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  private async sendSMS(recipient: string, content: string): Promise<boolean> {
    try {
      // This would integrate with SMS service (Twilio, etc.)
      console.log(`Sending SMS to ${recipient}: ${content}`);
      
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }

  private async sendInAppNotification(recipient: string, content: string): Promise<boolean> {
    try {
      // This would integrate with in-app notification system
      console.log(`Sending in-app notification to ${recipient}: ${content}`);
      
      // Store notification in database or send via WebSocket
      await this.sheetsService.create('In_App_Notifications', {
        recipient,
        content,
        status: 'unread',
        created_at: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
      return false;
    }
  }

  private async sendWebhook(url: string, data: Record<string, any>): Promise<boolean> {
    try {
      // This would make HTTP request to webhook URL
      console.log(`Sending webhook to ${url}:`, data);
      
      // Simulate webhook sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('Failed to send webhook:', error);
      return false;
    }
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return rendered;
  }

  private calculateDaysRemaining(dateString: string): number {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = targetDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateDaysOverdue(dateString: string): number {
    const targetDate = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - targetDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  private calculateDueDate(paymentTerms: string): string {
    const match = paymentTerms.match(/(\d+)/);
    const days = match ? parseInt(match[1]) : 30;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    
    return dueDate.toISOString().split('T')[0];
  }

  private calculateProjectEndDate(): string {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3); // Default 3 months
    return endDate.toISOString().split('T')[0];
  }

  private async logAutomationAction(
    action: string,
    entityId: string,
    status: 'success' | 'error',
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.sheetsService.create('Automation_Logs', {
        type: 'automation',
        entity_id: entityId,
        action,
        status,
        details: JSON.stringify(details),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log automation action:', error);
    }
  }
}