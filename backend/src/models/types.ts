// Common types and enums used across models

export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ON_HOLD = 'on-hold'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue'
}

export enum ExpenseCategory {
  TRAVEL = 'travel',
  EQUIPMENT = 'equipment',
  SOFTWARE = 'software',
  MARKETING = 'marketing',
  OFFICE = 'office',
  OTHER = 'other'
}

export enum PaymentGateway {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  RAZORPAY = 'razorpay',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
  OTHER = 'other'
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum InvoiceItemType {
  SERVICE = 'service',
  PRODUCT = 'product',
  EXPENSE = 'expense',
  DISCOUNT = 'discount',
  FEE = 'fee'
}

// Base interface for all models
export interface BaseModel {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Common validation error type
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}