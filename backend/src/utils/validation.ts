import { QueryFilter } from '../types';

// Helper validation functions
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

export const isValidPAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidCurrency = (currency: string): boolean => {
  const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD'];
  return validCurrencies.includes(currency.toUpperCase());
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Date validation helpers
export const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const isDateInFuture = (dateString: string): boolean => {
  const date = new Date(dateString);
  const now = new Date();
  return date > now;
};

export const isDateInPast = (dateString: string): boolean => {
  const date = new Date(dateString);
  const now = new Date();
  return date < now;
};

// Type conversion utilities
export const convertToSheetRow = (data: any, headers: string[]): any[] => {
  return headers.map(header => {
    const value = data[header];
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value);
  });
};

export const convertFromSheetRow = (row: any[], headers: string[]): any => {
  const result: any = {};
  headers.forEach((header, index) => {
    const value = row[index];
    if (value === '' || value === null || value === undefined) {
      result[header] = null;
    } else if (header.includes('_at') || header.includes('date')) {
      // Handle date fields - ensure proper ISO format
      if (isValidDate(value)) {
        result[header] = new Date(value).toISOString();
      } else {
        result[header] = value; // Keep original if not a valid date
      }
    } else if (header.includes('amount') || header.includes('budget') || header.includes('hours') || header.includes('rate')) {
      // Handle numeric fields with better validation
      const numValue = parseFloat(value);
      result[header] = isNaN(numValue) ? 0 : numValue;
    } else if (header.includes('is_') || value === 'TRUE' || value === 'FALSE') {
      // Handle boolean fields
      result[header] = value === 'TRUE' || value === true;
    } else if (header.includes('tags') || header.includes('dependencies')) {
      // Handle array fields
      try {
        result[header] = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        result[header] = typeof value === 'string' ? value.split(',').map(s => s.trim()) : [];
      }
    } else {
      result[header] = value;
    }
  });
  return result;
};

// Enhanced data validation for specific sheet types
export const validateSheetData = (sheetName: string, data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Common validations
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Invalid phone number format');
  }

  if (data.gstin && !isValidGSTIN(data.gstin)) {
    errors.push('Invalid GSTIN format');
  }

  if (data.pan && !isValidPAN(data.pan)) {
    errors.push('Invalid PAN format');
  }

  if (data.currency && !isValidCurrency(data.currency)) {
    errors.push('Invalid currency code');
  }

  if (data.receipt_url && !isValidURL(data.receipt_url)) {
    errors.push('Invalid receipt URL format');
  }

  // Date validations
  const dateFields = ['start_date', 'end_date', 'due_date', 'date', 'created_at', 'updated_at'];
  dateFields.forEach(field => {
    if (data[field] && !isValidDate(data[field])) {
      errors.push(`Invalid date format for ${field}`);
    }
  });

  // Numeric validations
  const numericFields = ['budget', 'amount', 'tax_amount', 'total_amount', 'hours', 'estimated_hours', 'actual_hours'];
  numericFields.forEach(field => {
    if (data[field] !== undefined && data[field] !== null) {
      const numValue = parseFloat(data[field]);
      if (isNaN(numValue)) {
        errors.push(`${field} must be a valid number`);
      } else if (numValue < 0) {
        errors.push(`${field} cannot be negative`);
      }
    }
  });

  // Sheet-specific validations
  switch (sheetName) {
    case 'Projects':
      if (!data.name || data.name.trim().length === 0) {
        errors.push('Project name is required');
      }
      if (!data.client_id || data.client_id.trim().length === 0) {
        errors.push('Client ID is required');
      }
      if (data.status && !['active', 'completed', 'on-hold'].includes(data.status)) {
        errors.push('Invalid project status');
      }
      if (data.start_date && data.end_date && new Date(data.start_date) > new Date(data.end_date)) {
        errors.push('Start date cannot be after end date');
      }
      break;

    case 'Tasks':
      if (!data.title || data.title.trim().length === 0) {
        errors.push('Task title is required');
      }
      if (!data.project_id || data.project_id.trim().length === 0) {
        errors.push('Project ID is required');
      }
      if (data.status && !['todo', 'in-progress', 'completed'].includes(data.status)) {
        errors.push('Invalid task status');
      }
      if (data.priority && !['low', 'medium', 'high'].includes(data.priority)) {
        errors.push('Invalid task priority');
      }
      if (data.estimated_hours && data.actual_hours && data.actual_hours > data.estimated_hours * 2) {
        console.warn('Warning: Actual hours significantly exceed estimated hours');
      }
      break;

    case 'Clients':
      if (!data.name || data.name.trim().length === 0) {
        errors.push('Client name is required');
      }
      if (!data.email || data.email.trim().length === 0) {
        errors.push('Client email is required');
      }
      if (data.country && data.country.length !== 2) {
        errors.push('Country code must be 2 characters (ISO 3166-1 alpha-2)');
      }
      break;

    case 'Invoices':
      if (!data.invoice_number || data.invoice_number.trim().length === 0) {
        errors.push('Invoice number is required');
      }
      if (!data.client_id || data.client_id.trim().length === 0) {
        errors.push('Client ID is required');
      }
      if (data.status && !['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(data.status)) {
        errors.push('Invalid invoice status');
      }
      if (data.payment_status && !['pending', 'partial', 'paid', 'failed', 'refunded'].includes(data.payment_status)) {
        errors.push('Invalid payment status');
      }
      if (data.issue_date && data.due_date && new Date(data.issue_date) > new Date(data.due_date)) {
        errors.push('Issue date cannot be after due date');
      }
      if (data.subtotal && data.total_amount && data.total_amount < data.subtotal) {
        errors.push('Total amount cannot be less than subtotal');
      }
      break;

    case 'Time_Entries':
      if (!data.task_id || data.task_id.trim().length === 0) {
        errors.push('Task ID is required');
      }
      if (!data.project_id || data.project_id.trim().length === 0) {
        errors.push('Project ID is required');
      }
      if (!data.hours || data.hours <= 0) {
        errors.push('Hours must be greater than 0');
      }
      if (data.hours && data.hours > 24) {
        errors.push('Hours cannot exceed 24 in a single entry');
      }
      if (data.start_time && data.end_time) {
        const start = new Date(`1970-01-01T${data.start_time}`);
        const end = new Date(`1970-01-01T${data.end_time}`);
        if (start >= end) {
          errors.push('Start time must be before end time');
        }
      }
      break;

    case 'Expenses':
      if (!data.project_id || data.project_id.trim().length === 0) {
        errors.push('Project ID is required');
      }
      if (!data.category || data.category.trim().length === 0) {
        errors.push('Expense category is required');
      }
      if (!data.amount || data.amount <= 0) {
        errors.push('Expense amount must be greater than 0');
      }
      if (data.approval_status && !['pending', 'approved', 'rejected'].includes(data.approval_status)) {
        errors.push('Invalid approval status');
      }
      if (data.tax_rate && (data.tax_rate < 0 || data.tax_rate > 100)) {
        errors.push('Tax rate must be between 0 and 100');
      }
      break;
  }

  return { isValid: errors.length === 0, errors };
};

