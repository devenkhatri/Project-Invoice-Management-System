import { SheetsService } from './sheets.service';
import { PaymentReminder, LateFeeRule } from '../types/payment';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import * as cron from 'node-cron';

export class PaymentReminderService {
  private sheetsService: SheetsService;
  private emailTransporter!: nodemailer.Transporter;
  private reminderJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(sheetsService: SheetsService) {
    this.sheetsService = sheetsService;
    this.setupEmailTransporter();
    this.startReminderScheduler();
  }

  private setupEmailTransporter(): void {
    this.emailTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  private startReminderScheduler(): void {
    // Run every hour to check for due reminders
    cron.schedule('0 * * * *', async () => {
      await this.processScheduledReminders();
    });

    // Run daily at 9 AM to schedule new reminders
    cron.schedule('0 9 * * *', async () => {
      await this.scheduleUpcomingReminders();
    });

    // Run daily at 10 AM to process late fees
    cron.schedule('0 10 * * *', async () => {
      await this.processLateFees();
    });
  }

  async createReminderRule(invoiceId: string, type: PaymentReminder['type'], daysOffset: number, template: string, method: PaymentReminder['method']): Promise<string> {
    const invoice = await this.sheetsService.read('Invoices', invoiceId);
    if (!invoice || invoice.length === 0) {
      throw new Error('Invoice not found');
    }

    const invoiceData = invoice[0];
    const dueDate = new Date(invoiceData.due_date);
    
    let scheduledDate: Date;
    switch (type) {
      case 'before_due':
        scheduledDate = new Date(dueDate.getTime() - (daysOffset * 24 * 60 * 60 * 1000));
        break;
      case 'on_due':
        scheduledDate = dueDate;
        break;
      case 'after_due':
        scheduledDate = new Date(dueDate.getTime() + (daysOffset * 24 * 60 * 60 * 1000));
        break;
    }

    const reminder: PaymentReminder = {
      id: uuidv4(),
      invoiceId,
      type,
      daysOffset,
      template,
      method,
      status: 'scheduled',
      scheduledAt: scheduledDate
    };

    await this.sheetsService.create('Payment_Reminders', {
      id: reminder.id,
      invoice_id: reminder.invoiceId,
      type: reminder.type,
      days_offset: reminder.daysOffset,
      template: reminder.template,
      method: reminder.method,
      status: reminder.status,
      scheduled_at: reminder.scheduledAt.toISOString(),
      created_at: new Date().toISOString()
    });

    return reminder.id;
  }

  async scheduleUpcomingReminders(): Promise<void> {
    try {
      // Get all unpaid invoices
      const unpaidInvoices = await this.sheetsService.query('Invoices', {
        status: ['sent', 'overdue']
      });

      for (const invoice of unpaidInvoices) {
        await this.scheduleRemindersForInvoice(invoice);
      }
    } catch (error) {
      console.error('Error scheduling reminders:', error);
    }
  }

  private async scheduleRemindersForInvoice(invoice: any): Promise<void> {
    const dueDate = new Date(invoice.due_date);
    const now = new Date();
    
    // Check if we already have reminders for this invoice
    const existingReminders = await this.sheetsService.query('Payment_Reminders', {
      invoice_id: invoice.id
    });

    const reminderTypes = [
      { type: 'before_due' as const, daysOffset: 3 },
      { type: 'before_due' as const, daysOffset: 1 },
      { type: 'on_due' as const, daysOffset: 0 },
      { type: 'after_due' as const, daysOffset: 1 },
      { type: 'after_due' as const, daysOffset: 7 },
      { type: 'after_due' as const, daysOffset: 14 }
    ];

    for (const reminderConfig of reminderTypes) {
      // Check if reminder already exists
      const exists = existingReminders.some(r => 
        r.type === reminderConfig.type && r.days_offset === reminderConfig.daysOffset
      );

      if (!exists) {
        let scheduledDate: Date;
        switch (reminderConfig.type) {
          case 'before_due':
            scheduledDate = new Date(dueDate.getTime() - (reminderConfig.daysOffset * 24 * 60 * 60 * 1000));
            break;
          case 'on_due':
            scheduledDate = dueDate;
            break;
          case 'after_due':
            scheduledDate = new Date(dueDate.getTime() + (reminderConfig.daysOffset * 24 * 60 * 60 * 1000));
            break;
        }

        // Only schedule if the reminder date is in the future
        if (scheduledDate > now) {
          await this.createReminderRule(
            invoice.id,
            reminderConfig.type,
            reminderConfig.daysOffset,
            this.getDefaultTemplate(reminderConfig.type, reminderConfig.daysOffset),
            'email'
          );
        }
      }
    }
  }

  async processScheduledReminders(): Promise<void> {
    try {
      const now = new Date();
      const dueReminders = await this.sheetsService.query('Payment_Reminders', {
        status: 'scheduled',
        scheduled_at: { '<=': now.toISOString() }
      });

      for (const reminder of dueReminders) {
        await this.sendReminder(reminder);
      }
    } catch (error) {
      console.error('Error processing scheduled reminders:', error);
    }
  }

  private async sendReminder(reminder: any): Promise<void> {
    try {
      // Get invoice and client details
      const invoice = await this.sheetsService.read('Invoices', reminder.invoice_id);
      if (!invoice || invoice.length === 0) {
        return;
      }

      const invoiceData = invoice[0];
      const client = await this.sheetsService.read('Clients', invoiceData.client_id);
      if (!client || client.length === 0) {
        return;
      }

      const clientData = client[0];

      // Send email reminder
      if (reminder.method === 'email' || reminder.method === 'both') {
        await this.sendEmailReminder(reminder, invoiceData, clientData);
      }

      // Send SMS reminder (placeholder - would need SMS service integration)
      if (reminder.method === 'sms' || reminder.method === 'both') {
        await this.sendSMSReminder(reminder, invoiceData, clientData);
      }

      // Update reminder status
      await this.sheetsService.update('Payment_Reminders', reminder.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error sending reminder ${reminder.id}:`, error);
      
      // Update reminder status to failed
      await this.sheetsService.update('Payment_Reminders', reminder.id, {
        status: 'failed',
        updated_at: new Date().toISOString()
      });
    }
  }

  private async sendEmailReminder(reminder: any, invoice: any, client: any): Promise<void> {
    const subject = this.generateEmailSubject(reminder.type, invoice);
    const body = this.generateEmailBody(reminder.template, invoice, client);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject,
      html: body
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  private async sendSMSReminder(reminder: any, invoice: any, client: any): Promise<void> {
    // Placeholder for SMS integration
    // Would integrate with services like Twilio, AWS SNS, etc.
    console.log(`SMS reminder would be sent to ${client.phone} for invoice ${invoice.invoice_number}`);
  }

  async createLateFeeRule(rule: Omit<LateFeeRule, 'id'>): Promise<string> {
    const id = uuidv4();
    const lateFeeRule: LateFeeRule = { ...rule, id };

    await this.sheetsService.create('Late_Fee_Rules', {
      id: lateFeeRule.id,
      name: lateFeeRule.name,
      type: lateFeeRule.type,
      amount: lateFeeRule.amount,
      grace_period_days: lateFeeRule.gracePeriodDays,
      max_amount: lateFeeRule.maxAmount,
      compounding_frequency: lateFeeRule.compoundingFrequency,
      is_active: lateFeeRule.isActive,
      created_at: new Date().toISOString()
    });

    return id;
  }

  async processLateFees(): Promise<void> {
    try {
      // Get active late fee rules
      const lateFeeRules = await this.sheetsService.query('Late_Fee_Rules', {
        is_active: true
      });

      // Get overdue invoices
      const now = new Date();
      const overdueInvoices = await this.sheetsService.query('Invoices', {
        status: 'overdue',
        due_date: { '<': now.toISOString() }
      });

      for (const invoice of overdueInvoices) {
        for (const rule of lateFeeRules) {
          await this.applyLateFeeIfEligible(invoice, rule);
        }
      }
    } catch (error) {
      console.error('Error processing late fees:', error);
    }
  }

  private async applyLateFeeIfEligible(invoice: any, rule: any): Promise<void> {
    const dueDate = new Date(invoice.due_date);
    const now = new Date();
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPastDue <= rule.grace_period_days) {
      return; // Still in grace period
    }

    // Check if late fee already applied for this rule
    const existingLateFees = await this.sheetsService.query('Late_Fees', {
      invoice_id: invoice.id,
      rule_id: rule.id
    });

    if (existingLateFees.length > 0) {
      return; // Late fee already applied
    }

    // Calculate late fee amount
    let lateFeeAmount: number;
    if (rule.type === 'percentage') {
      lateFeeAmount = (invoice.total_amount * rule.amount) / 100;
    } else {
      lateFeeAmount = rule.amount;
    }

    // Apply maximum amount limit if specified
    if (rule.max_amount && lateFeeAmount > rule.max_amount) {
      lateFeeAmount = rule.max_amount;
    }

    // Create late fee record
    await this.sheetsService.create('Late_Fees', {
      id: uuidv4(),
      invoice_id: invoice.id,
      rule_id: rule.id,
      amount: lateFeeAmount,
      days_past_due: daysPastDue,
      applied_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    // Update invoice total
    const newTotal = invoice.total_amount + lateFeeAmount;
    await this.sheetsService.update('Invoices', invoice.id, {
      total_amount: newTotal,
      updated_at: new Date().toISOString()
    });

    // Send late fee notification
    await this.sendLateFeeNotification(invoice, lateFeeAmount);
  }

  private async sendLateFeeNotification(invoice: any, lateFeeAmount: number): Promise<void> {
    try {
      const client = await this.sheetsService.read('Clients', invoice.client_id);
      if (!client || client.length === 0) {
        return;
      }

      const clientData = client[0];

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientData.email,
        subject: `Late Fee Applied - Invoice ${invoice.invoice_number}`,
        html: `
          <h2>Late Fee Applied</h2>
          <p>Dear ${clientData.name},</p>
          <p>A late fee of $${lateFeeAmount.toFixed(2)} has been applied to invoice ${invoice.invoice_number} due to overdue payment.</p>
          <p>Please make payment at your earliest convenience to avoid additional fees.</p>
          <p>Thank you for your attention to this matter.</p>
        `
      };

      await this.emailTransporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending late fee notification:', error);
    }
  }

  private getDefaultTemplate(type: PaymentReminder['type'], daysOffset: number): string {
    switch (type) {
      case 'before_due':
        return `
          <h2>Payment Reminder</h2>
          <p>Dear {{client_name}},</p>
          <p>This is a friendly reminder that invoice {{invoice_number}} for $\{{amount}} is due in ${daysOffset} day(s).</p>
          <p>Please ensure payment is made by {{due_date}} to avoid any late fees.</p>
          <p>Thank you for your business!</p>
        `;
      case 'on_due':
        return `
          <h2>Payment Due Today</h2>
          <p>Dear {{client_name}},</p>
          <p>Invoice {{invoice_number}} for $\{{amount}} is due today.</p>
          <p>Please make payment at your earliest convenience.</p>
          <p>Thank you!</p>
        `;
      case 'after_due':
        return `
          <h2>Overdue Payment Notice</h2>
          <p>Dear {{client_name}},</p>
          <p>Invoice {{invoice_number}} for $\{{amount}} is now ${daysOffset} day(s) overdue.</p>
          <p>Please make payment immediately to avoid additional late fees.</p>
          <p>If you have any questions, please contact us.</p>
        `;
      default:
        return 'Payment reminder for invoice {{invoice_number}}';
    }
  }

  private generateEmailSubject(type: PaymentReminder['type'], invoice: any): string {
    switch (type) {
      case 'before_due':
        return `Payment Reminder - Invoice ${invoice.invoice_number}`;
      case 'on_due':
        return `Payment Due Today - Invoice ${invoice.invoice_number}`;
      case 'after_due':
        return `Overdue Payment - Invoice ${invoice.invoice_number}`;
      default:
        return `Payment Reminder - Invoice ${invoice.invoice_number}`;
    }
  }

  private generateEmailBody(template: string, invoice: any, client: any): string {
    return template
      .replace(/{{client_name}}/g, client.name)
      .replace(/{{invoice_number}}/g, invoice.invoice_number)
      .replace(/{{amount}}/g, invoice.total_amount.toFixed(2))
      .replace(/{{due_date}}/g, new Date(invoice.due_date).toLocaleDateString());
  }
}