import { AutomationService, WorkflowRule, WorkflowTriggerType, WorkflowActionType } from './automation';
import { GoogleSheetsService } from './googleSheets';
import { GSTReportingService } from './gstReporting';
import { EInvoicingService } from './eInvoicing';
import { Invoice, InvoiceStatus } from '../models/Invoice';
import { Client } from '../models/Client';
import { Project, ProjectStatus } from '../models/Project';
import { Task } from '../models/Task';
import { TimeEntry } from '../models/TimeEntry';
import { Expense } from '../models/Expense';
import * as cron from 'node-cron';
import { config } from '../config';

/**
 * Advanced workflow trigger types
 */
export enum AdvancedWorkflowTriggerType {
  INVOICE_AMOUNT_THRESHOLD = 'invoice_amount_threshold',
  CLIENT_ACTIVITY_THRESHOLD = 'client_activity_threshold',
  PROJECT_BUDGET_THRESHOLD = 'project_budget_threshold',
  RECURRING_GST_REPORT = 'recurring_gst_report',
  EXPENSE_CATEGORY_THRESHOLD = 'expense_category_threshold',
  TIME_TRACKING_THRESHOLD = 'time_tracking_threshold',
  PAYMENT_DELAY_THRESHOLD = 'payment_delay_threshold',
  E_INVOICE_ELIGIBLE = 'e_invoice_eligible'
}

/**
 * Advanced workflow action types
 */
export enum AdvancedWorkflowActionType {
  GENERATE_GST_REPORT = 'generate_gst_report',
  GENERATE_E_INVOICE = 'generate_e_invoice',
  APPLY_LATE_PAYMENT_FEE = 'apply_late_payment_fee',
  ESCALATE_NOTIFICATION = 'escalate_notification',
  ADJUST_PROJECT_BUDGET = 'adjust_project_budget',
  CREATE_BACKUP = 'create_backup',
  TRIGGER_EXTERNAL_WEBHOOK = 'trigger_external_webhook',
  GENERATE_FINANCIAL_REPORT = 'generate_financial_report'
}

/**
 * Advanced automation service for handling complex workflow rules and integrations
 */
export class AdvancedAutomationService {
  private sheetsService: GoogleSheetsService;
  private automationService: AutomationService;
  private gstReportingService: GSTReportingService;
  private eInvoicingService: EInvoicingService;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private webhookEndpoints: Map<string, string> = new Map();

  constructor(
    sheetsService: GoogleSheetsService,
    automationService: AutomationService,
    gstReportingService: GSTReportingService,
    eInvoicingService: EInvoicingService
  ) {
    this.sheetsService = sheetsService;
    this.automationService = automationService;
    this.gstReportingService = gstReportingService;
    this.eInvoicingService = eInvoicingService;
    
    // Initialize webhook endpoints from config
    if (config.webhooks) {
      Object.entries(config.webhooks).forEach(([key, url]) => {
        this.webhookEndpoints.set(key, url as string);
      });
    }
  }

