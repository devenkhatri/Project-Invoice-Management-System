import * as cron from 'node-cron';
import { GoogleSheetsService } from './googleSheets';
import { Invoice, InvoiceStatus } from '../models';

interface RecurringInvoiceConfig {
  template_invoice_id: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: Date;
  end_date?: Date;
  max_occurrences?: number;
  current_occurrences?: number;
  is_active?: boolean;
}

const sheetsService = new GoogleSheetsService();
const recurringInvoices: Map<string, RecurringInvoiceConfig> = new Map();

// Schedule a recurring invoice
export async function scheduleRecurringInvoice(config: RecurringInvoiceConfig): Promise<void> {
  const configId = generateConfigId();
  
  // Set defaults
  config.current_occurrences = config.current_occurrences || 0;
  config.is_active = config.is_active !== false;
  
  // Store configuration (in production, this would be stored in Google Sheets)
  recurringInvoices.set(configId, config);
  
  // Schedule the cron job
  scheduleNextInvoice(configId, config);
  
  console.log(`Recurring invoice scheduled with ID: ${configId}`);
}

// Schedule the next invoice creation
function scheduleNextInvoice(configId: string, config: RecurringInvoiceConfig): void {
  if (!config.is_active) return;
  
  // Check if we've reached the maximum occurrences
  if (config.max_occurrences && config.current_occurrences! >= config.max_occurrences) {
    console.log(`Recurring invoice ${configId} has reached maximum occurrences`);
    return;
  }
  
  // Check if we've passed the end date
  if (config.end_date && config.next_date > config.end_date) {
    console.log(`Recurring invoice ${configId} has passed end date`);
    return;
  }
  
  // Calculate cron expression based on next_date
  const cronExpression = getCronExpression(config.next_date);
  
  // Schedule the task
  cron.schedule(cronExpression, async () => {
    try {
      await createRecurringInvoice(configId, config);
    } catch (error) {
      console.error(`Error creating recurring invoice ${configId}:`, error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Indian timezone
  });
}

// Create a new invoice from the recurring template
async function createRecurringInvoice(configId: string, config: RecurringInvoiceConfig): Promise<void> {
  try {
    // Get the template invoice
    const templateRows = await sheetsService.read('Invoices', config.template_invoice_id);
    if (templateRows.length === 0) {
      console.error(`Template invoice ${config.template_invoice_id} not found`);
      return;
    }
    
    const templateInvoice = Invoice.fromSheetRow(templateRows[0]);
    
    // Create new invoice based on template
    const newInvoice = new Invoice({
      client_id: templateInvoice.client_id,
      project_id: templateInvoice.project_id,
      amount: templateInvoice.amount,
      tax_amount: templateInvoice.tax_amount,
      total_amount: templateInvoice.total_amount,
      status: InvoiceStatus.DRAFT,
      due_date: calculateDueDate(config.next_date, 30) // 30 days from creation
    });
    
    // Save the new invoice
    await sheetsService.create('Invoices', newInvoice.toSheetRow());
    
    // Update the recurring configuration
    config.current_occurrences = (config.current_occurrences || 0) + 1;
    config.next_date = calculateNextDate(config.next_date, config.frequency);
    
    // Schedule the next occurrence
    scheduleNextInvoice(configId, config);
    
    console.log(`Created recurring invoice: ${newInvoice.invoice_number}`);
    
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    throw error;
  }
}

// Calculate the next date based on frequency
function calculateNextDate(currentDate: Date, frequency: string): Date {
  const nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
  
  return nextDate;
}

// Calculate due date from creation date
function calculateDueDate(creationDate: Date, daysToAdd: number): Date {
  const dueDate = new Date(creationDate);
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return dueDate;
}

// Generate cron expression for a specific date
function getCronExpression(date: Date): string {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  
  // Run once at the specified date and time
  return `${minute} ${hour} ${day} ${month} *`;
}

// Generate unique configuration ID
function generateConfigId(): string {
  return 'recurring_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get all active recurring invoice configurations
export function getActiveRecurringInvoices(): RecurringInvoiceConfig[] {
  return Array.from(recurringInvoices.values()).filter(config => config.is_active);
}

// Cancel a recurring invoice
export function cancelRecurringInvoice(configId: string): boolean {
  const config = recurringInvoices.get(configId);
  if (config) {
    config.is_active = false;
    return true;
  }
  return false;
}

// Update recurring invoice configuration
export function updateRecurringInvoice(configId: string, updates: Partial<RecurringInvoiceConfig>): boolean {
  const config = recurringInvoices.get(configId);
  if (config) {
    Object.assign(config, updates);
    
    // If the configuration is still active, reschedule
    if (config.is_active) {
      scheduleNextInvoice(configId, config);
    }
    
    return true;
  }
  return false;
}

// Initialize recurring invoices on server start
export function initializeRecurringInvoices(): void {
  console.log('Initializing recurring invoice system...');
  
  // In production, you would load existing configurations from Google Sheets
  // For now, we'll just log that the system is ready
  console.log('Recurring invoice system initialized');
}

// Check for overdue invoices and update their status
export async function checkOverdueInvoices(): Promise<void> {
  try {
    const invoiceRows = await sheetsService.read('Invoices');
    const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
    
    const overdueInvoices = invoices.filter(invoice => 
      invoice.status === InvoiceStatus.SENT && invoice.isOverdue()
    );
    
    for (const invoice of overdueInvoices) {
      invoice.markAsOverdue();
      await sheetsService.update('Invoices', invoice.id, invoice.toSheetRow());
      console.log(`Marked invoice ${invoice.invoice_number} as overdue`);
    }
    
    if (overdueInvoices.length > 0) {
      console.log(`Updated ${overdueInvoices.length} overdue invoices`);
    }
    
  } catch (error) {
    console.error('Error checking overdue invoices:', error);
  }
}

// Schedule daily check for overdue invoices
export function scheduleOverdueCheck(): void {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily overdue invoice check...');
    await checkOverdueInvoices();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  console.log('Scheduled daily overdue invoice check at 9 AM IST');
}

// Get recurring invoice statistics
export function getRecurringInvoiceStats(): {
  total: number;
  active: number;
  inactive: number;
  nextDue: Date | null;
} {
  const configs = Array.from(recurringInvoices.values());
  const active = configs.filter(c => c.is_active);
  const nextDue = active.length > 0 
    ? active.reduce((earliest, config) => 
        !earliest || config.next_date < earliest ? config.next_date : earliest, null as Date | null)
    : null;
  
  return {
    total: configs.length,
    active: active.length,
    inactive: configs.length - active.length,
    nextDue
  };
}