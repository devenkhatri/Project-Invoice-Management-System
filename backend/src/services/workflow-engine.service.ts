import { SheetsService } from './sheets.service';
import { EventEmitter } from 'events';

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTrigger {
  type: 'invoice_created' | 'invoice_paid' | 'project_completed' | 'task_completed' | 'payment_overdue' | 'client_created' | 'time_entry_added';
  entityType: 'invoice' | 'project' | 'task' | 'client' | 'payment' | 'time_entry';
  event: string;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowAction {
  type: 'send_email' | 'send_sms' | 'create_task' | 'update_status' | 'create_invoice' | 'send_webhook' | 'create_reminder' | 'update_field';
  parameters: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  ruleId: string;
  triggerData: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  actionResults: any[];
}

export class WorkflowEngineService extends EventEmitter {
  private sheetsService: SheetsService;
  private activeRules: Map<string, WorkflowRule> = new Map();

  constructor() {
    super();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
    this.sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
    this.loadWorkflowRules();
  }

  private async loadWorkflowRules(): Promise<void> {
    try {
      const rules = await this.sheetsService.read('Workflow_Rules');
      for (const rule of rules) {
        if (rule.enabled) {
          this.activeRules.set(rule.id, rule);
        }
      }
    } catch (error) {
      console.error('Failed to load workflow rules:', error);
    }
  }

  async createWorkflowRule(rule: Omit<WorkflowRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newRule: WorkflowRule = {
        ...rule,
        id: this.generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const ruleId = await this.sheetsService.create('Workflow_Rules', newRule);
      
      if (newRule.enabled) {
        this.activeRules.set(ruleId, newRule);
      }

      return ruleId;
    } catch (error) {
      throw new Error(`Failed to create workflow rule: ${error.message}`);
    }
  }

  async updateWorkflowRule(ruleId: string, updates: Partial<WorkflowRule>): Promise<boolean> {
    try {
      const updatedRule = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const success = await this.sheetsService.update('Workflow_Rules', ruleId, updatedRule);
      
      if (success) {
        // Reload rules to update active rules map
        await this.loadWorkflowRules();
      }

      return success;
    } catch (error) {
      throw new Error(`Failed to update workflow rule: ${error.message}`);
    }
  }

  async deleteWorkflowRule(ruleId: string): Promise<boolean> {
    try {
      const success = await this.sheetsService.delete('Workflow_Rules', ruleId);
      
      if (success) {
        this.activeRules.delete(ruleId);
      }

      return success;
    } catch (error) {
      throw new Error(`Failed to delete workflow rule: ${error.message}`);
    }
  }

  async triggerWorkflow(triggerType: string, entityType: string, data: any): Promise<void> {
    try {
      const matchingRules = Array.from(this.activeRules.values()).filter(rule => 
        rule.trigger.type === triggerType && rule.trigger.entityType === entityType
      );

      for (const rule of matchingRules) {
        if (await this.evaluateConditions(rule.conditions, data)) {
          await this.executeWorkflow(rule, data);
        }
      }
    } catch (error) {
      console.error('Workflow trigger error:', error);
    }
  }

  private async evaluateConditions(conditions: WorkflowCondition[], data: any): Promise<boolean> {
    if (!conditions.length) return true;

    let result = true;
    let currentLogicalOperator = 'AND';

    for (const condition of conditions) {
      const conditionResult = this.evaluateCondition(condition, data);
      
      if (currentLogicalOperator === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      currentLogicalOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  private evaluateCondition(condition: WorkflowCondition, data: any): boolean {
    const fieldValue = this.getFieldValue(data, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      case 'is_empty':
        return !fieldValue || fieldValue === '';
      case 'is_not_empty':
        return fieldValue && fieldValue !== '';
      default:
        return false;
    }
  }

  private getFieldValue(data: any, fieldPath: string): any {
    return fieldPath.split('.').reduce((obj, key) => obj?.[key], data);
  }

  private async executeWorkflow(rule: WorkflowRule, triggerData: any): Promise<void> {
    const execution: WorkflowExecution = {
      id: this.generateId(),
      ruleId: rule.id,
      triggerData,
      status: 'running',
      startedAt: new Date().toISOString(),
      actionResults: []
    };

    try {
      // Store execution record
      await this.sheetsService.create('Workflow_Executions', execution);

      // Execute actions
      for (const action of rule.actions) {
        const result = await this.executeAction(action, triggerData);
        execution.actionResults.push(result);
      }

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();

      // Update execution record
      await this.sheetsService.update('Workflow_Executions', execution.id, execution);

      this.emit('workflow_completed', { rule, execution });
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();

      await this.sheetsService.update('Workflow_Executions', execution.id, execution);

      this.emit('workflow_failed', { rule, execution, error });
    }
  }

  private async executeAction(action: WorkflowAction, triggerData: any): Promise<any> {
    switch (action.type) {
      case 'send_email':
        return await this.sendEmail(action.parameters, triggerData);
      case 'send_sms':
        return await this.sendSMS(action.parameters, triggerData);
      case 'create_task':
        return await this.createTask(action.parameters, triggerData);
      case 'update_status':
        return await this.updateStatus(action.parameters, triggerData);
      case 'create_invoice':
        return await this.createInvoice(action.parameters, triggerData);
      case 'send_webhook':
        return await this.sendWebhook(action.parameters, triggerData);
      case 'create_reminder':
        return await this.createReminder(action.parameters, triggerData);
      case 'update_field':
        return await this.updateField(action.parameters, triggerData);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async sendEmail(parameters: any, triggerData: any): Promise<any> {
    // Implementation for sending email
    const emailData = {
      to: this.interpolateTemplate(parameters.to, triggerData),
      subject: this.interpolateTemplate(parameters.subject, triggerData),
      body: this.interpolateTemplate(parameters.body, triggerData)
    };

    // Use your email service here
    console.log('Sending email:', emailData);
    return { success: true, emailData };
  }

  private async sendSMS(parameters: any, triggerData: any): Promise<any> {
    // Implementation for sending SMS
    const smsData = {
      to: this.interpolateTemplate(parameters.to, triggerData),
      message: this.interpolateTemplate(parameters.message, triggerData)
    };

    console.log('Sending SMS:', smsData);
    return { success: true, smsData };
  }

  private async createTask(parameters: any, triggerData: any): Promise<any> {
    const taskData = {
      title: this.interpolateTemplate(parameters.title, triggerData),
      description: this.interpolateTemplate(parameters.description, triggerData),
      project_id: parameters.project_id || triggerData.project_id,
      priority: parameters.priority || 'medium',
      status: 'todo',
      created_at: new Date().toISOString()
    };

    const taskId = await this.sheetsService.create('Tasks', taskData);
    return { success: true, taskId, taskData };
  }

  private async updateStatus(parameters: any, triggerData: any): Promise<any> {
    const { entityType, entityId, newStatus } = parameters;
    const sheetName = this.getSheetName(entityType);
    
    const success = await this.sheetsService.update(sheetName, entityId || triggerData.id, {
      status: newStatus,
      updated_at: new Date().toISOString()
    });

    return { success, entityType, entityId, newStatus };
  }

  private async createInvoice(parameters: any, triggerData: any): Promise<any> {
    const invoiceData = {
      client_id: parameters.client_id || triggerData.client_id,
      project_id: parameters.project_id || triggerData.project_id,
      amount: parameters.amount || triggerData.amount,
      description: this.interpolateTemplate(parameters.description, triggerData),
      status: 'draft',
      created_at: new Date().toISOString()
    };

    const invoiceId = await this.sheetsService.create('Invoices', invoiceData);
    return { success: true, invoiceId, invoiceData };
  }

  private async sendWebhook(parameters: any, triggerData: any): Promise<any> {
    const webhookData = {
      url: parameters.url,
      method: parameters.method || 'POST',
      headers: parameters.headers || { 'Content-Type': 'application/json' },
      payload: {
        ...triggerData,
        ...parameters.payload
      }
    };

    try {
      const response = await fetch(webhookData.url, {
        method: webhookData.method,
        headers: webhookData.headers,
        body: JSON.stringify(webhookData.payload)
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async createReminder(parameters: any, triggerData: any): Promise<any> {
    const reminderData = {
      title: this.interpolateTemplate(parameters.title, triggerData),
      description: this.interpolateTemplate(parameters.description, triggerData),
      due_date: parameters.due_date,
      entity_type: parameters.entity_type,
      entity_id: parameters.entity_id || triggerData.id,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const reminderId = await this.sheetsService.create('Reminders', reminderData);
    return { success: true, reminderId, reminderData };
  }

  private async updateField(parameters: any, triggerData: any): Promise<any> {
    const { entityType, entityId, field, value } = parameters;
    const sheetName = this.getSheetName(entityType);
    
    const updateData = {
      [field]: this.interpolateTemplate(value, triggerData),
      updated_at: new Date().toISOString()
    };

    const success = await this.sheetsService.update(sheetName, entityId || triggerData.id, updateData);
    return { success, entityType, entityId, field, value };
  }

  private interpolateTemplate(template: string, data: any): string {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      return this.getFieldValue(data, path.trim()) || match;
    });
  }

  private getSheetName(entityType: string): string {
    const mapping: Record<string, string> = {
      'project': 'Projects',
      'task': 'Tasks',
      'client': 'Clients',
      'invoice': 'Invoices',
      'payment': 'Payments',
      'time_entry': 'Time_Entries',
      'expense': 'Expenses'
    };

    return mapping[entityType] || entityType;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getWorkflowRules(): Promise<WorkflowRule[]> {
    return await this.sheetsService.read('Workflow_Rules');
  }

  async getWorkflowExecutions(ruleId?: string): Promise<WorkflowExecution[]> {
    if (ruleId) {
      return await this.sheetsService.query('Workflow_Executions', { ruleId });
    }
    return await this.sheetsService.read('Workflow_Executions');
  }

  async getWorkflowMetrics(): Promise<any> {
    const executions = await this.sheetsService.read('Workflow_Executions');
    
    const metrics = {
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      averageExecutionTime: 0,
      executionsByRule: {}
    };

    // Calculate average execution time
    const completedExecutions = executions.filter(e => e.completedAt);
    if (completedExecutions.length > 0) {
      const totalTime = completedExecutions.reduce((sum, e) => {
        const start = new Date(e.startedAt).getTime();
        const end = new Date(e.completedAt!).getTime();
        return sum + (end - start);
      }, 0);
      metrics.averageExecutionTime = totalTime / completedExecutions.length;
    }

    // Group by rule
    executions.forEach(e => {
      if (!metrics.executionsByRule[e.ruleId]) {
        (metrics.executionsByRule as any)[e.ruleId] = { total: 0, successful: 0, failed: 0 };
      }
      (metrics.executionsByRule as any)[e.ruleId].total++;
      if (e.status === 'completed') (metrics.executionsByRule as any)[e.ruleId].successful++;
      if (e.status === 'failed') (metrics.executionsByRule as any)[e.ruleId].failed++;
    });

    return metrics;
  }
}