import * as cron from 'node-cron';
import { GoogleSheetsService } from './googleSheets';
import { Project, Task, Invoice } from '../models';
import { PaymentProcessingService } from './paymentProcessing';
import nodemailer from 'nodemailer';
import { config } from '../config';

/**
 * Workflow rule types
 */
export enum WorkflowTriggerType {
  TASK_STATUS_CHANGE = 'task_status_change',
  PROJECT_STATUS_CHANGE = 'project_status_change',
  DEADLINE_APPROACHING = 'deadline_approaching',
  INVOICE_STATUS_CHANGE = 'invoice_status_change',
  PAYMENT_RECEIVED = 'payment_received',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  MILESTONE_REACHED = 'milestone_reached'
}

/**
 * Workflow action types
 */
export enum WorkflowActionType {
  SEND_EMAIL = 'send_email',
  UPDATE_STATUS = 'update_status',
  CREATE_INVOICE = 'create_invoice',
  ASSIGN_TASK = 'assign_task',
  SEND_NOTIFICATION = 'send_notification',
  CONVERT_PROPOSAL_TO_INVOICE = 'convert_proposal_to_invoice'
}

/**
 * Workflow rule interface
 */
export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger: {
    type: WorkflowTriggerType;
    conditions: Record<string, any>;
  };
  actions: {
    type: WorkflowActionType;
    parameters: Record<string, any>;
  }[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_read: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: Date;
}

/**
 * Automation service for handling workflow rules, reminders, and notifications
 */
