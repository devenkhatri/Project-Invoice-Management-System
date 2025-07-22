import { z } from 'zod';
import { BaseModel, InvoiceStatus, ValidationResult, ValidationError, InvoiceItemType } from './types';

// TypeScript interface for Invoice Item
export interface IInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  type: InvoiceItemType;
  hsn_sac?: string; // HSN/SAC code for GST compliance
}

// TypeScript interface for Invoice
export interface IInvoice extends BaseModel {
  invoice_number: string;
  client_id: string;
  project_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  due_date: Date;
  currency: string;
  tax_rate: number;
  notes?: string;
  terms?: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  recurring_next_date?: Date;
  recurring_end_date?: Date;
  recurring_count?: number;
  items?: IInvoiceItem[];
  payment_link?: string;
}

// Zod schema for invoice item validation
export const InvoiceItemSchema = z.object({
  id: z.string().min(1).optional(),
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  rate: z.number().min(0, 'Rate must be non-negative'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  type: z.nativeEnum(InvoiceItemType),
  hsn_sac: z.string().optional()
});

// Zod schema for invoice validation
export const InvoiceSchema = z.object({
  id: z.string().min(1).optional(),
  invoice_number: z.string().min(1, 'Invoice number is required').max(50, 'Invoice number too long'),
  client_id: z.string().min(1, 'Client ID is required'),
  project_id: z.string().min(1, 'Project ID is required'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  tax_amount: z.number().min(0, 'Tax amount must be non-negative'),
  total_amount: z.number().min(0, 'Total amount must be non-negative'),
  status: z.nativeEnum(InvoiceStatus),
  due_date: z.date(),
  currency: z.string().default('INR'),
  tax_rate: z.number().min(0).max(100).default(18),
  notes: z.string().optional(),
  terms: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurring_frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  recurring_next_date: z.date().optional(),
  recurring_end_date: z.date().optional(),
  recurring_count: z.number().int().min(0).optional(),
  items: z.array(InvoiceItemSchema).optional(),
  payment_link: z.string().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
}).refine(data => data.total_amount >= data.amount + data.tax_amount, {
  message: 'Total amount must be at least the sum of amount and tax',
  path: ['total_amount']
}).refine(data => {
  if (data.is_recurring && !data.recurring_frequency) {
    return false;
  }
  return true;
}, {
  message: 'Recurring frequency is required for recurring invoices',
  path: ['recurring_frequency']
}).refine(data => {
  if (data.is_recurring && !data.recurring_next_date) {
    return false;
  }
  return true;
}, {
  message: 'Next date is required for recurring invoices',
  path: ['recurring_next_date']
});

// Invoice Item class
export class InvoiceItem implements IInvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  type: InvoiceItemType;
  hsn_sac?: string;

  constructor(data: Partial<IInvoiceItem>) {
    this.id = data.id || `item_${Date.now().toString(36)}${Math.random().toString(36).substr(2)}`;
    this.invoice_id = data.invoice_id || '';
    this.description = data.description || '';
    this.quantity = data.quantity || 0;
    this.rate = data.rate || 0;
    this.amount = data.amount || (this.quantity * this.rate);
    this.type = data.type || InvoiceItemType.SERVICE;
    this.hsn_sac = data.hsn_sac;
  }

  // Calculate amount based on quantity and rate
  calculateAmount(): number {
    this.amount = this.quantity * this.rate;
    return this.amount;
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      invoice_id: this.invoice_id,
      description: this.description,
      quantity: this.quantity,
      rate: this.rate,
      amount: this.amount,
      type: this.type,
      hsn_sac: this.hsn_sac || ''
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): InvoiceItem {
    return new InvoiceItem({
      id: row.id,
      invoice_id: row.invoice_id,
      description: row.description,
      quantity: parseFloat(row.quantity) || 0,
      rate: parseFloat(row.rate) || 0,
      amount: parseFloat(row.amount) || 0,
      type: row.type as InvoiceItemType,
      hsn_sac: row.hsn_sac
    });
  }
}

// Invoice model class with business logic
export class Invoice implements IInvoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  due_date: Date;
  currency: string;
  tax_rate: number;
  notes?: string;
  terms?: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  recurring_next_date?: Date;
  recurring_end_date?: Date;
  recurring_count?: number;
  items?: InvoiceItem[];
  payment_link?: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IInvoice>) {
    this.id = data.id || this.generateId();
    this.invoice_number = data.invoice_number || this.generateInvoiceNumber();
    this.client_id = data.client_id || '';
    this.project_id = data.project_id || '';
    this.amount = data.amount || 0;
    this.tax_amount = data.tax_amount || 0;
    this.total_amount = data.total_amount || 0;
    this.status = data.status || InvoiceStatus.DRAFT;
    this.due_date = data.due_date || this.getDefaultDueDate();
    this.currency = data.currency || 'INR';
    this.tax_rate = data.tax_rate !== undefined ? data.tax_rate : 18; // Default GST rate
    this.notes = data.notes;
    this.terms = data.terms;
    this.is_recurring = data.is_recurring || false;
    this.recurring_frequency = data.recurring_frequency;
    this.recurring_next_date = data.recurring_next_date;
    this.recurring_end_date = data.recurring_end_date;
    this.recurring_count = data.recurring_count;
    this.items = data.items ? data.items.map(item => {
      return item instanceof InvoiceItem ? item : new InvoiceItem(item);
    }) : [];
    this.payment_link = data.payment_link;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'inv_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}${month}-${timestamp}`;
  }

  private getDefaultDueDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30); // Default 30 days
    return date;
  }

  // Validation method
  validate(): ValidationResult {
    try {
      InvoiceSchema.parse(this);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        return { isValid: false, errors };
      }
      return { 
        isValid: false, 
        errors: [{ field: 'general', message: 'Validation failed', code: 'unknown' }] 
      };
    }
  }

  // Business logic methods
  isPaid(): boolean {
    return this.status === InvoiceStatus.PAID;
  }

  isOverdue(): boolean {
    return this.due_date < new Date() && this.status !== InvoiceStatus.PAID;
  }

  getDaysOverdue(): number {
    if (!this.isOverdue()) return 0;
    const today = new Date();
    const diffTime = today.getTime() - this.due_date.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysUntilDue(): number {
    const today = new Date();
    if (this.due_date < today) return 0;
    const diffTime = this.due_date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  calculateGST(rate: number = 18): void {
    this.tax_amount = (this.amount * rate) / 100;
    this.total_amount = this.amount + this.tax_amount;
    this.updated_at = new Date();
  }

  markAsSent(): void {
    if (this.status === InvoiceStatus.DRAFT) {
      this.status = InvoiceStatus.SENT;
      this.updated_at = new Date();
    }
  }

  markAsPaid(): void {
    this.status = InvoiceStatus.PAID;
    this.updated_at = new Date();
  }

  markAsOverdue(): void {
    if (this.status === InvoiceStatus.SENT && this.isOverdue()) {
      this.status = InvoiceStatus.OVERDUE;
      this.updated_at = new Date();
    }
  }

  updateAmount(amount: number, taxRate: number = 18): void {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    this.amount = amount;
    this.calculateGST(taxRate);
  }

  updateDueDate(dueDate: Date): void {
    this.due_date = dueDate;
    this.updated_at = new Date();
  }

  getSubtotal(): number {
    return this.amount;
  }

  getTaxRate(): number {
    if (this.amount === 0) return 0;
    return (this.tax_amount / this.amount) * 100;
  }

  // Add invoice items and recalculate totals
  addItems(items: Partial<IInvoiceItem>[]): void {
    this.items = this.items || [];
    
    items.forEach(itemData => {
      const item = new InvoiceItem({
        ...itemData,
        invoice_id: this.id
      });
      item.calculateAmount();
      this.items!.push(item);
    });
    
    this.recalculateTotal();
  }
  
  // Remove an item by ID
  removeItem(itemId: string): boolean {
    if (!this.items) return false;
    
    const initialLength = this.items.length;
    this.items = this.items.filter(item => item.id !== itemId);
    
    if (this.items.length !== initialLength) {
      this.recalculateTotal();
      return true;
    }
    
    return false;
  }
  
  // Recalculate invoice total based on items
  recalculateTotal(): void {
    if (!this.items || this.items.length === 0) {
      return;
    }
    
    this.amount = this.items.reduce((sum, item) => sum + item.amount, 0);
    this.calculateGST(this.tax_rate);
  }
  
  // Set up recurring invoice
  setupRecurring(frequency: string, nextDate: Date, endDate?: Date, count?: number): void {
    this.is_recurring = true;
    this.recurring_frequency = frequency;
    this.recurring_next_date = nextDate;
    this.recurring_end_date = endDate;
    this.recurring_count = count;
    this.updated_at = new Date();
  }
  
  // Cancel recurring
  cancelRecurring(): void {
    this.is_recurring = false;
    this.updated_at = new Date();
  }
  
  // Create a copy of this invoice for recurring purposes
  createRecurringCopy(): Invoice {
    const copy = new Invoice({
      client_id: this.client_id,
      project_id: this.project_id,
      amount: this.amount,
      tax_rate: this.tax_rate,
      currency: this.currency,
      notes: this.notes,
      terms: this.terms,
      status: InvoiceStatus.DRAFT
    });
    
    // Copy items if they exist
    if (this.items && this.items.length > 0) {
      copy.items = this.items.map(item => new InvoiceItem({
        invoice_id: copy.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        type: item.type,
        hsn_sac: item.hsn_sac
      }));
    }
    
    return copy;
  }
  
  // Set payment link
  setPaymentLink(link: string): void {
    this.payment_link = link;
    this.updated_at = new Date();
  }
  
  // Get GST breakdown (CGST/SGST or IGST)
  getGSTBreakdown(isInterState: boolean = false): { 
    cgst?: { rate: number, amount: number },
    sgst?: { rate: number, amount: number },
    igst?: { rate: number, amount: number }
  } {
    if (isInterState) {
      // Inter-state supply: IGST only
      return {
        igst: {
          rate: this.tax_rate,
          amount: this.tax_amount
        }
      };
    } else {
      // Intra-state supply: CGST + SGST
      const halfRate = this.tax_rate / 2;
      const halfAmount = this.tax_amount / 2;
      
      return {
        cgst: {
          rate: halfRate,
          amount: halfAmount
        },
        sgst: {
          rate: halfRate,
          amount: halfAmount
        }
      };
    }
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      invoice_number: this.invoice_number,
      client_id: this.client_id,
      project_id: this.project_id,
      amount: this.amount,
      tax_amount: this.tax_amount,
      total_amount: this.total_amount,
      status: this.status,
      due_date: this.due_date.toISOString(),
      currency: this.currency,
      tax_rate: this.tax_rate,
      notes: this.notes || '',
      terms: this.terms || '',
      is_recurring: this.is_recurring || false,
      recurring_frequency: this.recurring_frequency || '',
      recurring_next_date: this.recurring_next_date ? this.recurring_next_date.toISOString() : '',
      recurring_end_date: this.recurring_end_date ? this.recurring_end_date.toISOString() : '',
      recurring_count: this.recurring_count || 0,
      payment_link: this.payment_link || '',
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Invoice {
    return new Invoice({
      id: row.id,
      invoice_number: row.invoice_number,
      client_id: row.client_id,
      project_id: row.project_id,
      amount: parseFloat(row.amount) || 0,
      tax_amount: parseFloat(row.tax_amount) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      status: row.status as InvoiceStatus,
      due_date: new Date(row.due_date),
      currency: row.currency || 'INR',
      tax_rate: parseFloat(row.tax_rate) || 18,
      notes: row.notes,
      terms: row.terms,
      is_recurring: row.is_recurring === 'true' || row.is_recurring === true,
      recurring_frequency: row.recurring_frequency,
      recurring_next_date: row.recurring_next_date ? new Date(row.recurring_next_date) : undefined,
      recurring_end_date: row.recurring_end_date ? new Date(row.recurring_end_date) : undefined,
      recurring_count: parseInt(row.recurring_count) || 0,
      payment_link: row.payment_link,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }
}