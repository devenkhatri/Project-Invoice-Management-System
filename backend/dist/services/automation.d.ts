import { SheetsService } from './sheets.service';
import { Task } from '../types';
import { EventEmitter } from 'events';
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
    type: 'project_deadline' | 'invoice_due' | 'task_due' | 'task_completed' | 'project_milestone' | 'payment_received' | 'invoice_overdue' | 'proposal_accepted' | 'time_based';
    config: Record<string, any>;
}
export interface AutomationCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: any;
}
export interface AutomationAction {
    type: 'send_email' | 'send_sms' | 'create_task' | 'update_status' | 'generate_invoice' | 'apply_late_fee' | 'send_notification' | 'webhook' | 'create_project';
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
export declare class AutomationService extends EventEmitter {
    private static instance;
    sheetsService: SheetsService;
    private scheduledJobs;
    private isRunning;
    constructor();
    static getInstance(): AutomationService;
    private initializeAutomationSheets;
    start(): Promise<void>;
    stop(): Promise<void>;
    scheduleProjectDeadlineReminder(projectId: string, reminderConfig: ReminderConfig): Promise<string>;
    scheduleInvoicePaymentReminder(invoiceId: string, reminderConfig: ReminderConfig): Promise<string>;
    scheduleTaskDueReminder(taskId: string, reminderConfig: ReminderConfig): Promise<string>;
    scheduleClientFollowup(clientId: string, projectId: string, milestoneType: string, reminderConfig: ReminderConfig): Promise<string>;
    executeWorkflowTrigger(triggerType: string, entityId: string, triggerData: Record<string, any>): Promise<void>;
    onTaskCompleted(taskId: string): Promise<void>;
    onProjectMilestone(projectId: string, milestoneType: string, milestoneData: Record<string, any>): Promise<void>;
    onPaymentReceived(invoiceId: string, paymentAmount: number, paymentData: Record<string, any>): Promise<void>;
    onInvoiceOverdue(invoiceId: string): Promise<void>;
    convertProposalToInvoice(proposalId: string, acceptanceData: Record<string, any>): Promise<{
        invoiceId: string;
        projectId?: string;
    }>;
    sendNotification(type: 'email' | 'sms' | 'in_app' | 'webhook', recipient: string, templateId: string, variables: Record<string, any>): Promise<boolean>;
    createAutomationRule(ruleData: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
    updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>): Promise<boolean>;
    scheduleRecurringTask(taskData: Partial<Task>, recurringConfig: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
        interval: number;
        end_date?: string;
        max_occurrences?: number;
    }): Promise<string[]>;
    getAutomationAnalytics(dateRange: {
        start: string;
        end: string;
    }): Promise<{
        total_executions: number;
        successful_executions: number;
        failed_executions: number;
        execution_rate: number;
        most_triggered_rules: Array<{
            rule_id: string;
            rule_name: string;
            count: number;
        }>;
        performance_metrics: {
            avg_execution_time: number;
            total_notifications_sent: number;
            total_reminders_sent: number;
        };
    }>;
    private loadScheduledReminders;
    private startPeriodicChecks;
    private scheduleReminder;
    private calculateReminderDates;
    private adjustConfigForPriority;
    private executeProjectDeadlineReminder;
    private executeInvoicePaymentReminder;
    private executeTaskDueReminder;
    private executeClientFollowup;
    private executeWorkflowRule;
    private evaluateConditions;
    private executeWorkflowAction;
    private checkProjectCompletion;
    private cancelPendingReminders;
    private checkOverdueInvoices;
    private checkApproachingDeadlines;
    private cleanupOldExecutions;
    private executeScheduledReminder;
    private initializeDefaultTemplates;
    private initializeDefaultRules;
    private sendEmail;
    private sendSMS;
    private sendInAppNotification;
    private sendWebhook;
    private renderTemplate;
    private calculateDaysRemaining;
    private calculateDaysOverdue;
    private calculateDueDate;
    private calculateProjectEndDate;
    private logAutomationAction;
}
//# sourceMappingURL=automation.d.ts.map