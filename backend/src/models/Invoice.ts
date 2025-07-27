import { 
  Invoice as IInvoice, 
  InvoiceLineItem, 
  TaxBreakdown, 
  InvoiceStatus, 
  PaymentStatus,
  Client 
} from '../types';
import { validateInvoice } from '../validation/schemas';

export class Invoice implements IInvoice {
  id!: string;
  invoice_number!: string;
  client_id!: string;
  project_id?: string;
  line_items!: InvoiceLineItem[];
  subtotal!: number;
  tax_breakdown!: TaxBreakdown;
  total_amount!: number;
  currency!: string;
  status!: InvoiceStatus;
  issue_date!: string;
  due_date!: string;
  payment_terms!: string;
  notes?: string;
  terms_conditions?: string;
  is_recurring!: boolean;
  recurring_frequency?: string;
  next_invoice_date?: string;
  payment_status!: PaymentStatus;
  paid_amount!: number;
  payment_date?: string;
  payment_method?: string;
  late_fee_applied?: number;
  discount_percentage?: number;
  discount_amount?: number;
  created_at!: string;
  updated_at?: string;

  constructor(data: Partial<IInvoice>) {
    const validation = validateInvoice(data);
    if (!validation.isValid) {
      throw new Error(`Invalid invoice data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as IInvoice;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Business logic methods
  calculateSubtotal(): number {
    return this.line_items.reduce((sum, item) => sum + item.total_price, 0);
  }

  calculateTaxBreakdown(client: any, supplierStateCode: string = '07'): TaxBreakdown {
    const taxRates = client.calculateTaxRates(supplierStateCode);
    const subtotal = this.calculateSubtotal();

    const cgst_amount = (subtotal * taxRates.cgst) / 100;
    const sgst_amount = (subtotal * taxRates.sgst) / 100;
    const igst_amount = (subtotal * taxRates.igst) / 100;
    const total_tax_amount = cgst_amount + sgst_amount + igst_amount;

    return {
      cgst_rate: taxRates.cgst,
      cgst_amount: Math.round(cgst_amount * 100) / 100,
      sgst_rate: taxRates.sgst,
      sgst_amount: Math.round(sgst_amount * 100) / 100,
      igst_rate: taxRates.igst,
      igst_amount: Math.round(igst_amount * 100) / 100,
      total_tax_amount: Math.round(total_tax_amount * 100) / 100
    };
  }

  calculateTotalAmount(): number {
    let total = this.subtotal + this.tax_breakdown.total_tax_amount;
    
    if (this.discount_amount) {
      total -= this.discount_amount;
    } else if (this.discount_percentage) {
      total -= (total * this.discount_percentage) / 100;
    }
    
    if (this.late_fee_applied) {
      total += this.late_fee_applied;
    }
    
    return Math.round(total * 100) / 100;
  }

  recalculateAmounts(client: any, supplierStateCode?: string): void {
    this.subtotal = this.calculateSubtotal();
    this.tax_breakdown = this.calculateTaxBreakdown(client, supplierStateCode);
    this.total_amount = this.calculateTotalAmount();
    this.updated_at = new Date().toISOString();
  }

  addLineItem(item: Omit<InvoiceLineItem, 'id'>): void {
    const lineItem: InvoiceLineItem = {
      ...item,
      id: this.generateLineItemId(),
      total_price: item.quantity * item.unit_price,
      tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
    };
    
    this.line_items.push(lineItem);
    this.updated_at = new Date().toISOString();
  }

  removeLineItem(itemId: string): void {
    this.line_items = this.line_items.filter(item => item.id !== itemId);
    this.updated_at = new Date().toISOString();
  }

  updateLineItem(itemId: string, updates: Partial<InvoiceLineItem>): void {
    const itemIndex = this.line_items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      const item = { ...this.line_items[itemIndex], ...updates };
      item.total_price = item.quantity * item.unit_price;
      item.tax_amount = (item.total_price * item.tax_rate) / 100;
      this.line_items[itemIndex] = item;
      this.updated_at = new Date().toISOString();
    }
  }

  // Payment methods
  recordPayment(amount: number, paymentDate: string, paymentMethod?: string): void {
    this.paid_amount += amount;
    this.payment_date = paymentDate;
    this.payment_method = paymentMethod;
    
    if (this.paid_amount >= this.total_amount) {
      this.payment_status = PaymentStatus.PAID;
      this.status = InvoiceStatus.PAID;
    } else if (this.paid_amount > 0) {
      this.payment_status = PaymentStatus.PARTIAL;
    }
    
    this.updated_at = new Date().toISOString();
  }

  getRemainingAmount(): number {
    return Math.max(0, this.total_amount - this.paid_amount);
  }

  isFullyPaid(): boolean {
    return this.paid_amount >= this.total_amount;
  }

  isPartiallyPaid(): boolean {
    return this.paid_amount > 0 && this.paid_amount < this.total_amount;
  }

  // Due date and overdue methods
  isOverdue(): boolean {
    const now = new Date();
    const dueDate = new Date(this.due_date);
    return now > dueDate && !this.isFullyPaid();
  }

  getDaysOverdue(): number {
    if (!this.isOverdue()) return 0;
    
    const now = new Date();
    const dueDate = new Date(this.due_date);
    const diffTime = now.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysUntilDue(): number {
    const now = new Date();
    const dueDate = new Date(this.due_date);
    const diffTime = dueDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Late fee calculation
  calculateLateFee(lateFeeRate: number = 1.5, maxLateFee?: number): number {
    if (!this.isOverdue()) return 0;
    
    const daysOverdue = this.getDaysOverdue();
    const remainingAmount = this.getRemainingAmount();
    let lateFee = (remainingAmount * lateFeeRate * daysOverdue) / 100;
    
    if (maxLateFee && lateFee > maxLateFee) {
      lateFee = maxLateFee;
    }
    
    return Math.round(lateFee * 100) / 100;
  }

  applyLateFee(lateFeeRate: number = 1.5, maxLateFee?: number): void {
    const lateFee = this.calculateLateFee(lateFeeRate, maxLateFee);
    if (lateFee > 0) {
      this.late_fee_applied = (this.late_fee_applied || 0) + lateFee;
      this.total_amount += lateFee;
      this.updated_at = new Date().toISOString();
    }
  }

  // Status methods
  markAsSent(): void {
    this.status = InvoiceStatus.SENT;
    this.updated_at = new Date().toISOString();
  }

  markAsOverdue(): void {
    if (this.isOverdue()) {
      this.status = InvoiceStatus.OVERDUE;
      this.updated_at = new Date().toISOString();
    }
  }

  cancel(): void {
    this.status = InvoiceStatus.CANCELLED;
    this.updated_at = new Date().toISOString();
  }

  // Recurring invoice methods
  generateNextInvoice(): Partial<IInvoice> | null {
    if (!this.is_recurring || !this.recurring_frequency) return null;
    
    const nextDate = this.calculateNextInvoiceDate();
    if (!nextDate) return null;
    
    return {
      client_id: this.client_id,
      project_id: this.project_id,
      line_items: [...this.line_items],
      currency: this.currency,
      payment_terms: this.payment_terms,
      notes: this.notes,
      terms_conditions: this.terms_conditions,
      is_recurring: true,
      recurring_frequency: this.recurring_frequency,
      issue_date: nextDate,
      due_date: this.calculateDueDateFromIssueDate(nextDate)
    };
  }

  private calculateNextInvoiceDate(): string | null {
    if (!this.next_invoice_date) return null;
    
    const currentDate = new Date(this.next_invoice_date);
    let nextDate: Date;
    
    switch (this.recurring_frequency) {
      case 'weekly':
        nextDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
        break;
      case 'monthly':
        nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        break;
      case 'quarterly':
        nextDate = new Date(currentDate.setMonth(currentDate.getMonth() + 3));
        break;
      case 'yearly':
        nextDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
        break;
      default:
        return null;
    }
    
    return nextDate.toISOString().split('T')[0];
  }

  private calculateDueDateFromIssueDate(issueDate: string): string {
    const paymentDays = this.getPaymentTermsDays();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentDays);
    return dueDate.toISOString().split('T')[0];
  }

  private getPaymentTermsDays(): number {
    const match = this.payment_terms.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

  private generateLineItemId(): string {
    return `li_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Validation methods
  static validate(data: Partial<IInvoice>) {
    return validateInvoice(data);
  }

  // Serialization methods
  toJSON(): IInvoice {
    return {
      id: this.id,
      invoice_number: this.invoice_number,
      client_id: this.client_id,
      project_id: this.project_id,
      line_items: this.line_items,
      subtotal: this.subtotal,
      tax_breakdown: this.tax_breakdown,
      total_amount: this.total_amount,
      currency: this.currency,
      status: this.status,
      issue_date: this.issue_date,
      due_date: this.due_date,
      payment_terms: this.payment_terms,
      notes: this.notes,
      terms_conditions: this.terms_conditions,
      is_recurring: this.is_recurring,
      recurring_frequency: this.recurring_frequency,
      next_invoice_date: this.next_invoice_date,
      payment_status: this.payment_status,
      paid_amount: this.paid_amount,
      payment_date: this.payment_date,
      payment_method: this.payment_method,
      late_fee_applied: this.late_fee_applied,
      discount_percentage: this.discount_percentage,
      discount_amount: this.discount_amount,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromJSON(data: any): Invoice {
    return new Invoice(data);
  }
}