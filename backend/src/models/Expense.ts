import { z } from 'zod';
import { BaseModel, ExpenseCategory, ValidationResult, ValidationError } from './types';

// TypeScript interface for Expense
export interface IExpense extends BaseModel {
  project_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: Date;
  receipt_url: string;
}

// Zod schema for validation
export const ExpenseSchema = z.object({
  id: z.string().min(1).optional(),
  project_id: z.string().min(1, 'Project ID is required'),
  category: z.nativeEnum(ExpenseCategory),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  date: z.date(),
  receipt_url: z.union([
    z.string().url('Invalid URL format'),
    z.literal('')
  ]).optional().default(''),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// Expense model class with business logic
export class Expense implements IExpense {
  id: string;
  project_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: Date;
  receipt_url: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IExpense>) {
    this.id = data.id || this.generateId();
    this.project_id = data.project_id || '';
    this.category = data.category || ExpenseCategory.OTHER;
    this.amount = data.amount || 0;
    this.description = data.description || '';
    this.date = data.date || new Date();
    this.receipt_url = data.receipt_url || '';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  private generateId(): string {
    return 'exp_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      ExpenseSchema.parse(this);
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
  hasReceipt(): boolean {
    return this.receipt_url.length > 0;
  }

  isToday(): boolean {
    const today = new Date();
    return this.date.toDateString() === today.toDateString();
  }

  isThisMonth(): boolean {
    const today = new Date();
    return this.date.getMonth() === today.getMonth() && 
           this.date.getFullYear() === today.getFullYear();
  }

  isThisYear(): boolean {
    const today = new Date();
    return this.date.getFullYear() === today.getFullYear();
  }

  getFormattedAmount(): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(this.amount);
  }

  getCategoryDisplayName(): string {
    return this.category.charAt(0).toUpperCase() + this.category.slice(1).toLowerCase();
  }

  updateAmount(amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    this.amount = amount;
    this.updated_at = new Date();
  }

  updateCategory(category: ExpenseCategory): void {
    this.category = category;
    this.updated_at = new Date();
  }

  updateDescription(description: string): void {
    if (!description.trim()) {
      throw new Error('Description cannot be empty');
    }
    this.description = description;
    this.updated_at = new Date();
  }

  updateReceiptUrl(url: string): void {
    this.receipt_url = url;
    this.updated_at = new Date();
  }

  updateDate(date: Date): void {
    this.date = date;
    this.updated_at = new Date();
  }

  // Check if expense is within a date range
  isWithinDateRange(startDate: Date, endDate: Date): boolean {
    return this.date >= startDate && this.date <= endDate;
  }

  // Check if expense is tax deductible (business logic can be customized)
  isTaxDeductible(): boolean {
    const deductibleCategories = [
      ExpenseCategory.EQUIPMENT,
      ExpenseCategory.SOFTWARE,
      ExpenseCategory.OFFICE,
      ExpenseCategory.TRAVEL
    ];
    return deductibleCategories.includes(this.category);
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
    return {
      id: this.id,
      project_id: this.project_id,
      category: this.category,
      amount: this.amount,
      description: this.description,
      date: this.date.toISOString(),
      receipt_url: this.receipt_url,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Expense {
    return new Expense({
      id: row.id,
      project_id: row.project_id,
      category: row.category as ExpenseCategory,
      amount: parseFloat(row.amount) || 0,
      description: row.description || '',
      date: new Date(row.date),
      receipt_url: row.receipt_url || '',
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    });
  }

  // Static method to calculate total expenses
  static calculateTotal(expenses: Expense[]): number {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  }

  // Static method to group expenses by category
  static groupByCategory(expenses: Expense[]): Map<ExpenseCategory, Expense[]> {
    const grouped = new Map<ExpenseCategory, Expense[]>();
    expenses.forEach(expense => {
      if (!grouped.has(expense.category)) {
        grouped.set(expense.category, []);
      }
      grouped.get(expense.category)!.push(expense);
    });
    return grouped;
  }

  // Static method to filter expenses by date range
  static filterByDateRange(expenses: Expense[], startDate: Date, endDate: Date): Expense[] {
    return expenses.filter(expense => expense.isWithinDateRange(startDate, endDate));
  }

  // Static method to filter expenses by category
  static filterByCategory(expenses: Expense[], category: ExpenseCategory): Expense[] {
    return expenses.filter(expense => expense.category === category);
  }

  // Static method to get tax deductible expenses
  static getTaxDeductible(expenses: Expense[]): Expense[] {
    return expenses.filter(expense => expense.isTaxDeductible());
  }
}