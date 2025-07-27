import { Expense as IExpense, ExpenseCategory } from '../types';
import { validateExpense } from '../validation/schemas';

export class Expense implements IExpense {
  id!: string;
  project_id!: string;
  category!: ExpenseCategory;
  amount!: number;
  currency!: string;
  description!: string;
  date!: string;
  receipt_url?: string;
  vendor?: string;
  is_billable!: boolean;
  tax_amount?: number;
  tax_rate?: number;
  reimbursable!: boolean;
  approval_status!: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  invoice_id?: string;
  created_at!: string;
  updated_at?: string;

  constructor(data: Partial<IExpense>) {
    const validation = validateExpense(data);
    if (!validation.isValid) {
      throw new Error(`Invalid expense data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as IExpense;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Business logic methods
  calculateTotalAmount(): number {
    return this.amount + (this.tax_amount || 0);
  }

  calculateTaxAmount(): number {
    if (!this.tax_rate) return 0;
    return Math.round((this.amount * this.tax_rate / 100) * 100) / 100;
  }

  updateTaxAmount(): void {
    this.tax_amount = this.calculateTaxAmount();
    this.updated_at = new Date().toISOString();
  }

  // Approval methods
  approve(approvedBy: string): void {
    this.approval_status = 'approved';
    this.approved_by = approvedBy;
    this.approved_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  reject(): void {
    this.approval_status = 'rejected';
    this.approved_by = undefined;
    this.approved_at = undefined;
    this.updated_at = new Date().toISOString();
  }

  isApproved(): boolean {
    return this.approval_status === 'approved';
  }

  isRejected(): boolean {
    return this.approval_status === 'rejected';
  }

  isPending(): boolean {
    return this.approval_status === 'pending';
  }

  // Billing methods
  markAsBilled(invoiceId: string): void {
    if (!this.is_billable) {
      throw new Error('Cannot bill non-billable expense');
    }
    this.invoice_id = invoiceId;
    this.updated_at = new Date().toISOString();
  }

  isBilled(): boolean {
    return !!this.invoice_id;
  }

  toggleBillable(): void {
    this.is_billable = !this.is_billable;
    this.updated_at = new Date().toISOString();
  }

  // Category methods
  getCategoryDisplayName(): string {
    const categoryNames: Record<ExpenseCategory, string> = {
      [ExpenseCategory.TRAVEL]: 'Travel & Transportation',
      [ExpenseCategory.EQUIPMENT]: 'Equipment & Hardware',
      [ExpenseCategory.SOFTWARE]: 'Software & Subscriptions',
      [ExpenseCategory.MARKETING]: 'Marketing & Advertising',
      [ExpenseCategory.OFFICE]: 'Office Supplies',
      [ExpenseCategory.PROFESSIONAL]: 'Professional Services',
      [ExpenseCategory.OTHER]: 'Other'
    };
    
    return categoryNames[this.category] || this.category;
  }

  isDeductible(): boolean {
    // Business logic for tax-deductible expenses
    const deductibleCategories = [
      ExpenseCategory.EQUIPMENT,
      ExpenseCategory.SOFTWARE,
      ExpenseCategory.PROFESSIONAL,
      ExpenseCategory.OFFICE,
      ExpenseCategory.TRAVEL
    ];
    
    return deductibleCategories.includes(this.category);
  }

  // Date methods
  isToday(): boolean {
    const today = new Date().toISOString().split('T')[0];
    return this.date === today;
  }

  isThisWeek(): boolean {
    const expenseDate = new Date(this.date);
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    return expenseDate >= startOfWeek && expenseDate <= endOfWeek;
  }

  isThisMonth(): boolean {
    const expenseDate = new Date(this.date);
    const today = new Date();
    
    return expenseDate.getMonth() === today.getMonth() && 
           expenseDate.getFullYear() === today.getFullYear();
  }

  // Receipt methods
  hasReceipt(): boolean {
    return !!this.receipt_url;
  }

  updateReceipt(receiptUrl: string): void {
    this.receipt_url = receiptUrl;
    this.updated_at = new Date().toISOString();
  }

  removeReceipt(): void {
    this.receipt_url = undefined;
    this.updated_at = new Date().toISOString();
  }

  // Formatting methods
  getFormattedAmount(): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: this.currency
    }).format(this.amount);
  }

  getFormattedTotalAmount(): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: this.currency
    }).format(this.calculateTotalAmount());
  }

  getFormattedDate(): string {
    return new Date(this.date).toLocaleDateString();
  }

  // Summary methods
  static calculateTotalAmount(expenses: Expense[]): number {
    return expenses.reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
  }

  static calculateTotalByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
    const totals = {} as Record<ExpenseCategory, number>;
    
    Object.values(ExpenseCategory).forEach(category => {
      totals[category] = 0;
    });
    
    expenses.forEach(expense => {
      totals[expense.category] += expense.calculateTotalAmount();
    });
    
    return totals;
  }

  static calculateBillableAmount(expenses: Expense[]): number {
    return expenses
      .filter(expense => expense.is_billable)
      .reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
  }

  static calculateReimbursableAmount(expenses: Expense[]): number {
    return expenses
      .filter(expense => expense.reimbursable && expense.isApproved())
      .reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
  }

  static groupByCategory(expenses: Expense[]): Record<ExpenseCategory, Expense[]> {
    const groups = {} as Record<ExpenseCategory, Expense[]>;
    
    Object.values(ExpenseCategory).forEach(category => {
      groups[category] = [];
    });
    
    expenses.forEach(expense => {
      groups[expense.category].push(expense);
    });
    
    return groups;
  }

  static groupByProject(expenses: Expense[]): Record<string, Expense[]> {
    return expenses.reduce((groups, expense) => {
      const projectId = expense.project_id;
      if (!groups[projectId]) {
        groups[projectId] = [];
      }
      groups[projectId].push(expense);
      return groups;
    }, {} as Record<string, Expense[]>);
  }

  static groupByMonth(expenses: Expense[]): Record<string, Expense[]> {
    return expenses.reduce((groups, expense) => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(expense);
      return groups;
    }, {} as Record<string, Expense[]>);
  }

  // Validation methods
  static validate(data: Partial<IExpense>) {
    return validateExpense(data);
  }

  // Serialization methods
  toJSON(): IExpense {
    return {
      id: this.id,
      project_id: this.project_id,
      category: this.category,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      date: this.date,
      receipt_url: this.receipt_url,
      vendor: this.vendor,
      is_billable: this.is_billable,
      tax_amount: this.tax_amount,
      tax_rate: this.tax_rate,
      reimbursable: this.reimbursable,
      approval_status: this.approval_status,
      approved_by: this.approved_by,
      approved_at: this.approved_at,
      invoice_id: this.invoice_id,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  static fromJSON(data: any): Expense {
    return new Expense(data);
  }
}