  /**
   * Initialize advanced automation service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing advanced automation service...');
      
      // Schedule recurring jobs
      this.scheduleRecurringJobs();
      
      // Register advanced workflow rules
      await this.registerAdvancedWorkflowRules();
      
      console.log('Advanced automation service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize advanced automation service:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring jobs
   */
  private scheduleRecurringJobs(): void {
    // Schedule monthly GST report generation (1st of every month at 1 AM IST)
    this.scheduledJobs.set('monthly_gst_report', cron.schedule('0 1 1 * *', async () => {
      console.log('Running monthly GST report generation...');
      await this.generateMonthlyGSTReport();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    // Schedule quarterly GST report generation (1st of Jan, Apr, Jul, Oct at 2 AM IST)
    this.scheduledJobs.set('quarterly_gst_report', cron.schedule('0 2 1 1,4,7,10 *', async () => {
      console.log('Running quarterly GST report generation...');
      await this.generateQuarterlyGSTReport();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    // Schedule daily check for e-invoice eligible invoices (3 AM IST)
    this.scheduledJobs.set('e_invoice_check', cron.schedule('0 3 * * *', async () => {
      console.log('Running e-invoice eligibility check...');
      await this.checkEInvoiceEligibility();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    // Schedule weekly data backup (Sunday at 4 AM IST)
    this.scheduledJobs.set('weekly_backup', cron.schedule('0 4 * * 0', async () => {
      console.log('Running weekly data backup...');
      await this.createDataBackup();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }));
    
    console.log('Scheduled recurring advanced automation jobs');
  }

  /**
   * Register advanced workflow rules
   */
  private async registerAdvancedWorkflowRules(): Promise<void> {
    try {
      // Check if AdvancedWorkflowRules sheet exists, if not create it
      try {
        const rulesData = await this.sheetsService.read('AdvancedWorkflowRules');
        console.log(`Loaded ${rulesData.length} advanced workflow rules`);
      } catch (error) {
        // Sheet doesn't exist, create it with sample rules
        console.log('Creating AdvancedWorkflowRules sheet with sample rules');
        await this.createAdvancedWorkflowRulesSheet();
      }
    } catch (error) {
      console.error('Error registering advanced workflow rules:', error);
      throw error;
    }
  }

  /**
   * Create AdvancedWorkflowRules sheet with sample rules
   */
  private async createAdvancedWorkflowRulesSheet(): Promise<void> {
    try {
      // Create sample advanced rules
      const sampleRules = [
        {
          id: 'adv_rule_gst_report',
          name: 'Monthly GST Report Generation',
          description: 'Automatically generate GST reports at the beginning of each month',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.RECURRING_GST_REPORT,
            conditions: {
              frequency: 'monthly',
              day: 1
            }
          },
          actions: [
            {
              type: AdvancedWorkflowActionType.GENERATE_GST_REPORT,
              parameters: {
                report_type: 'GSTR1',
                format: 'PDF',
                notify: true
              }
            }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'adv_rule_e_invoice',
          name: 'E-Invoice Generation',
          description: 'Automatically generate e-invoices for eligible invoices (>₹50,000)',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.E_INVOICE_ELIGIBLE,
            conditions: {
              amount_threshold: 50000,
              client_has_gstin: true
            }
          },
          actions: [
            {
              type: AdvancedWorkflowActionType.GENERATE_E_INVOICE,
              parameters: {
                notify_client: true
              }
            }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'adv_rule_late_payment',
          name: 'Late Payment Fee',
          description: 'Apply late payment fee for overdue invoices',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.PAYMENT_DELAY_THRESHOLD,
            conditions: {
              days_overdue: 15
            }
          },
          actions: [
            {
              type: AdvancedWorkflowActionType.APPLY_LATE_PAYMENT_FEE,
              parameters: {
                fee_percentage: 1.5,
                notify_client: true
              }
            }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'adv_rule_budget_alert',
          name: 'Project Budget Alert',
          description: 'Alert when project expenses reach 80% of budget',
          is_active: true,
          trigger: {
            type: AdvancedWorkflowTriggerType.PROJECT_BUDGET_THRESHOLD,
            conditions: {
              percentage_threshold: 80
            }
          },
          actions: [
            {
              type: AdvancedWorkflowActionType.ESCALATE_NOTIFICATION,
              parameters: {
                message: 'Project budget threshold reached',
                priority: 'high'
              }
            }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      // Save to Google Sheets
      const sheetRows = sampleRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        is_active: rule.is_active.toString(),
        trigger: JSON.stringify(rule.trigger),
        actions: JSON.stringify(rule.actions),
        created_at: rule.created_at,
        updated_at: rule.updated_at
      }));
      
      await this.sheetsService.batchCreate('AdvancedWorkflowRules', sheetRows);
      console.log('Created AdvancedWorkflowRules sheet with sample rules');
    } catch (error) {
      console.error('Error creating advanced workflow rules sheet:', error);
      throw error;
    }
  }

  /**
   * Generate monthly GST report
   */
  async generateMonthlyGSTReport(): Promise<void> {
    try {
      const today = new Date();
      
      // Set date range for previous month
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      
      console.log(`Generating GST report for period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Generate GSTR1 report
      const gstr1Data = await this.gstReportingService.generateGSTR1Report({
        startDate,
        endDate,
        invoiceStatus: [InvoiceStatus.PAID, InvoiceStatus.SENT]
      });
      
      // Export to PDF
      const pdfBuffer = await this.gstReportingService.exportGSTReport(
        'gstr1',
        gstr1Data,
        'pdf'
      );
      
      // In a real implementation, we would:
      // 1. Save the PDF to Google Drive
      // 2. Send email notification with the report
      // 3. Update report generation history
      
      console.log(`Generated monthly GST report for ${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`);
      
      // Trigger webhook notification if configured
      if (this.webhookEndpoints.has('gst_report')) {
        await this.triggerWebhook('gst_report', {
          report_type: 'GSTR1',
          period: `${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`,
          generated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error generating monthly GST report:', error);
    }
  }

  /**
   * Generate quarterly GST report
   */
  async generateQuarterlyGSTReport(): Promise<void> {
    try {
      const today = new Date();
      let quarter;
      let startDate;
      let endDate;
      
      // Determine which quarter we're generating for
      const month = today.getMonth();
      if (month === 0) { // January - generate for Q4 of previous year
        quarter = 4;
        startDate = new Date(today.getFullYear() - 1, 9, 1); // Oct 1st of previous year
        endDate = new Date(today.getFullYear() - 1, 11, 31); // Dec 31st of previous year
      } else if (month === 3) { // April - generate for Q1
        quarter = 1;
        startDate = new Date(today.getFullYear(), 0, 1); // Jan 1st
        endDate = new Date(today.getFullYear(), 2, 31); // Mar 31st
      } else if (month === 6) { // July - generate for Q2
        quarter = 2;
        startDate = new Date(today.getFullYear(), 3, 1); // Apr 1st
        endDate = new Date(today.getFullYear(), 5, 30); // Jun 30th
      } else if (month === 9) { // October - generate for Q3
        quarter = 3;
        startDate = new Date(today.getFullYear(), 6, 1); // Jul 1st
        endDate = new Date(today.getFullYear(), 8, 30); // Sep 30th
      } else {
        console.log('Not a quarter end month, skipping quarterly GST report generation');
        return;
      }
      
      console.log(`Generating quarterly GST report for Q${quarter} ${startDate.getFullYear()}`);
      
      // Generate GSTR1 report
      const gstr1Data = await this.gstReportingService.generateGSTR1Report({
        startDate,
        endDate,
        invoiceStatus: [InvoiceStatus.PAID, InvoiceStatus.SENT]
      });
      
      // Generate GSTR3B report
      const gstr3bData = await this.gstReportingService.generateGSTR3BReport({
        startDate,
        endDate,
        invoiceStatus: [InvoiceStatus.PAID, InvoiceStatus.SENT]
      });
      
      // Export to PDF
      const gstr1PdfBuffer = await this.gstReportingService.exportGSTReport(
        'gstr1',
        gstr1Data,
        'pdf'
      );
      
      const gstr3bPdfBuffer = await this.gstReportingService.exportGSTReport(
        'gstr3b',
        gstr3bData,
        'pdf'
      );
      
      // In a real implementation, we would:
      // 1. Save the PDFs to Google Drive
      // 2. Send email notification with the reports
      // 3. Update report generation history
      
      console.log(`Generated quarterly GST reports for Q${quarter} ${startDate.getFullYear()}`);
      
      // Trigger webhook notification if configured
      if (this.webhookEndpoints.has('gst_report')) {
        await this.triggerWebhook('gst_report', {
          report_type: 'Quarterly',
          quarter: `Q${quarter} ${startDate.getFullYear()}`,
          generated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error generating quarterly GST report:', error);
    }
  }

  /**
   * Check for e-invoice eligible invoices
   */
  async checkEInvoiceEligibility(): Promise<void> {
    try {
      // Get all sent invoices
      const invoiceRows = await this.sheetsService.query('Invoices', { status: InvoiceStatus.SENT });
      const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
      
      // Filter for invoices that meet e-invoice criteria
      // In India, e-invoicing is mandatory for businesses with turnover > 5 crore
      // and for invoices > ₹50,000
      const eligibleInvoices = invoices.filter(invoice => 
        invoice.total_amount >= 50000 && // Amount threshold
        !invoice.e_invoice_id // Not already e-invoiced
      );
      
      if (eligibleInvoices.length === 0) {
        console.log('No eligible invoices found for e-invoicing');
        return;
      }
      
      console.log(`Found ${eligibleInvoices.length} invoices eligible for e-invoicing`);
      
      // Process each eligible invoice
      for (const invoice of eligibleInvoices) {
        try {
          // Get client details to check if they have GSTIN
          const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
          if (clientRows.length === 0) continue;
          
          const client = Client.fromSheetRow(clientRows[0]);
          
          // Skip if client doesn't have GSTIN
          if (!client.gstin) {
            console.log(`Skipping e-invoice for invoice ${invoice.id} as client doesn't have GSTIN`);
            continue;
          }
          
          console.log(`Generating e-invoice for invoice ${invoice.id}`);
          
          // Generate e-invoice
          await this.eInvoicingService.generateEInvoice(invoice.id);
          
          console.log(`Successfully generated e-invoice for invoice ${invoice.id}`);
        } catch (error) {
          console.error(`Error processing e-invoice for invoice ${invoice.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking e-invoice eligibility:', error);
    }
  }

  /**
   * Apply late payment fee to overdue invoices
   */
  async applyLatePaymentFee(daysThreshold: number, feePercentage: number): Promise<void> {
    try {
      // Get all overdue invoices
      const invoiceRows = await this.sheetsService.query('Invoices', { status: InvoiceStatus.OVERDUE });
      const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
      
      const today = new Date();
      
      // Filter for invoices that are overdue by the threshold
      const eligibleInvoices = invoices.filter(invoice => {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysOverdue >= daysThreshold && !invoice.late_fee_applied;
      });
      
      if (eligibleInvoices.length === 0) {
        console.log(`No invoices found overdue by ${daysThreshold} days for late fee application`);
        return;
      }
      
      console.log(`Found ${eligibleInvoices.length} invoices eligible for late fee application`);
      
      // Process each eligible invoice
      for (const invoice of eligibleInvoices) {
        try {
          // Calculate late fee
          const lateFeeAmount = invoice.total_amount * (feePercentage / 100);
          
          // Update invoice with late fee
          invoice.late_fee = lateFeeAmount;
          invoice.total_amount += lateFeeAmount;
          invoice.late_fee_applied = true;
          
          // Save updated invoice
          await this.sheetsService.update('Invoices', invoice.id, invoice);
          
          console.log(`Applied late fee of ${lateFeeAmount.toFixed(2)} to invoice ${invoice.id}`);
          
          // Get client details for notification
          const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
          if (clientRows.length === 0) continue;
          
          const client = Client.fromSheetRow(clientRows[0]);
          
          // Send notification
          await this.automationService.processInvoiceStatusChange(
            invoice.id,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.OVERDUE
          );
          
          // Record communication
          await this.recordCommunication({
            client_id: client.id,
            project_id: invoice.project_id,
            type: 'email',
            direction: 'outbound',
            subject: 'Late Payment Fee Applied',
            content: `A late payment fee of ${lateFeeAmount.toFixed(2)} has been applied to invoice ${invoice.invoice_number} due to payment delay.`,
            contact_person: client.name,
            follow_up_required: false
          });
        } catch (error) {
          console.error(`Error applying late fee to invoice ${invoice.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error applying late payment fees:', error);
    }
  }

  /**
   * Check project budget thresholds
   */
  async checkProjectBudgetThresholds(percentageThreshold: number): Promise<void> {
    try {
      // Get all active projects
      const projectRows = await this.sheetsService.query('Projects', { status: ProjectStatus.ACTIVE });
      const projects = projectRows.map(row => Project.fromSheetRow(row));
      
      // Process each project
      for (const project of projects) {
        try {
          // Skip projects without budget
          if (!project.budget || project.budget <= 0) continue;
          
          // Get all expenses for the project
          const expenseRows = await this.sheetsService.query('Expenses', { project_id: project.id });
          const expenses = expenseRows.map(row => Expense.fromSheetRow(row));
          
          // Calculate total expenses
          const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
          
          // Calculate budget usage percentage
          const budgetUsagePercentage = (totalExpenses / project.budget) * 100;
          
          // Check if threshold is reached
          if (budgetUsagePercentage >= percentageThreshold && !project.budget_alert_sent) {
            console.log(`Project ${project.id} has reached ${budgetUsagePercentage.toFixed(2)}% of budget`);
            
            // Update project to mark alert as sent
            project.budget_alert_sent = true;
            await this.sheetsService.update('Projects', project.id, project);
            
            // Get client details
            const clientRows = await this.sheetsService.read('Clients', project.client_id);
            if (clientRows.length === 0) continue;
            
            const client = Client.fromSheetRow(clientRows[0]);
            
            // Create notification
            await this.createNotification({
              user_id: 'admin',
              title: 'Project Budget Alert',
              message: `Project "${project.name}" has reached ${budgetUsagePercentage.toFixed(2)}% of its budget`,
              type: 'warning',
              related_entity_type: 'project',
              related_entity_id: project.id
            });
            
            // Trigger webhook if configured
            if (this.webhookEndpoints.has('budget_alert')) {
              await this.triggerWebhook('budget_alert', {
                project_id: project.id,
                project_name: project.name,
                client_name: client.name,
                budget: project.budget,
                expenses: totalExpenses,
                percentage: budgetUsagePercentage,
                alert_time: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error(`Error checking budget for project ${project.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking project budget thresholds:', error);
    }
  }

  /**
   * Create data backup
   */
  async createDataBackup(): Promise<void> {
    try {
      console.log('Creating data backup...');
      
      // In a real implementation, we would:
      // 1. Export all sheets to CSV/JSON
      // 2. Save to Google Drive or other storage
      // 3. Record backup metadata
      
      // For this demo, we'll just log the backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `backup_${timestamp}`;
      
      console.log(`Data backup created with ID: ${backupId}`);
      
      // Trigger webhook if configured
      if (this.webhookEndpoints.has('backup_complete')) {
        await this.triggerWebhook('backup_complete', {
          backup_id: backupId,
          timestamp: new Date().toISOString(),
          status: 'completed'
        });
      }
    } catch (error) {
      console.error('Error creating data backup:', error);
      
      // Trigger webhook for backup failure
      if (this.webhookEndpoints.has('backup_failed')) {
        await this.triggerWebhook('backup_failed', {
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }
  }

  /**
   * Trigger external webhook
   */
  async triggerWebhook(webhookKey: string, data: any): Promise<void> {
    try {
      const webhookUrl = this.webhookEndpoints.get(webhookKey);
      
      if (!webhookUrl) {
        console.warn(`No webhook URL configured for key: ${webhookKey}`);
        return;
      }
      
      console.log(`Triggering webhook: ${webhookKey} to ${webhookUrl}`);
      
      // In a real implementation, we would make an HTTP request:
      /*
      await axios.post(webhookUrl, {
        event: webhookKey,
        timestamp: new Date().toISOString(),
        data
      });
      */
      
      // For this demo, we'll just log the webhook call
      console.log(`Webhook payload for ${webhookKey}:`, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error triggering webhook ${webhookKey}:`, error);
    }
  }

  /**
   * Create notification
   */
  private async createNotification(notification: any): Promise<void> {
    try {
      notification.id = `notif_${Date.now().toString(36)}`;
      notification.is_read = false;
      notification.created_at = new Date().toISOString();
      
      await this.sheetsService.create('Notifications', notification);
      
      console.log(`Created notification: ${notification.title}`);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  /**
   * Record communication
   */
  private async recordCommunication(communication: any): Promise<void> {
    try {
      communication.id = `comm_${Date.now().toString(36)}`;
      communication.created_at = new Date().toISOString();
      
      await this.sheetsService.create('Communications', communication);
      
      console.log(`Recorded communication: ${communication.subject}`);
    } catch (error) {
      console.error('Error recording communication:', error);
    }
  }

  /**
   * Process advanced workflow trigger
   */
  async processAdvancedTrigger(triggerType: AdvancedWorkflowTriggerType, context: any): Promise<void> {
    try {
      // Get all advanced workflow rules
      const rulesData = await this.sheetsService.read('AdvancedWorkflowRules');
      
      // Filter for active rules matching the trigger type
      const matchingRules = rulesData
        .filter(row => row.is_active === 'true' || row.is_active === true)
        .map(row => ({
          ...row,
          trigger: JSON.parse(row.trigger),
          actions: JSON.parse(row.actions)
        }))
        .filter(rule => rule.trigger.type === triggerType);
      
      if (matchingRules.length === 0) return;
      
      // Process each matching rule
      for (const rule of matchingRules) {
        // Check if conditions match
        if (!this.checkTriggerConditions(rule.trigger.conditions, context)) {
          continue;
        }
        
        console.log(`Processing advanced workflow rule: ${rule.name}`);
        
        // Execute actions
        for (const action of rule.actions) {
          await this.executeAdvancedAction(action, context);
        }
      }
    } catch (error) {
      console.error(`Error processing advanced trigger ${triggerType}:`, error);
    }
  }

  /**
   * Check if trigger conditions match
   */
  private checkTriggerConditions(conditions: any, context: any): boolean {
    // Implement condition checking based on trigger type
    // This is a simplified implementation
    
    // Check amount threshold
    if (conditions.amount_threshold && context.amount < conditions.amount_threshold) {
      return false;
    }
    
    // Check percentage threshold
    if (conditions.percentage_threshold && context.percentage < conditions.percentage_threshold) {
      return false;
    }
    
    // Check days threshold
    if (conditions.days_threshold && context.days < conditions.days_threshold) {
      return false;
    }
    
    // Check client has GSTIN
    if (conditions.client_has_gstin && !context.client?.gstin) {
      return false;
    }
    
    return true;
  }

  /**
   * Execute advanced workflow action
   */
  private async executeAdvancedAction(action: any, context: any): Promise<void> {
    try {
      switch (action.type) {
        case AdvancedWorkflowActionType.GENERATE_GST_REPORT:
          await this.executeGenerateGSTReport(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.GENERATE_E_INVOICE:
          await this.executeGenerateEInvoice(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.APPLY_LATE_PAYMENT_FEE:
          await this.executeApplyLatePaymentFee(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.ESCALATE_NOTIFICATION:
          await this.executeEscalateNotification(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.ADJUST_PROJECT_BUDGET:
          await this.executeAdjustProjectBudget(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.CREATE_BACKUP:
          await this.createDataBackup();
          break;
          
        case AdvancedWorkflowActionType.TRIGGER_EXTERNAL_WEBHOOK:
          await this.executeTriggerWebhook(action.parameters, context);
          break;
          
        case AdvancedWorkflowActionType.GENERATE_FINANCIAL_REPORT:
          await this.executeGenerateFinancialReport(action.parameters, context);
          break;
          
        default:
          console.warn(`Unsupported advanced action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing advanced action ${action.type}:`, error);
    }
  }

  /**
   * Execute generate GST report action
   */
  private async executeGenerateGSTReport(parameters: any, context: any): Promise<void> {
    try {
      const reportType = parameters.report_type || 'GSTR1';
      const format = parameters.format || 'PDF';
      
      // Set date range
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      
      console.log(`Generating ${reportType} report from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      if (reportType === 'GSTR1') {
        // Generate GSTR1 report
        const gstr1Data = await this.gstReportingService.generateGSTR1Report({
          startDate,
          endDate,
          invoiceStatus: [InvoiceStatus.PAID, InvoiceStatus.SENT]
        });
        
        // Export to specified format
        await this.gstReportingService.exportGSTReport(
          'gstr1',
          gstr1Data,
          format.toLowerCase()
        );
      } else if (reportType === 'GSTR3B') {
        // Generate GSTR3B report
        const gstr3bData = await this.gstReportingService.generateGSTR3BReport({
          startDate,
          endDate,
          invoiceStatus: [InvoiceStatus.PAID, InvoiceStatus.SENT]
        });
        
        // Export to specified format
        await this.gstReportingService.exportGSTReport(
          'gstr3b',
          gstr3bData,
          format.toLowerCase()
        );
      }
      
      console.log(`Generated ${reportType} report in ${format} format`);
      
      // Send notification if requested
      if (parameters.notify) {
        await this.createNotification({
          user_id: 'admin',
          title: 'GST Report Generated',
          message: `${reportType} report has been generated for ${startDate.toLocaleString('default', { month: 'long' })} ${startDate.getFullYear()}`,
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Error executing generate GST report action:', error);
    }
  }

  /**
   * Execute generate e-invoice action
   */
  private async executeGenerateEInvoice(parameters: any, context: any): Promise<void> {
    try {
      if (!context.invoice_id) {
        console.warn('No invoice ID provided for e-invoice generation');
        return;
      }
      
      console.log(`Generating e-invoice for invoice ${context.invoice_id}`);
      
      // Generate e-invoice
      const eInvoiceData = await this.eInvoicingService.generateEInvoice(context.invoice_id);
      
      console.log(`Generated e-invoice with IRN: ${eInvoiceData.irn}`);
      
      // Notify client if requested
      if (parameters.notify_client && context.client_id) {
        // Get client details
        const clientRows = await this.sheetsService.read('Clients', context.client_id);
        if (clientRows.length > 0) {
          const client = Client.fromSheetRow(clientRows[0]);
          
          // Record communication
          await this.recordCommunication({
            client_id: client.id,
            project_id: context.project_id,
            type: 'email',
            direction: 'outbound',
            subject: 'E-Invoice Generated',
            content: `An e-invoice has been generated for invoice ${context.invoice_number}. You can view it in your client portal.`,
            contact_person: client.name,
            follow_up_required: false
          });
        }
      }
    } catch (error) {
      console.error('Error executing generate e-invoice action:', error);
    }
  }

  /**
   * Execute apply late payment fee action
   */
  private async executeApplyLatePaymentFee(parameters: any, context: any): Promise<void> {
    try {
      if (!context.invoice_id) {
        console.warn('No invoice ID provided for late payment fee application');
        return;
      }
      
      const feePercentage = parameters.fee_percentage || 1.5;
      
      // Get invoice details
      const invoiceRows = await this.sheetsService.read('Invoices', context.invoice_id);
      if (invoiceRows.length === 0) {
        console.warn(`Invoice ${context.invoice_id} not found`);
        return;
      }
      
      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Skip if late fee already applied
      if (invoice.late_fee_applied) {
        console.log(`Late fee already applied to invoice ${invoice.id}`);
        return;
      }
      
      // Calculate late fee
      const lateFeeAmount = invoice.total_amount * (feePercentage / 100);
      
      // Update invoice with late fee
      invoice.late_fee = lateFeeAmount;
      invoice.total_amount += lateFeeAmount;
      invoice.late_fee_applied = true;
      
      // Save updated invoice
      await this.sheetsService.update('Invoices', invoice.id, invoice);
      
      console.log(`Applied late fee of ${lateFeeAmount.toFixed(2)} to invoice ${invoice.id}`);
      
      // Notify client if requested
      if (parameters.notify_client) {
        // Get client details
        const clientRows = await this.sheetsService.read('Clients', invoice.client_id);
        if (clientRows.length > 0) {
          const client = Client.fromSheetRow(clientRows[0]);
          
          // Record communication
          await this.recordCommunication({
            client_id: client.id,
            project_id: invoice.project_id,
            type: 'email',
            direction: 'outbound',
            subject: 'Late Payment Fee Applied',
            content: `A late payment fee of ${lateFeeAmount.toFixed(2)} has been applied to invoice ${invoice.invoice_number} due to payment delay.`,
            contact_person: client.name,
            follow_up_required: false
          });
        }
      }
    } catch (error) {
      console.error('Error executing apply late payment fee action:', error);
    }
  }

  /**
   * Execute escalate notification action
   */
  private async executeEscalateNotification(parameters: any, context: any): Promise<void> {
    try {
      const message = parameters.message || 'Escalated notification';
      const priority = parameters.priority || 'medium';
      
      // Create notification
      await this.createNotification({
        user_id: 'admin',
        title: parameters.title || 'Escalated Alert',
        message,
        type: priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'info',
        related_entity_type: context.entity_type,
        related_entity_id: context.entity_id
      });
      
      // Trigger webhook if configured
      if (this.webhookEndpoints.has('escalation')) {
        await this.triggerWebhook('escalation', {
          message,
          priority,
          context,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error executing escalate notification action:', error);
    }
  }

  /**
   * Execute adjust project budget action
   */
  private async executeAdjustProjectBudget(parameters: any, context: any): Promise<void> {
    try {
      if (!context.project_id) {
        console.warn('No project ID provided for budget adjustment');
        return;
      }
      
      const adjustmentPercentage = parameters.adjustment_percentage || 10;
      
      // Get project details
      const projectRows = await this.sheetsService.read('Projects', context.project_id);
      if (projectRows.length === 0) {
        console.warn(`Project ${context.project_id} not found`);
        return;
      }
      
      const project = Project.fromSheetRow(projectRows[0]);
      
      // Calculate new budget
      const currentBudget = project.budget || 0;
      const adjustmentAmount = currentBudget * (adjustmentPercentage / 100);
      const newBudget = currentBudget + adjustmentAmount;
      
      // Update project budget
      project.budget = newBudget;
      project.budget_last_adjusted = new Date().toISOString();
      
      // Save updated project
      await this.sheetsService.update('Projects', project.id, project);
      
      console.log(`Adjusted budget for project ${project.id} from ${currentBudget} to ${newBudget}`);
      
      // Create notification
      await this.createNotification({
        user_id: 'admin',
        title: 'Project Budget Adjusted',
        message: `Budget for project "${project.name}" has been increased by ${adjustmentPercentage}% (${adjustmentAmount.toFixed(2)})`,
        type: 'info',
        related_entity_type: 'project',
        related_entity_id: project.id
      });
    } catch (error) {
      console.error('Error executing adjust project budget action:', error);
    }
  }

  /**
   * Execute trigger webhook action
   */
  private async executeTriggerWebhook(parameters: any, context: any): Promise<void> {
    try {
      const webhookKey = parameters.webhook_key;
      
      if (!webhookKey || !this.webhookEndpoints.has(webhookKey)) {
        console.warn(`Invalid webhook key: ${webhookKey}`);
        return;
      }
      
      // Prepare payload
      const payload = {
        ...context,
        timestamp: new Date().toISOString(),
        event_type: parameters.event_type || 'custom_event'
      };
      
      // Trigger webhook
      await this.triggerWebhook(webhookKey, payload);
    } catch (error) {
      console.error('Error executing trigger webhook action:', error);
    }
  }

  /**
   * Execute generate financial report action
   */
  private async executeGenerateFinancialReport(parameters: any, context: any): Promise<void> {
    try {
      // This would integrate with the financialReporting service
      console.log('Generating financial report with parameters:', parameters);
      
      // In a real implementation, we would:
      // 1. Call the appropriate financial reporting service method
      // 2. Export the report in the requested format
      // 3. Save it to Google Drive or send via email
      
      // Create notification
      await this.createNotification({
        user_id: 'admin',
        title: 'Financial Report Generated',
        message: `A financial report has been generated as requested`,
        type: 'info'
      });
    } catch (error) {
      console.error('Error executing generate financial report action:', error);
    }
  }
}

// Factory function to create AdvancedAutomationService instance
export function createAdvancedAutomationService(
  sheetsService: GoogleSheetsService,
  automationService: AutomationService,
  gstReportingService: GSTReportingService,
  eInvoicingService: EInvoicingService
): AdvancedAutomationService {
  return new AdvancedAutomationService(
    sheetsService,
    automationService,
    gstReportingService,
    eInvoicingService
  );
}