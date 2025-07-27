import { SheetsService } from './sheets.service';
import { PaymentReminder, LateFeeRule } from '../types/payment';
export declare class PaymentReminderService {
    private sheetsService;
    private emailTransporter;
    private reminderJobs;
    constructor(sheetsService: SheetsService);
    private setupEmailTransporter;
    private startReminderScheduler;
    createReminderRule(invoiceId: string, type: PaymentReminder['type'], daysOffset: number, template: string, method: PaymentReminder['method']): Promise<string>;
    scheduleUpcomingReminders(): Promise<void>;
    private scheduleRemindersForInvoice;
    processScheduledReminders(): Promise<void>;
    private sendReminder;
    private sendEmailReminder;
    private sendSMSReminder;
    createLateFeeRule(rule: Omit<LateFeeRule, 'id'>): Promise<string>;
    processLateFees(): Promise<void>;
    private applyLateFeeIfEligible;
    private sendLateFeeNotification;
    private getDefaultTemplate;
    private generateEmailSubject;
    private generateEmailBody;
}
//# sourceMappingURL=payment-reminder.service.d.ts.map