export class AutomationService {
  private sheetsService: GoogleSheetsService;
  private paymentService: PaymentProcessingService;
  private emailTransporter: nodemailer.Transporter;
  private workflowRules: Map<string, WorkflowRule> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.paymentService = new PaymentProcessingService();
    
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: config.email.host || 'smtp.example.com',
      port: config.email.port || 587,
      secure: config.email.secure || false,
      auth: {
        user: config.email.user || 'user@example.com',
        pass: config.email.password || 'password'
      }
    });
  }

  /**
   * Initialize the automation service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing automation service...');
      
      // Load workflow rules from Google Sheets
      await this.loadWorkflowRules();
      
      // Schedule recurring jobs
      this.scheduleRecurringJobs();
      
      console.log('Automation service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize automation service:', error);
      throw error;
    }
  }

  /**
   * Load workflow rules from Google Sheets
   */
  async loadWorkflowRules(): Promise<void> {
    try {
      // Check if WorkflowRules sheet exists, if not create it
      try {
        const rulesData = await this.sheetsService.read('WorkflowRules');
        
        // Parse rules and add to map
        rulesData.forEach(row => {
          const rule: WorkflowRule = {
            id: row.id,
            name: row.name,
            description: row.description,
            is_active: row.is_active === 'true' || row.is_active === true,
            trigger: JSON.parse(row.trigger),
            actions: JSON.parse(row.actions),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
          };
          
          this.workflowRules.set(rule.id, rule);
        });
        
        console.log(`Loaded ${rulesData.length} workflow rules`);
      } catch (error) {
        // Sheet doesn't exist, create it with sample rules
        console.log('Creating WorkflowRules sheet with sample rules');
        await this.createWorkflowRulesSheet();
      }
    } catch (error) {
      console.error('Error loading workflow rules:', error);
      throw error;
    }
  }

  /**
   * Create WorkflowRules sheet with sample rules
   */
  private async createWorkflowRulesSheet(): Promise<void> {
    try {
      // Create sample rules
      const sampleRules: WorkflowRule[] = [
        {
          id: 'rule_deadline_reminder',
          name: 'Task Deadline Reminder',
          description: 'Send reminder email when task deadline is approaching',
          is_active: true,
          trigger: {
            type: WorkflowTriggerType.DEADLINE_APPROACHING,
            conditions: {
              entity_type: 'task',
              days_before: 2
            }
          },
          actions: [
            {
              type: WorkflowActionType.SEND_EMAIL,
              parameters: {
                template: 'deadline_reminder',
                subject: 'Task Deadline Approaching'
              }
            },
            {
              type: WorkflowActionType.SEND_NOTIFICATION,
              parameters: {
                message: 'Task deadline is approaching in 2 days',
                type: 'warning'
              }
            }
          ],
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'rule_payment_reminder',
          name: 'Invoice Payment Reminder',
          description: 'Send payment reminder when invoice is overdue',
          is_active: true,
          trigger: {
            type: WorkflowTriggerType.INVOICE_STATUS_CHANGE,
            conditions: {
              old_status: 'sent',
              new_status: 'overdue'
            }
          },
          actions: [
            {
              type: WorkflowActionType.SEND_EMAIL,
              parameters: {
                template: 'payment_reminder',
                subject: 'Invoice Payment Reminder'
              }
            }
          ],
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'rule_proposal_conversion',
          name: 'Proposal to Invoice Conversion',
          description: 'Convert proposal to invoice when accepted',
          is_active: true,
          trigger: {
            type: WorkflowTriggerType.PROPOSAL_ACCEPTED,
            conditions: {}
          },
          actions: [
            {
              type: WorkflowActionType.CONVERT_PROPOSAL_TO_INVOICE,
              parameters: {
                due_days: 30
              }
            },
            {
              type: WorkflowActionType.SEND_NOTIFICATION,
              parameters: {
                message: 'Proposal converted to invoice',
                type: 'success'
              }
            }
          ],
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      // Add rules to map
      sampleRules.forEach(rule => {
        this.workflowRules.set(rule.id, rule);
      });
      
      // Save to Google Sheets
      const sheetRows = sampleRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        is_active: rule.is_active.toString(),
        trigger: JSON.stringify(rule.trigger),
        actions: JSON.stringify(rule.actions),
        created_at: rule.created_at.toISOString(),
        updated_at: rule.updated_at.toISOString()
      }));
      
      await this.sheetsService.batchCreate('WorkflowRules', sheetRows);
      console.log('Created WorkflowRules sheet with sample rules');
    } catch (error) {
      console.error('Error creating workflow rules sheet:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring jobs
   */
  private scheduleRecurringJobs(): void {
    // Schedule daily deadline check (9 AM IST)
    this.scheduledJobs.set('deadline_check', cron.schedule('0 9 * * *', async () => {
      console.log('Running daily deadline check...');
      await this.checkDeadlines();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    // Schedule daily payment reminder check (10 AM IST)
    this.scheduledJobs.set('payment_reminder', cron.schedule('0 10 * * *', async () => {
      console.log('Running daily payment reminder check...');
      await this.paymentService.sendPaymentReminders();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    console.log('Scheduled recurring automation jobs');
  }

  /**
   * Check for approaching deadlines and send reminders
   */
  async checkDeadlines(): Promise<{ tasks: number, projects: number }> {
    try {
      const results = { tasks: 0, projects: 0 };
      const today = new Date();
      
      // Check task deadlines
      const taskRows = await this.sheetsService.read('Tasks');
      const tasks = taskRows.map(row => Task.fromSheetRow(row));
      
      const approachingTaskDeadlines = tasks.filter(task => {
        if (!task.due_date || task.status === 'completed') return false;
        
        const dueDate = new Date(task.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysUntilDue > 0 && daysUntilDue <= 2; // 2 days before deadline
      });
      
      // Process task deadlines
      for (const task of approachingTaskDeadlines) {
        await this.processDeadlineReminder(task, 'task');
        results.tasks++;
      }
      
      // Check project deadlines
      const projectRows = await this.sheetsService.read('Projects');
      const projects = projectRows.map(row => Project.fromSheetRow(row));
      
      const approachingProjectDeadlines = projects.filter(project => {
        if (!project.end_date || project.status === 'completed') return false;
        
        const endDate = new Date(project.end_date);
        const daysUntilDue = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysUntilDue > 0 && daysUntilDue <= 3; // 3 days before deadline
      });
      
      // Process project deadlines
      for (const project of approachingProjectDeadlines) {
        await this.processDeadlineReminder(project, 'project');
        results.projects++;
      }
      
      console.log(`Processed ${results.tasks} task and ${results.projects} project deadline reminders`);
      return results;
    } catch (error) {
      console.error('Error checking deadlines:', error);
      throw error;
    }
  }

  /**
   * Process deadline reminder for a task or project
   */
  private async processDeadlineReminder(entity: any, entityType: 'task' | 'project'): Promise<void> {
    try {
      // Find applicable workflow rules
      const rules = Array.from(this.workflowRules.values()).filter(rule => 
        rule.is_active && 
        rule.trigger.type === WorkflowTriggerType.DEADLINE_APPROACHING &&
        rule.trigger.conditions.entity_type === entityType
      );
      
      if (rules.length === 0) return;
      
      // Get related data
      let projectName = '';
      let clientEmail = '';
      let clientName = '';
      
      if (entityType === 'task') {
        // Get project info for task
        const projectRows = await this.sheetsService.read('Projects', entity.project_id);
        if (projectRows.length > 0) {
          const project = Project.fromSheetRow(projectRows[0]);
          projectName = project.name;
          
          // Get client info
          const clientRows = await this.sheetsService.read('Clients', project.client_id);
          if (clientRows.length > 0) {
            clientEmail = clientRows[0].email;
            clientName = clientRows[0].name;
          }
        }
      } else if (entityType === 'project') {
        projectName = entity.name;
        
        // Get client info
        const clientRows = await this.sheetsService.read('Clients', entity.client_id);
        if (clientRows.length > 0) {
          clientEmail = clientRows[0].email;
          clientName = clientRows[0].name;
        }
      }
      
      // Execute rule actions
      for (const rule of rules) {
        for (const action of rule.actions) {
          await this.executeAction(action, {
            entity,
            entityType,
            projectName,
            clientEmail,
            clientName
          });
        }
      }
      
      // Record communication
      await this.recordCommunication({
        client_id: entityType === 'project' ? entity.client_id : null,
        project_id: entityType === 'project' ? entity.id : entity.project_id,
        type: 'email',
        direction: 'outbound',
        subject: `${entityType === 'task' ? 'Task' : 'Project'} Deadline Reminder`,
        content: `This is a reminder that the ${entityType} "${entity.name || entity.title}" is approaching its deadline.`,
        contact_person: clientName,
        follow_up_required: false
      });
      
    } catch (error) {
      console.error(`Error processing deadline reminder for ${entityType} ${entity.id}:`, error);
    }
  }

  /**
   * Execute a workflow action
   */
  private async executeAction(action: any, context: Record<string, any>): Promise<void> {
    try {
      switch (action.type) {
        case WorkflowActionType.SEND_EMAIL:
          await this.sendEmail(action.parameters, context);
          break;
          
        case WorkflowActionType.SEND_NOTIFICATION:
          await this.createNotification(action.parameters, context);
          break;
          
        case WorkflowActionType.CONVERT_PROPOSAL_TO_INVOICE:
          await this.convertProposalToInvoice(context.entity, action.parameters);
          break;
          
        case WorkflowActionType.UPDATE_STATUS:
          await this.updateEntityStatus(context.entity, context.entityType, action.parameters);
          break;
          
        default:
          console.warn(`Unsupported action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmail(parameters: any, context: Record<string, any>): Promise<void> {
    try {
      if (!context.clientEmail) {
        console.warn('Cannot send email: missing client email');
        return;
      }
      
      const subject = parameters.subject || 'Notification';
      let content = '';
      
      // Generate content based on template
      switch (parameters.template) {
        case 'deadline_reminder':
          content = this.generateDeadlineReminderEmail(context);
          break;
          
        case 'payment_reminder':
          content = this.generatePaymentReminderEmail(context);
          break;
          
        default:
          content = `This is a notification from the Project and Invoice Management System.`;
      }
      
      // In development mode, just log the email
      console.log(`Would send email to ${context.clientEmail}:`);
      console.log(`Subject: ${subject}`);
      console.log(`Content: ${content}`);
      
      // In production, uncomment this to send actual emails
      /*
      await this.emailTransporter.sendMail({
        from: config.email.from || 'noreply@example.com',
        to: context.clientEmail,
        subject,
        html: content
      });
      */
      
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  /**
   * Generate deadline reminder email content
   */
  private generateDeadlineReminderEmail(context: Record<string, any>): string {
    const entity = context.entity;
    const entityType = context.entityType;
    const deadline = new Date(entityType === 'task' ? entity.due_date : entity.end_date);
    const formattedDeadline = deadline.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Deadline Reminder</h2>
        <p>Dear ${context.clientName || 'Client'},</p>
        <p>This is a friendly reminder that the following ${entityType} is approaching its deadline:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>${entityType === 'task' ? 'Task' : 'Project'}:</strong> ${entity.name || entity.title}</p>
          <p><strong>Deadline:</strong> ${formattedDeadline}</p>
          ${context.projectName && entityType === 'task' ? `<p><strong>Project:</strong> ${context.projectName}</p>` : ''}
        </div>
        <p>Please ensure all requirements are met before the deadline.</p>
        <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
        <p>Best regards,<br>Your Project Management Team</p>
      </div>
    `;
  }

  /**
   * Generate payment reminder email content
   */
  private generatePaymentReminderEmail(context: Record<string, any>): string {
    const invoice = context.entity;
    const dueDate = new Date(invoice.due_date);
    const formattedDueDate = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder</h2>
        <p>Dear ${context.clientName || 'Client'},</p>
        <p>This is a friendly reminder about the following invoice that is now overdue:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
          <p><strong>Amount:</strong> ${invoice.currency || 'INR'} ${invoice.total_amount}</p>
          <p><strong>Due Date:</strong> ${formattedDueDate}</p>
          ${context.projectName ? `<p><strong>Project:</strong> ${context.projectName}</p>` : ''}
        </div>
        <p>Please process the payment at your earliest convenience.</p>
        ${invoice.payment_link ? `<p><a href="${invoice.payment_link}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Pay Now</a></p>` : ''}
        <p>If you have already made the payment, please disregard this reminder.</p>
        <p>Best regards,<br>Your Billing Team</p>
      </div>
    `;
  }

  /**
   * Create a notification
   */
  private async createNotification(parameters: any, context: Record<string, any>): Promise<void> {
    try {
      const entity = context.entity;
      const entityType = context.entityType;
      
      const notification: Notification = {
        id: `notif_${Date.now().toString(36)}`,
        user_id: 'admin', // Default to admin user
        title: parameters.title || 'System Notification',
        message: parameters.message || 'You have a new notification',
        type: parameters.type || 'info',
        is_read: false,
        related_entity_type: entityType,
        related_entity_id: entity.id,
        created_at: new Date()
      };
      
      // In a real implementation, we would store this in Google Sheets
      // For now, just log it
      console.log('Created notification:', notification);
      
      // Check if Notifications sheet exists, create if not
      try {
        await this.sheetsService.create('Notifications', {
          id: notification.id,
          user_id: notification.user_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          is_read: notification.is_read.toString(),
          related_entity_type: notification.related_entity_type || '',
          related_entity_id: notification.related_entity_id || '',
          created_at: notification.created_at.toISOString()
        });
      } catch (error) {
        console.error('Error creating notification in sheet:', error);
      }
      
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Convert a proposal to an invoice
   */
  private async convertProposalToInvoice(proposal: any, parameters: any): Promise<void> {
    try {
      // In a real implementation, we would:
      // 1. Get the proposal details
      // 2. Create a new invoice based on the proposal
      // 3. Update the proposal status
      
      console.log(`Converting proposal ${proposal.id} to invoice`);
      
      // For now, just log that we would do this
      console.log('Would convert proposal to invoice with parameters:', parameters);
      
    } catch (error) {
      console.error('Error converting proposal to invoice:', error);
    }
  }

  /**
   * Update entity status
   */
  private async updateEntityStatus(entity: any, entityType: string, parameters: any): Promise<void> {
    try {
      const newStatus = parameters.status;
      if (!newStatus) {
        console.warn('Cannot update status: missing status parameter');
        return;
      }
      
      console.log(`Updating ${entityType} ${entity.id} status to ${newStatus}`);
      
      // Update entity status based on type
      switch (entityType) {
        case 'task':
          entity.status = newStatus;
          await this.sheetsService.update('Tasks', entity.id, entity);
          break;
          
        case 'project':
          entity.status = newStatus;
          await this.sheetsService.update('Projects', entity.id, entity);
          break;
          
        case 'invoice':
          entity.status = newStatus;
          await this.sheetsService.update('Invoices', entity.id, entity);
          break;
          
        default:
          console.warn(`Unsupported entity type for status update: ${entityType}`);
      }
      
    } catch (error) {
      console.error(`Error updating ${entityType} status:`, error);
    }
  }

  /**
   * Record a communication
   */
  private async recordCommunication(communication: any): Promise<void> {
    try {
      communication.id = `comm_${Date.now().toString(36)}`;
      communication.created_at = new Date().toISOString();
      
      await this.sheetsService.create('Communications', communication);
    } catch (error) {
      console.error('Error recording communication:', error);
    }
  }

  /**
   * Process task status change
   */
  async processTaskStatusChange(taskId: string, oldStatus: string, newStatus: string): Promise<void> {
    try {
      // Get task details
      const taskRows = await this.sheetsService.read('Tasks', taskId);
      if (taskRows.length === 0) {
        console.warn(`Task ${taskId} not found`);
        return;
      }
      
      const task = Task.fromSheetRow(taskRows[0]);
      
      // Find applicable workflow rules
      const rules = Array.from(this.workflowRules.values()).filter(rule => 
        rule.is_active && 
        rule.trigger.type === WorkflowTriggerType.TASK_STATUS_CHANGE &&
        rule.trigger.conditions.old_status === oldStatus &&
        rule.trigger.conditions.new_status === newStatus
      );
      
      if (rules.length === 0) return;
      
      // Get project details
      const projectRows = await this.sheetsService.read('Projects', task.project_id);
      if (projectRows.length === 0) {
        console.warn(`Project ${task.project_id} not found`);
        return;
      }
      
      const project = Project.fromSheetRow(projectRows[0]);
      
      // Get client details
      const clientRows = await this.sheetsService.read('Clients', project.client_id);
      const clientEmail = clientRows.length > 0 ? clientRows[0].email : '';
      const clientName = clientRows.length > 0 ? clientRows[0].name : '';
      
      // Execute rule actions
      for (const rule of rules) {
        for (const action of rule.actions) {
          await this.executeAction(action, {
            entity: task,
            entityType: 'task',
            projectName: project.name,
            clientEmail,
            clientName
          });
        }
      }
      
      // Check if all tasks are completed for the project
      if (newStatus === 'completed') {
        await this.checkProjectCompletion(task.project_id);
      }
      
    } catch (error) {
      console.error(`Error processing task status change for ${taskId}:`, error);
    }
  }

  /**
   * Check if all tasks for a project are completed
   */
  private async checkProjectCompletion(projectId: string): Promise<void> {
    try {
      // Get all tasks for the project
      const taskRows = await this.sheetsService.query('Tasks', { project_id: projectId });
      const tasks = taskRows.map(row => Task.fromSheetRow(row));
      
      // Check if all tasks are completed
      const allCompleted = tasks.length > 0 && tasks.every(task => task.status === 'completed');
      
      if (allCompleted) {
        // Get project details
        const projectRows = await this.sheetsService.read('Projects', projectId);
        if (projectRows.length === 0) return;
        
        const project = Project.fromSheetRow(projectRows[0]);
        
        // Find applicable workflow rules
        const rules = Array.from(this.workflowRules.values()).filter(rule => 
          rule.is_active && 
          rule.trigger.type === WorkflowTriggerType.MILESTONE_REACHED &&
          rule.trigger.conditions.milestone_type === 'all_tasks_completed'
        );
        
        if (rules.length === 0) return;
        
        // Get client details
        const clientRows = await this.sheetsService.read('Clients', project.client_id);
        const clientEmail = clientRows.length > 0 ? clientRows[0].email : '';
        const clientName = clientRows.length > 0 ? clientRows[0].name : '';
        
        // Execute rule actions
        for (const rule of rules) {
          for (const action of rule.actions) {
            await this.executeAction(action, {
              entity: project,
              entityType: 'project',
              projectName: project.name,
              clientEmail,
              clientName
            });
          }
        }
        
        // Update project status if not already completed
        if (project.status !== 'completed') {
          project.status = 'completed';
          await this.sheetsService.update('Projects', project.id, project);
          console.log(`Updated project ${project.id} status to completed`);
        }
      }
      
    } catch (error) {
      console.error(`Error checking project completion for ${projectId}:`, error);
    }
  }

  /**
   * Process invoice status change
   */
  async processInvoiceStatusChange(invoiceId: string, oldStatus: string, newStatus: string): Promise<void> {
    try {
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        console.warn(`Invoice ${invoiceId} not found`);
        return;
      }
      
      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Find applicable workflow rules
      const rules = Array.from(this.workflowRules.values()).filter(rule => 
        rule.is_active && 
        rule.trigger.type === WorkflowTriggerType.INVOICE_STATUS_CHANGE &&
        rule.trigger.conditions.old_status === oldStatus &&
        rule.trigger.conditions.new_status === newStatus
      );
      
      if (rules.length === 0) return;
      
      // Get project details if available
      let projectName = '';
      if (invoice.project_id) {
        const projectRows = await this.sheetsService.read('Projects', invoice.project_id);
        if (projectRows.length > 0) {
          projectName = projectRows[0].name;
        }
      }
      
      // Get client details
      const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
      const clientEmail = clientRows.length > 0 ? clientRows[0].email : '';
      const clientName = clientRows.length > 0 ? clientRows[0].name : '';
      
      // Execute rule actions
      for (const rule of rules) {
        for (const action of rule.actions) {
          await this.executeAction(action, {
            entity: invoice,
            entityType: 'invoice',
            projectName,
            clientEmail,
            clientName
          });
        }
      }
      
    } catch (error) {
      console.error(`Error processing invoice status change for ${invoiceId}:`, error);
    }
  }

  /**
   * Process proposal acceptance
   */
  async processProposalAcceptance(proposalId: string): Promise<void> {
    try {
      // Get proposal details
      const proposalRows = await this.sheetsService.read('Proposals', proposalId);
      if (proposalRows.length === 0) {
        console.warn(`Proposal ${proposalId} not found`);
        return;
      }
      
      const proposal = proposalRows[0];
      
      // Find applicable workflow rules
      const rules = Array.from(this.workflowRules.values()).filter(rule => 
        rule.is_active && 
        rule.trigger.type === WorkflowTriggerType.PROPOSAL_ACCEPTED
      );
      
      if (rules.length === 0) return;
      
      // Get client details
      const clientRows = await this.sheetsService.read('Clients', proposal.client_id);
      const clientEmail = clientRows.length > 0 ? clientRows[0].email : '';
      const clientName = clientRows.length > 0 ? clientRows[0].name : '';
      
      // Execute rule actions
      for (const rule of rules) {
        for (const action of rule.actions) {
          await this.executeAction(action, {
            entity: proposal,
            entityType: 'proposal',
            projectName: proposal.project_name || '',
            clientEmail,
            clientName
          });
        }
      }
      
    } catch (error) {
      console.error(`Error processing proposal acceptance for ${proposalId}:`, error);
    }
  }

  /**
   * Get all workflow rules
   */
  async getWorkflowRules(): Promise<WorkflowRule[]> {
    return Array.from(this.workflowRules.values());
  }

  /**
   * Create a new workflow rule
   */
  async createWorkflowRule(rule: Omit<WorkflowRule, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowRule> {
    try {
      const newRule: WorkflowRule = {
        ...rule,
        id: `rule_${Date.now().toString(36)}`,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Save to map
      this.workflowRules.set(newRule.id, newRule);
      
      // Save to Google Sheets
      await this.sheetsService.create('WorkflowRules', {
        id: newRule.id,
        name: newRule.name,
        description: newRule.description || '',
        is_active: newRule.is_active.toString(),
        trigger: JSON.stringify(newRule.trigger),
        actions: JSON.stringify(newRule.actions),
        created_at: newRule.created_at.toISOString(),
        updated_at: newRule.updated_at.toISOString()
      });
      
      return newRule;
    } catch (error) {
      console.error('Error creating workflow rule:', error);
      throw error;
    }
  }

  /**
   * Update a workflow rule
   */
  async updateWorkflowRule(id: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule> {
    try {
      const rule = this.workflowRules.get(id);
      if (!rule) {
        throw new Error(`Workflow rule ${id} not found`);
      }
      
      // Update rule
      const updatedRule: WorkflowRule = {
        ...rule,
        ...updates,
        updated_at: new Date()
      };
      
      // Save to map
      this.workflowRules.set(id, updatedRule);
      
      // Save to Google Sheets
      await this.sheetsService.update('WorkflowRules', id, {
        name: updatedRule.name,
        description: updatedRule.description || '',
        is_active: updatedRule.is_active.toString(),
        trigger: JSON.stringify(updatedRule.trigger),
        actions: JSON.stringify(updatedRule.actions),
        updated_at: updatedRule.updated_at.toISOString()
      });
      
      return updatedRule;
    } catch (error) {
      console.error(`Error updating workflow rule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a workflow rule
   */
  async deleteWorkflowRule(id: string): Promise<boolean> {
    try {
      // Remove from map
      const deleted = this.workflowRules.delete(id);
      
      if (deleted) {
        // Remove from Google Sheets
        await this.sheetsService.delete('WorkflowRules', id);
      }
      
      return deleted;
    } catch (error) {
      console.error(`Error deleting workflow rule ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, options: { limit?: number, unreadOnly?: boolean } = {}): Promise<Notification[]> {
    try {
      // Query notifications from Google Sheets
      let query: any = { user_id: userId };
      if (options.unreadOnly) {
        query.is_read = 'false';
      }
      
      const notificationRows = await this.sheetsService.query('Notifications', query);
      
      // Parse notifications
      let notifications = notificationRows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        is_read: row.is_read === 'true' || row.is_read === true,
        related_entity_type: row.related_entity_type,
        related_entity_id: row.related_entity_id,
        created_at: new Date(row.created_at)
      }));
      
      // Sort by created_at (newest first)
      notifications.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        notifications = notifications.slice(0, options.limit);
      }
      
      return notifications;
    } catch (error) {
      console.error(`Error getting notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      await this.sheetsService.update('Notifications', notificationId, {
        is_read: 'true'
      });
      
      return true;
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<number> {
    try {
      // Get all unread notifications
      const notifications = await this.getNotifications(userId, { unreadOnly: true });
      
      // Update each notification
      let count = 0;
      for (const notification of notifications) {
        await this.markNotificationAsRead(notification.id);
        count++;
      }
      
      return count;
    } catch (error) {
      console.error(`Error marking all notifications as read for user ${userId}:`, error);
      return 0;
    }
  }
}

// Export singleton instance
export const automationService = new AutomationService();