export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_price: number;
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
  FAILED = 'failed'
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
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
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
  
  // Extended properties from API
  client?: {
    id: string;
    name: string;
    email: string;
    address: string;
    gstin?: string;
  };
  project?: {
    id: string;
    name: string;
  };
  days_until_due?: number;
  days_overdue?: number;
  remaining_amount?: number;
  is_overdue?: boolean;
  payment_history?: PaymentRecord[];
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: string;
  status: string;
  transaction_id?: string;
  notes?: string;
}

export interface InvoiceFilter {
  status?: InvoiceStatus[];
  client_id?: string;
  project_id?: string;
  payment_status?: PaymentStatus[];
  from_date?: string;
  to_date?: string;
  currency?: string;
  is_recurring?: boolean;
  overdue_only?: boolean;
  amount_range?: {
    min: number;
    max: number;
  };
}

export interface InvoiceFormData {
  client_id: string;
  project_id?: string;
  line_items: Omit<InvoiceLineItem, 'id' | 'total_price' | 'tax_amount'>[];
  currency?: string;
  issue_date: string;
  due_date: string;
  payment_terms?: string;
  notes?: string;
  terms_conditions?: string;
  is_recurring?: boolean;
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  discount_percentage?: number;
  discount_amount?: number;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  template_data: {
    company_logo?: string;
    company_name: string;
    company_address: string;
    company_phone: string;
    company_email: string;
    company_gstin?: string;
    colors: {
      primary: string;
      secondary: string;
      text: string;
    };
    fonts: {
      heading: string;
      body: string;
    };
    layout: 'standard' | 'modern' | 'minimal';
    show_payment_terms: boolean;
    show_notes: boolean;
    custom_fields: Array<{
      name: string;
      value: string;
      position: 'header' | 'footer' | 'body';
    }>;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceAnalytics {
  total_invoices: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  overdue_amount: number;
  average_payment_time: number;
  payment_success_rate: number;
  revenue_trends: Array<{
    period: string;
    amount: number;
    count: number;
  }>;
  client_payment_behavior: Array<{
    client_id: string;
    client_name: string;
    total_invoices: number;
    average_payment_time: number;
    overdue_count: number;
  }>;
  status_distribution: Array<{
    status: InvoiceStatus;
    count: number;
    amount: number;
  }>;
}

export interface ReminderConfig {
  id: string;
  invoice_id: string;
  reminder_type: 'before_due' | 'after_due';
  days_offset: number;
  email_template: string;
  is_active: boolean;
  last_sent?: string;
  next_send?: string;
}

export interface BulkInvoiceAction {
  action: 'send' | 'mark_paid' | 'export' | 'delete';
  invoice_ids: string[];
  options?: {
    email_template?: string;
    payment_date?: string;
    payment_method?: string;
    export_format?: 'pdf' | 'csv' | 'excel';
  };
}