// Query filter validation
export const validateQueryFilters = (filters: QueryFilter[]): string[] => {
  const errors: string[] = [];
  
  filters.forEach((filter, index) => {
    if (!filter.column || filter.column.trim().length === 0) {
      errors.push(`Filter ${index + 1}: Column is required`);
    }
    
    if (!['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains'].includes(filter.operator)) {
      errors.push(`Filter ${index + 1}: Invalid operator`);
    }
    
    if (filter.value === null || filter.value === undefined) {
      errors.push(`Filter ${index + 1}: Value is required`);
    }
  });
  
  return errors;
};

// Data sanitization
export const sanitizeData = (data: any): any => {
  if (typeof data === 'string') {
    return data.trim().replace(/[<>]/g, '');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    Object.keys(data).forEach(key => {
      sanitized[key] = sanitizeData(data[key]);
    });
    return sanitized;
  }
  
  return data;
};



// Formatting utilities
export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

export const formatDate = (dateString: string, locale: string = 'en-IN'): string => {
  return new Date(dateString).toLocaleDateString(locale);
};

export const formatDateTime = (dateString: string, locale: string = 'en-IN'): string => {
  return new Date(dateString).toLocaleString(locale);
};

export const formatDuration = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

// ID generation utilities
export const generateId = (prefix?: string): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
};

export const generateInvoiceNumber = (prefix: string = 'INV', sequence?: number): string => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = sequence ? String(sequence).padStart(4, '0') : String(Date.now()).slice(-4);
  return `${prefix}-${year}${month}-${seq}`;
};

// Calculation utilities
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 100) / 100;
};

export const calculateGST = (amount: number, rate: number): {
  taxAmount: number;
  totalAmount: number;
} => {
  const taxAmount = Math.round((amount * rate / 100) * 100) / 100;
  const totalAmount = Math.round((amount + taxAmount) * 100) / 100;
  return { taxAmount, totalAmount };
};

export const roundToTwoDecimals = (value: number): number => {
  return Math.round(value * 100) / 100;
};

// Array utilities
export const groupBy = <T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], keyFn: (item: T) => any, order: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

export const unique = <T>(array: T[], keyFn?: (item: T) => any): T[] => {
  if (!keyFn) {
    return Array.from(new Set(array));
  }
  
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};