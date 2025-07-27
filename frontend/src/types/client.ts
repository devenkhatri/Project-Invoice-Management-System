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
  last_portal_login?: string;
  company_name?: string;
  created_at: string;
  updated_at?: string;
  
  // Computed fields from API
  project_count?: number;
  active_projects?: number;
  invoice_count?: number;
  total_invoiced?: number;
  paid_amount?: number;
  outstanding_amount?: number;
  overdue_invoices?: number;
  last_invoice_date?: number;
  gst_compliant?: boolean;
  payment_terms_days?: number;
}

export interface ClientFormData {
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
  company_name?: string;
}

export interface ClientOnboardingData {
  client_data: ClientFormData;
  documents?: ClientDocument[];
  portal_access?: boolean;
}

export interface ClientDocument {
  id?: string;
  client_id?: string;
  document_type: string;
  document_name: string;
  file_url: string;
  status?: 'pending_review' | 'approved' | 'rejected';
  uploaded_at?: string;
}

export interface ClientActivity {
  id: string;
  activity: string;
  metadata: Record<string, any>;
  timestamp: string;
  formatted_time: string;
}

export interface ClientCommunication {
  id: string;
  subject: string;
  message: string;
  sender: 'client' | 'admin';
  sender_name: string;
  sender_email: string;
  status: 'unread' | 'read';
  project_id?: string;
  thread_id: string;
  created_at: string;
  is_read: boolean;
}

export interface ClientPortalData {
  client: {
    id: string;
    name: string;
    email: string;
    company: string;
    contact_person: string;
  };
  summary: {
    projects: {
      total: number;
      active: number;
      completed: number;
      on_hold: number;
    };
    invoices: {
      total: number;
      pending: number;
      overdue: number;
      paid: number;
    };
    financial: {
      total_invoiced: number;
      paid_amount: number;
      outstanding_amount: number;
      currency: string;
    };
  };
  recent_projects: Array<{
    id: string;
    name: string;
    status: string;
    progress_percentage: number;
    end_date: string;
    budget: number;
  }>;
  recent_invoices: Array<{
    id: string;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    status: string;
    due_date: string;
    issue_date: string;
  }>;
  upcoming_deadlines: Array<{
    project_id: string;
    project_name: string;
    end_date: string;
    days_remaining: number;
  }>;
  recent_communications: ClientCommunication[];
}

export interface ClientFilters {
  search?: string;
  country?: string;
  is_active?: boolean;
  gstin?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ClientAnalytics {
  client_profitability: number;
  lifetime_value: number;
  communication_frequency: number;
  response_time: number;
  satisfaction_score?: number;
}