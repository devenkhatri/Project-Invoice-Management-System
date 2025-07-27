// Enums for better type safety
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
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum ExpenseCategory {
  TRAVEL = 'travel',
  EQUIPMENT = 'equipment',
  SOFTWARE = 'software',
  MARKETING = 'marketing',
  OFFICE = 'office',
  PROFESSIONAL = 'professional',
  OTHER = 'other'
}

// Core data model interfaces
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'client';
  is_active: boolean;
  email_verified: boolean;
  last_login?: string;
  failed_login_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  budget: number;
  actual_cost?: number;
  description: string;
  progress_percentage?: number;
  is_billable: boolean;
  hourly_rate?: number;
  currency: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  estimated_hours: number;
  actual_hours: number;
  is_billable: boolean;
  hourly_rate?: number;
  assignee?: string;
  dependencies?: string[];
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  country: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  payment_terms: string;
  default_currency: string;
  billing_address?: string;
  shipping_address?: string;
  contact_person?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  portal_access_enabled?: boolean;
  portal_password_hash?: string;
  last_portal_login?: string;
  company_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
  hsn_sac_code?: string;
}

export interface TaxBreakdown {
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax_amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  project_id?: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_breakdown: TaxBreakdown;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  notes?: string;
  terms_conditions?: string;
  is_recurring: boolean;
  recurring_frequency?: string;
  next_invoice_date?: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  payment_date?: string;
  payment_method?: string;
  late_fee_applied?: number;
  discount_percentage?: number;
  discount_amount?: number;
  created_at: string;
  updated_at?: string;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  project_id: string;
  hours: number;
  description: string;
  date: string;
  start_time?: string;
  end_time?: string;
  is_billable: boolean;
  hourly_rate?: number;
  total_amount?: number;
  user_id?: string;
  invoice_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Expense {
  id: string;
  project_id: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description: string;
  date: string;
  receipt_url?: string;
  vendor?: string;
  is_billable: boolean;
  tax_amount?: number;
  tax_rate?: number;
  reimbursable: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  invoice_id?: string;
  created_at: string;
  updated_at?: string;
}

// Google Sheets specific types
export interface SheetConfig {
  name: string;
  headers: string[];
}

export interface QueryFilter {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface BatchOperation {
  operation: 'create' | 'update' | 'delete';
  sheetName: string;
  data: any;
  id?: string;
}

// Authentication types
export interface TokenPayload {
  id: string;
  email: string;
  role: 'admin' | 'client';
  name: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Error types
export interface SheetsError extends Error {
  code: string;
  statusCode: number;
  retryable: boolean;
}