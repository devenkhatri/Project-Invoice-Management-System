"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentReminderService = void 0;
const uuid_1 = require("uuid");
const nodemailer_1 = __importDefault(require("nodemailer"));
const cron = __importStar(require("node-cron"));
class PaymentReminderService {
    constructor(sheetsService) {
        this.reminderJobs = new Map();
        this.sheetsService = sheetsService;
        this.setupEmailTransporter();
        this.startReminderScheduler();
    }
    setupEmailTransporter() {
        this.emailTransporter = nodemailer_1.default.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
    startReminderScheduler() {
        cron.schedule('0 * * * *', async () => {
            await this.processScheduledReminders();
        });
        cron.schedule('0 9 * * *', async () => {
            await this.scheduleUpcomingReminders();
        });
        cron.schedule('0 10 * * *', async () => {
            await this.processLateFees();
        });
    }
    async createReminderRule(invoiceId, type, daysOffset, template, method) {
        const invoice = await this.sheetsService.read('Invoices', invoiceId);
        if (!invoice || invoice.length === 0) {
            throw new Error('Invoice not found');
        }
        const invoiceData = invoice[0];
        const dueDate = new Date(invoiceData.due_date);
        let scheduledDate;
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
        const reminder = {
            id: (0, uuid_1.v4)(),
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
    async scheduleUpcomingReminders() {
        try {
            const unpaidInvoices = await this.sheetsService.query('Invoices', {
                status: ['sent', 'overdue']
            });
            for (const invoice of unpaidInvoices) {
                await this.scheduleRemindersForInvoice(invoice);
            }
        }
        catch (error) {
            console.error('Error scheduling reminders:', error);
        }
    }
    async scheduleRemindersForInvoice(invoice) {
        const dueDate = new Date(invoice.due_date);
        const now = new Date();
        const existingReminders = await this.sheetsService.query('Payment_Reminders', {
            invoice_id: invoice.id
        });
        const reminderTypes = [
            { type: 'before_due', daysOffset: 3 },
            { type: 'before_due', daysOffset: 1 },
            { type: 'on_due', daysOffset: 0 },
            { type: 'after_due', daysOffset: 1 },
            { type: 'after_due', daysOffset: 7 },
            { type: 'after_due', daysOffset: 14 }
        ];
        for (const reminderConfig of reminderTypes) {
            const exists = existingReminders.some(r => r.type === reminderConfig.type && r.days_offset === reminderConfig.daysOffset);
            if (!exists) {
                let scheduledDate;
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
                if (scheduledDate > now) {
                    await this.createReminderRule(invoice.id, reminderConfig.type, reminderConfig.daysOffset, this.getDefaultTemplate(reminderConfig.type, reminderConfig.daysOffset), 'email');
                }
            }
        }
    }
    async processScheduledReminders() {
        try {
            const now = new Date();
            const dueReminders = await this.sheetsService.query('Payment_Reminders', {
                status: 'scheduled',
                scheduled_at: { '<=': now.toISOString() }
            });
            for (const reminder of dueReminders) {
                await this.sendReminder(reminder);
            }
        }
        catch (error) {
            console.error('Error processing scheduled reminders:', error);
        }
    }
    async sendReminder(reminder) {
        try {
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
            if (reminder.method === 'email' || reminder.method === 'both') {
                await this.sendEmailReminder(reminder, invoiceData, clientData);
            }
            if (reminder.method === 'sms' || reminder.method === 'both') {
                await this.sendSMSReminder(reminder, invoiceData, clientData);
            }
            await this.sheetsService.update('Payment_Reminders', reminder.id, {
                status: 'sent',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        catch (error) {
            console.error(`Error sending reminder ${reminder.id}:`, error);
            await this.sheetsService.update('Payment_Reminders', reminder.id, {
                status: 'failed',
                updated_at: new Date().toISOString()
            });
        }
    }
    async sendEmailReminder(reminder, invoice, client) {
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
    async sendSMSReminder(reminder, invoice, client) {
        console.log(`SMS reminder would be sent to ${client.phone} for invoice ${invoice.invoice_number}`);
    }
    async createLateFeeRule(rule) {
        const id = (0, uuid_1.v4)();
        const lateFeeRule = { ...rule, id };
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
    async processLateFees() {
        try {
            const lateFeeRules = await this.sheetsService.query('Late_Fee_Rules', {
                is_active: true
            });
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
        }
        catch (error) {
            console.error('Error processing late fees:', error);
        }
    }
    async applyLateFeeIfEligible(invoice, rule) {
        const dueDate = new Date(invoice.due_date);
        const now = new Date();
        const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPastDue <= rule.grace_period_days) {
            return;
        }
        const existingLateFees = await this.sheetsService.query('Late_Fees', {
            invoice_id: invoice.id,
            rule_id: rule.id
        });
        if (existingLateFees.length > 0) {
            return;
        }
        let lateFeeAmount;
        if (rule.type === 'percentage') {
            lateFeeAmount = (invoice.total_amount * rule.amount) / 100;
        }
        else {
            lateFeeAmount = rule.amount;
        }
        if (rule.max_amount && lateFeeAmount > rule.max_amount) {
            lateFeeAmount = rule.max_amount;
        }
        await this.sheetsService.create('Late_Fees', {
            id: (0, uuid_1.v4)(),
            invoice_id: invoice.id,
            rule_id: rule.id,
            amount: lateFeeAmount,
            days_past_due: daysPastDue,
            applied_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        });
        const newTotal = invoice.total_amount + lateFeeAmount;
        await this.sheetsService.update('Invoices', invoice.id, {
            total_amount: newTotal,
            updated_at: new Date().toISOString()
        });
        await this.sendLateFeeNotification(invoice, lateFeeAmount);
    }
    async sendLateFeeNotification(invoice, lateFeeAmount) {
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
        }
        catch (error) {
            console.error('Error sending late fee notification:', error);
        }
    }
    getDefaultTemplate(type, daysOffset) {
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
    generateEmailSubject(type, invoice) {
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
    generateEmailBody(template, invoice, client) {
        return template
            .replace(/{{client_name}}/g, client.name)
            .replace(/{{invoice_number}}/g, invoice.invoice_number)
            .replace(/{{amount}}/g, invoice.total_amount.toFixed(2))
            .replace(/{{due_date}}/g, new Date(invoice.due_date).toLocaleDateString());
    }
}
exports.PaymentReminderService = PaymentReminderService;
//# sourceMappingURL=payment-reminder.service.js.map