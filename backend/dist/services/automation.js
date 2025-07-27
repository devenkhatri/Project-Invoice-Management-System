"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationService = void 0;
const sheets_service_1 = require("./sheets.service");
const types_1 = require("../types");
const events_1 = require("events");
class AutomationService extends events_1.EventEmitter {
    constructor() {
        super();
        this.scheduledJobs = new Map();
        this.isRunning = false;
        this.sheetsService = sheets_service_1.SheetsService.getInstance();
        this.initializeAutomationSheets();
    }
    static getInstance() {
        if (!AutomationService.instance) {
            AutomationService.instance = new AutomationService();
        }
        return AutomationService.instance;
    }
    async initializeAutomationSheets() {
        try {
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
            for (const sheet of automationSheets) {
                try {
                    await this.sheetsService.read(sheet.name);
                }
                catch (error) {
                    console.log(`Creating automation sheet: ${sheet.name}`);
                }
            }
            await this.initializeDefaultTemplates();
            await this.initializeDefaultRules();
        }
        catch (error) {
            console.error('Failed to initialize automation sheets:', error);
        }
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('Starting Automation Service...');
        await this.loadScheduledReminders();
        this.startPeriodicChecks();
        this.emit('service_started');
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        console.log('Stopping Automation Service...');
        this.scheduledJobs.forEach((timeout, id) => {
            clearTimeout(timeout);
        });
        this.scheduledJobs.clear();
        this.emit('service_stopped');
    }
    async scheduleProjectDeadlineReminder(projectId, reminderConfig) {
        try {
            const projects = await this.sheetsService.query('Projects', { id: projectId });
            if (projects.length === 0) {
                throw new Error(`Project not found: ${projectId}`);
            }
            const project = projects[0];
            const deadlineDate = new Date(project.end_date);
            const reminderDates = this.calculateReminderDates(deadlineDate, reminderConfig);
            const scheduleIds = [];
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
                this.scheduleReminder(scheduleId, reminderDate, async () => {
                    await this.executeProjectDeadlineReminder(projectId, reminderConfig);
                });
            }
            await this.logAutomationAction('project_deadline_reminder_scheduled', projectId, 'success', {
                reminder_dates: reminderDates.map(d => d.toISOString()),
                config: reminderConfig
            });
            return scheduleIds[0];
        }
        catch (error) {
            await this.logAutomationAction('project_deadline_reminder_scheduled', projectId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scheduleInvoicePaymentReminder(invoiceId, reminderConfig) {
        try {
            const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
            if (invoices.length === 0) {
                throw new Error(`Invoice not found: ${invoiceId}`);
            }
            const invoice = invoices[0];
            const dueDate = new Date(invoice.due_date);
            const reminderDates = this.calculateReminderDates(dueDate, reminderConfig);
            const scheduleIds = [];
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
                this.scheduleReminder(scheduleId, reminderDate, async () => {
                    await this.executeInvoicePaymentReminder(invoiceId, reminderConfig);
                });
            }
            await this.logAutomationAction('invoice_payment_reminder_scheduled', invoiceId, 'success', {
                reminder_dates: reminderDates.map(d => d.toISOString()),
                config: reminderConfig
            });
            return scheduleIds[0];
        }
        catch (error) {
            await this.logAutomationAction('invoice_payment_reminder_scheduled', invoiceId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scheduleTaskDueReminder(taskId, reminderConfig) {
        try {
            const tasks = await this.sheetsService.query('Tasks', { id: taskId });
            if (tasks.length === 0) {
                throw new Error(`Task not found: ${taskId}`);
            }
            const task = tasks[0];
            const dueDate = new Date(task.due_date);
            const priorityConfig = this.adjustConfigForPriority(reminderConfig, task.priority);
            const reminderDates = this.calculateReminderDates(dueDate, priorityConfig);
            const scheduleIds = [];
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
                this.scheduleReminder(scheduleId, reminderDate, async () => {
                    await this.executeTaskDueReminder(taskId, priorityConfig);
                });
            }
            await this.logAutomationAction('task_due_reminder_scheduled', taskId, 'success', {
                reminder_dates: reminderDates.map(d => d.toISOString()),
                config: priorityConfig
            });
            return scheduleIds[0];
        }
        catch (error) {
            await this.logAutomationAction('task_due_reminder_scheduled', taskId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scheduleClientFollowup(clientId, projectId, milestoneType, reminderConfig) {
        try {
            const scheduleId = await this.sheetsService.create('Reminder_Schedules', {
                type: 'client_followup',
                entity_id: `${clientId}:${projectId}:${milestoneType}`,
                scheduled_at: new Date().toISOString(),
                reminder_config: JSON.stringify(reminderConfig),
                status: 'pending',
                attempts: 0
            });
            await this.executeClientFollowup(clientId, projectId, milestoneType, reminderConfig);
            await this.logAutomationAction('client_followup_scheduled', clientId, 'success', {
                project_id: projectId,
                milestone_type: milestoneType,
                config: reminderConfig
            });
            return scheduleId;
        }
        catch (error) {
            await this.logAutomationAction('client_followup_scheduled', clientId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async executeWorkflowTrigger(triggerType, entityId, triggerData) {
        try {
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
        }
        catch (error) {
            console.error('Failed to execute workflow trigger:', error);
            await this.logAutomationAction('workflow_trigger_failed', entityId, 'error', {
                trigger_type: triggerType,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async onTaskCompleted(taskId) {
        try {
            const tasks = await this.sheetsService.query('Tasks', { id: taskId });
            if (tasks.length === 0)
                return;
            const task = tasks[0];
            await this.executeWorkflowTrigger('task_completed', taskId, {
                task_id: taskId,
                project_id: task.project_id,
                task_title: task.title,
                completion_date: new Date().toISOString()
            });
            await this.checkProjectCompletion(task.project_id);
            await this.logAutomationAction('task_completed_trigger', taskId, 'success', {
                project_id: task.project_id
            });
        }
        catch (error) {
            await this.logAutomationAction('task_completed_trigger', taskId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async onProjectMilestone(projectId, milestoneType, milestoneData) {
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
        }
        catch (error) {
            await this.logAutomationAction('project_milestone_trigger', projectId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async onPaymentReceived(invoiceId, paymentAmount, paymentData) {
        try {
            await this.executeWorkflowTrigger('payment_received', invoiceId, {
                invoice_id: invoiceId,
                payment_amount: paymentAmount,
                payment_data: paymentData,
                timestamp: new Date().toISOString()
            });
            await this.cancelPendingReminders('invoice_payment', invoiceId);
            await this.logAutomationAction('payment_received_trigger', invoiceId, 'success', {
                payment_amount: paymentAmount
            });
        }
        catch (error) {
            await this.logAutomationAction('payment_received_trigger', invoiceId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async onInvoiceOverdue(invoiceId) {
        try {
            const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
            if (invoices.length === 0)
                return;
            const invoice = invoices[0];
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
        }
        catch (error) {
            await this.logAutomationAction('invoice_overdue_trigger', invoiceId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async convertProposalToInvoice(proposalId, acceptanceData) {
        try {
            const invoiceData = {
                client_id: acceptanceData.client_id,
                project_id: acceptanceData.project_id,
                line_items: JSON.stringify(acceptanceData.line_items || []),
                subtotal: acceptanceData.subtotal || 0,
                tax_breakdown: JSON.stringify(acceptanceData.tax_breakdown || {}),
                total_amount: acceptanceData.total_amount || 0,
                currency: acceptanceData.currency || 'INR',
                status: types_1.InvoiceStatus.DRAFT,
                issue_date: new Date().toISOString().split('T')[0],
                due_date: this.calculateDueDate(acceptanceData.payment_terms || 'Net 30'),
                payment_terms: acceptanceData.payment_terms || 'Net 30',
                payment_status: 'pending',
                paid_amount: 0,
                is_recurring: false
            };
            const invoiceId = await this.sheetsService.create('Invoices', invoiceData);
            let projectId;
            if (acceptanceData.create_project) {
                const projectData = {
                    name: acceptanceData.project_name || `Project for ${acceptanceData.client_name}`,
                    client_id: acceptanceData.client_id,
                    status: types_1.ProjectStatus.ACTIVE,
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: acceptanceData.project_end_date || this.calculateProjectEndDate(),
                    budget: acceptanceData.total_amount || 0,
                    description: acceptanceData.project_description || '',
                    is_billable: true,
                    currency: acceptanceData.currency || 'INR'
                };
                projectId = await this.sheetsService.create('Projects', projectData);
                await this.sheetsService.update('Invoices', invoiceId, { project_id: projectId });
            }
            await this.logAutomationAction('proposal_converted', proposalId, 'success', {
                invoice_id: invoiceId,
                project_id: projectId
            });
            return { invoiceId, projectId };
        }
        catch (error) {
            await this.logAutomationAction('proposal_converted', proposalId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async sendNotification(type, recipient, templateId, variables) {
        try {
            const templates = await this.sheetsService.query('Notification_Templates', {
                id: templateId,
                is_active: true
            });
            if (templates.length === 0) {
                throw new Error(`Template not found: ${templateId}`);
            }
            const template = templates[0];
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
        }
        catch (error) {
            console.error('Failed to send notification:', error);
            return false;
        }
    }
    async createAutomationRule(ruleData) {
        try {
            const ruleId = await this.sheetsService.create('Automation_Rules', {
                ...ruleData,
                trigger: JSON.stringify(ruleData.trigger),
                conditions: JSON.stringify(ruleData.conditions),
                actions: JSON.stringify(ruleData.actions)
            });
            await this.logAutomationAction('automation_rule_created', ruleId, 'success', ruleData);
            return ruleId;
        }
        catch (error) {
            await this.logAutomationAction('automation_rule_created', '', 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async updateAutomationRule(ruleId, updates) {
        try {
            const updateData = { ...updates };
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
        }
        catch (error) {
            await this.logAutomationAction('automation_rule_updated', ruleId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scheduleRecurringTask(taskData, recurringConfig) {
        try {
            const taskIds = [];
            const startDate = new Date(taskData.due_date || new Date());
            let currentDate = new Date(startDate);
            let occurrences = 0;
            const maxOccurrences = recurringConfig.max_occurrences || 12;
            const endDate = recurringConfig.end_date ? new Date(recurringConfig.end_date) : null;
            while (occurrences < maxOccurrences) {
                if (endDate && currentDate > endDate)
                    break;
                const taskId = await this.sheetsService.create('Tasks', {
                    ...taskData,
                    due_date: currentDate.toISOString().split('T')[0],
                    title: `${taskData.title} (${occurrences + 1})`
                });
                taskIds.push(taskId);
                occurrences++;
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
        }
        catch (error) {
            await this.logAutomationAction('recurring_tasks_scheduled', '', 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getAutomationAnalytics(dateRange) {
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
            const ruleExecutions = executions.reduce((acc, exec) => {
                acc[exec.rule_id] = (acc[exec.rule_id] || 0) + 1;
                return acc;
            }, {});
            const rules = await this.sheetsService.read('Automation_Rules');
            const mostTriggeredRules = Object.entries(ruleExecutions)
                .map(([ruleId, count]) => {
                const rule = rules.find(r => r.id === ruleId);
                return {
                    rule_id: ruleId,
                    rule_name: rule?.name || 'Unknown Rule',
                    count: count
                };
            })
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const completedExecutions = executions.filter(e => e.status === 'completed' && e.completed_at);
            const avgExecutionTime = completedExecutions.length > 0
                ? completedExecutions.reduce((sum, exec) => {
                    const startTime = new Date(exec.started_at).getTime();
                    const endTime = new Date(exec.completed_at).getTime();
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
        }
        catch (error) {
            console.error('Failed to get automation analytics:', error);
            throw error;
        }
    }
    async loadScheduledReminders() {
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
        }
        catch (error) {
            console.error('Failed to load scheduled reminders:', error);
        }
    }
    startPeriodicChecks() {
        setInterval(async () => {
            if (!this.isRunning)
                return;
            await this.checkOverdueInvoices();
        }, 60 * 60 * 1000);
        setInterval(async () => {
            if (!this.isRunning)
                return;
            await this.checkApproachingDeadlines();
        }, 6 * 60 * 60 * 1000);
        setInterval(async () => {
            if (!this.isRunning)
                return;
            await this.cleanupOldExecutions();
        }, 24 * 60 * 60 * 1000);
    }
    scheduleReminder(reminderId, scheduledDate, callback) {
        const delay = scheduledDate.getTime() - Date.now();
        if (delay > 0) {
            const timeout = setTimeout(async () => {
                try {
                    await callback();
                    this.scheduledJobs.delete(reminderId);
                }
                catch (error) {
                    console.error(`Failed to execute reminder ${reminderId}:`, error);
                }
            }, delay);
            this.scheduledJobs.set(reminderId, timeout);
        }
    }
    calculateReminderDates(targetDate, config) {
        const dates = [];
        if (config.days_before) {
            const beforeDate = new Date(targetDate);
            beforeDate.setDate(beforeDate.getDate() - config.days_before);
            dates.push(beforeDate);
        }
        if (config.days_after) {
            const afterDate = new Date(targetDate);
            afterDate.setDate(afterDate.getDate() + config.days_after);
            dates.push(afterDate);
        }
        if (config.escalation_rules) {
            for (const rule of config.escalation_rules) {
                const escalationDate = new Date(targetDate);
                escalationDate.setDate(escalationDate.getDate() + rule.days_offset);
                dates.push(escalationDate);
            }
        }
        return dates.filter(date => date > new Date());
    }
    adjustConfigForPriority(config, priority) {
        const adjustedConfig = { ...config };
        switch (priority) {
            case types_1.TaskPriority.HIGH:
                if (adjustedConfig.days_before) {
                    adjustedConfig.days_before = Math.max(1, adjustedConfig.days_before - 1);
                }
                adjustedConfig.priority = 'high';
                break;
            case types_1.TaskPriority.MEDIUM:
                adjustedConfig.priority = 'medium';
                break;
            case types_1.TaskPriority.LOW:
                if (adjustedConfig.days_before) {
                    adjustedConfig.days_before = adjustedConfig.days_before + 1;
                }
                adjustedConfig.priority = 'low';
                break;
        }
        return adjustedConfig;
    }
    async executeProjectDeadlineReminder(projectId, config) {
        try {
            const projects = await this.sheetsService.query('Projects', { id: projectId });
            if (projects.length === 0)
                return;
            const project = projects[0];
            const clients = await this.sheetsService.query('Clients', { id: project.client_id });
            const client = clients[0];
            const variables = {
                project_name: project.name,
                client_name: client.name,
                deadline: project.end_date,
                days_remaining: this.calculateDaysRemaining(project.end_date)
            };
            await this.sendNotification(config.method, client.email, config.template, variables);
            await this.logAutomationAction('project_deadline_reminder_sent', projectId, 'success', {
                client_email: client.email,
                days_remaining: variables.days_remaining
            });
        }
        catch (error) {
            await this.logAutomationAction('project_deadline_reminder_sent', projectId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async executeInvoicePaymentReminder(invoiceId, config) {
        try {
            const invoices = await this.sheetsService.query('Invoices', { id: invoiceId });
            if (invoices.length === 0)
                return;
            const invoice = invoices[0];
            const clients = await this.sheetsService.query('Clients', { id: invoice.client_id });
            const client = clients[0];
            const variables = {
                invoice_number: invoice.invoice_number,
                client_name: client.name,
                amount: invoice.total_amount,
                due_date: invoice.due_date,
                days_overdue: this.calculateDaysOverdue(invoice.due_date)
            };
            await this.sendNotification(config.method, client.email, config.template, variables);
            await this.logAutomationAction('invoice_payment_reminder_sent', invoiceId, 'success', {
                client_email: client.email,
                amount: invoice.total_amount
            });
        }
        catch (error) {
            await this.logAutomationAction('invoice_payment_reminder_sent', invoiceId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async executeTaskDueReminder(taskId, config) {
        try {
            const tasks = await this.sheetsService.query('Tasks', { id: taskId });
            if (tasks.length === 0)
                return;
            const task = tasks[0];
            const projects = await this.sheetsService.query('Projects', { id: task.project_id });
            const project = projects[0];
            const clients = await this.sheetsService.query('Clients', { id: project.client_id });
            const client = clients[0];
            const variables = {
                task_title: task.title,
                project_name: project.name,
                client_name: client.name,
                due_date: task.due_date,
                priority: task.priority,
                days_remaining: this.calculateDaysRemaining(task.due_date)
            };
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
            await this.sendNotification(config.method, adminEmail, config.template, variables);
            await this.logAutomationAction('task_due_reminder_sent', taskId, 'success', {
                task_title: task.title,
                priority: task.priority
            });
        }
        catch (error) {
            await this.logAutomationAction('task_due_reminder_sent', taskId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async executeClientFollowup(clientId, projectId, milestoneType, config) {
        try {
            const clients = await this.sheetsService.query('Clients', { id: clientId });
            const projects = await this.sheetsService.query('Projects', { id: projectId });
            if (clients.length === 0 || projects.length === 0)
                return;
            const client = clients[0];
            const project = projects[0];
            const variables = {
                client_name: client.name,
                project_name: project.name,
                milestone_type: milestoneType,
                project_status: project.status,
                completion_percentage: project.progress_percentage || 0
            };
            await this.sendNotification(config.method, client.email, config.template, variables);
            await this.logAutomationAction('client_followup_sent', clientId, 'success', {
                project_id: projectId,
                milestone_type: milestoneType
            });
        }
        catch (error) {
            await this.logAutomationAction('client_followup_sent', clientId, 'error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async executeWorkflowRule(rule, entityId, triggerData) {
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
            const conditionsMet = await this.evaluateConditions(conditions, entityId, triggerData);
            if (!conditionsMet) {
                await this.sheetsService.update('Workflow_Executions', executionId, {
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    error_message: 'Conditions not met'
                });
                return;
            }
            const executedActions = [];
            for (const action of actions) {
                try {
                    await this.executeWorkflowAction(action, entityId, triggerData);
                    executedActions.push(action.type);
                }
                catch (actionError) {
                    console.error(`Failed to execute action ${action.type}:`, actionError);
                }
            }
            await this.sheetsService.update('Workflow_Executions', executionId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                actions_executed: JSON.stringify(executedActions)
            });
        }
        catch (error) {
            console.error('Failed to execute workflow rule:', error);
        }
    }
    async evaluateConditions(conditions, entityId, triggerData) {
        for (const condition of conditions) {
            const value = triggerData[condition.field];
            switch (condition.operator) {
                case 'eq':
                    if (value !== condition.value)
                        return false;
                    break;
                case 'ne':
                    if (value === condition.value)
                        return false;
                    break;
                case 'gt':
                    if (value <= condition.value)
                        return false;
                    break;
                case 'lt':
                    if (value >= condition.value)
                        return false;
                    break;
                case 'gte':
                    if (value < condition.value)
                        return false;
                    break;
                case 'lte':
                    if (value > condition.value)
                        return false;
                    break;
                case 'contains':
                    if (!String(value).includes(String(condition.value)))
                        return false;
                    break;
                case 'in':
                    if (!Array.isArray(condition.value) || !condition.value.includes(value))
                        return false;
                    break;
            }
        }
        return true;
    }
    async executeWorkflowAction(action, entityId, triggerData) {
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
                break;
            case 'apply_late_fee':
                break;
            case 'send_notification':
                await this.sendNotification('in_app', action.config.recipient, action.config.template, triggerData);
                break;
            case 'webhook':
                await this.sendWebhook(action.config.url, triggerData);
                break;
        }
    }
    async checkProjectCompletion(projectId) {
        try {
            const tasks = await this.sheetsService.query('Tasks', { project_id: projectId });
            const completedTasks = tasks.filter(task => task.status === types_1.TaskStatus.COMPLETED);
            if (tasks.length > 0 && completedTasks.length === tasks.length) {
                await this.sheetsService.update('Projects', projectId, {
                    status: types_1.ProjectStatus.COMPLETED,
                    progress_percentage: 100
                });
                await this.onProjectMilestone(projectId, 'project_completed', {
                    total_tasks: tasks.length,
                    completion_date: new Date().toISOString()
                });
            }
        }
        catch (error) {
            console.error('Failed to check project completion:', error);
        }
    }
    async cancelPendingReminders(type, entityId) {
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
                if (this.scheduledJobs.has(reminder.id)) {
                    clearTimeout(this.scheduledJobs.get(reminder.id));
                    this.scheduledJobs.delete(reminder.id);
                }
            }
        }
        catch (error) {
            console.error('Failed to cancel pending reminders:', error);
        }
    }
    async checkOverdueInvoices() {
        try {
            const invoices = await this.sheetsService.query('Invoices', {
                status: [types_1.InvoiceStatus.SENT],
                payment_status: ['pending', 'partial']
            });
            const now = new Date();
            for (const invoice of invoices) {
                const dueDate = new Date(invoice.due_date);
                if (now > dueDate) {
                    await this.sheetsService.update('Invoices', invoice.id, {
                        status: types_1.InvoiceStatus.OVERDUE
                    });
                    await this.onInvoiceOverdue(invoice.id);
                }
            }
        }
        catch (error) {
            console.error('Failed to check overdue invoices:', error);
        }
    }
    async checkApproachingDeadlines() {
        try {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            const projects = await this.sheetsService.query('Projects', {
                status: types_1.ProjectStatus.ACTIVE,
                end_date: {
                    '<=': threeDaysFromNow.toISOString().split('T')[0]
                }
            });
            for (const project of projects) {
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
            const tasks = await this.sheetsService.query('Tasks', {
                status: [types_1.TaskStatus.TODO, types_1.TaskStatus.IN_PROGRESS],
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
                        priority: task.priority === types_1.TaskPriority.HIGH ? 'high' : 'medium'
                    });
                }
            }
        }
        catch (error) {
            console.error('Failed to check approaching deadlines:', error);
        }
    }
    async cleanupOldExecutions() {
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
            const oldLogs = await this.sheetsService.query('Automation_Logs', {
                timestamp: {
                    '<': thirtyDaysAgo.toISOString()
                }
            });
            for (const log of oldLogs) {
                await this.sheetsService.delete('Automation_Logs', log.id);
            }
        }
        catch (error) {
            console.error('Failed to cleanup old executions:', error);
        }
    }
    async executeScheduledReminder(reminder) {
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
        }
        catch (error) {
            await this.sheetsService.update('Reminder_Schedules', reminder.id, {
                status: 'failed',
                attempts: reminder.attempts + 1,
                last_attempt_at: new Date().toISOString()
            });
            console.error('Failed to execute scheduled reminder:', error);
        }
    }
    async initializeDefaultTemplates() {
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
        }
        catch (error) {
            console.error('Failed to initialize default templates:', error);
        }
    }
    async initializeDefaultRules() {
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
        }
        catch (error) {
            console.error('Failed to initialize default rules:', error);
        }
    }
    async sendEmail(recipient, subject, content) {
        try {
            console.log(`Sending email to ${recipient}: ${subject}`);
            console.log(`Content: ${content}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
        }
        catch (error) {
            console.error('Failed to send email:', error);
            return false;
        }
    }
    async sendSMS(recipient, content) {
        try {
            console.log(`Sending SMS to ${recipient}: ${content}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
        }
        catch (error) {
            console.error('Failed to send SMS:', error);
            return false;
        }
    }
    async sendInAppNotification(recipient, content) {
        try {
            console.log(`Sending in-app notification to ${recipient}: ${content}`);
            await this.sheetsService.create('In_App_Notifications', {
                recipient,
                content,
                status: 'unread',
                created_at: new Date().toISOString()
            });
            return true;
        }
        catch (error) {
            console.error('Failed to send in-app notification:', error);
            return false;
        }
    }
    async sendWebhook(url, data) {
        try {
            console.log(`Sending webhook to ${url}:`, data);
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
        }
        catch (error) {
            console.error('Failed to send webhook:', error);
            return false;
        }
    }
    renderTemplate(template, variables) {
        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
        }
        return rendered;
    }
    calculateDaysRemaining(dateString) {
        const targetDate = new Date(dateString);
        const now = new Date();
        const diffTime = targetDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    calculateDaysOverdue(dateString) {
        const targetDate = new Date(dateString);
        const now = new Date();
        const diffTime = now.getTime() - targetDate.getTime();
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
    calculateDueDate(paymentTerms) {
        const match = paymentTerms.match(/(\d+)/);
        const days = match ? parseInt(match[1]) : 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate.toISOString().split('T')[0];
    }
    calculateProjectEndDate() {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
        return endDate.toISOString().split('T')[0];
    }
    async logAutomationAction(action, entityId, status, details) {
        try {
            await this.sheetsService.create('Automation_Logs', {
                type: 'automation',
                entity_id: entityId,
                action,
                status,
                details: JSON.stringify(details),
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Failed to log automation action:', error);
        }
    }
}
exports.AutomationService = AutomationService;
//# sourceMappingURL=automation.js.map