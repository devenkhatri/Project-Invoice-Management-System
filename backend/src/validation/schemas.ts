import Joi from 'joi';
import { ProjectStatus, TaskStatus, TaskPriority, InvoiceStatus, PaymentStatus, ExpenseCategory } from '../types';

// Common validation patterns
const idSchema = Joi.string().required();
const optionalIdSchema = Joi.string().optional();
const emailSchema = Joi.string().email().required();
const phoneSchema = Joi.string().pattern(/^[\+]?[0-9\-\s]{7,20}$/).optional();
const currencySchema = Joi.string().length(3).uppercase().default('INR');
const dateSchema = Joi.string().isoDate();
const positiveNumberSchema = Joi.number().positive();
const nonNegativeNumberSchema = Joi.number().min(0);

// GSTIN validation pattern for India
const gstinSchema = Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional();

// PAN validation pattern for India
const panSchema = Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional();

// Project validation schema
export const projectSchema = Joi.object({
  id: optionalIdSchema,
  name: Joi.string().min(1).max(255).required(),
  client_id: idSchema,
  status: Joi.string().valid(...Object.values(ProjectStatus)).default(ProjectStatus.ACTIVE),
  start_date: dateSchema.required(),
  end_date: dateSchema.required(),
  budget: positiveNumberSchema.required(),
  actual_cost: nonNegativeNumberSchema.optional(),
  description: Joi.string().max(1000).optional(),
  progress_percentage: Joi.number().min(0).max(100).optional(),
  is_billable: Joi.boolean().default(true),
  hourly_rate: positiveNumberSchema.optional(),
  currency: currencySchema,
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
}).custom((value, helpers) => {
  // Custom validation: end_date should be after start_date
  if (new Date(value.end_date) <= new Date(value.start_date)) {
    return helpers.error('custom.dateRange');
  }
  return value;
}, 'Date range validation').messages({
  'custom.dateRange': 'End date must be after start date'
});

// Task validation schema
export const taskSchema = Joi.object({
  id: optionalIdSchema,
  project_id: idSchema,
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid(...Object.values(TaskStatus)).default(TaskStatus.TODO),
  priority: Joi.string().valid(...Object.values(TaskPriority)).default(TaskPriority.MEDIUM),
  due_date: dateSchema.required(),
  estimated_hours: positiveNumberSchema.required(),
  actual_hours: nonNegativeNumberSchema.default(0),
  is_billable: Joi.boolean().default(true),
  hourly_rate: positiveNumberSchema.optional(),
  assignee: Joi.string().max(100).optional(),
  dependencies: Joi.array().items(idSchema).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
});

// Client validation schema
export const clientSchema = Joi.object({
  id: optionalIdSchema,
  name: Joi.string().min(1).max(255).required(),
  email: emailSchema,
  phone: phoneSchema,
  address: Joi.string().max(500).required(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  country: Joi.string().max(100).default('India'),
  postal_code: Joi.string().max(20).optional(),
  gstin: gstinSchema,
  pan: panSchema,
  payment_terms: Joi.string().max(255).default('Net 30'),
  default_currency: currencySchema,
  billing_address: Joi.string().max(500).optional(),
  shipping_address: Joi.string().max(500).optional(),
  contact_person: Joi.string().max(100).optional(),
  website: Joi.string().uri().optional(),
  notes: Joi.string().max(1000).optional(),
  is_active: Joi.boolean().default(true),
  portal_access_enabled: Joi.boolean().default(false),
  portal_password_hash: Joi.string().optional(),
  last_portal_login: dateSchema.optional(),
  company_name: Joi.string().max(255).optional(),
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
});

// Invoice line item validation schema
export const invoiceLineItemSchema = Joi.object({
  id: optionalIdSchema,
  description: Joi.string().min(1).max(255).required(),
  quantity: positiveNumberSchema.required(),
  unit_price: positiveNumberSchema.required(),
  total_price: positiveNumberSchema.required(),
  tax_rate: nonNegativeNumberSchema.max(100).required(),
  tax_amount: nonNegativeNumberSchema.required(),
  hsn_sac_code: Joi.string().max(20).optional()
});

// Tax breakdown validation schema
export const taxBreakdownSchema = Joi.object({
  cgst_rate: nonNegativeNumberSchema.max(100).default(0),
  cgst_amount: nonNegativeNumberSchema.default(0),
  sgst_rate: nonNegativeNumberSchema.max(100).default(0),
  sgst_amount: nonNegativeNumberSchema.default(0),
  igst_rate: nonNegativeNumberSchema.max(100).default(0),
  igst_amount: nonNegativeNumberSchema.default(0),
  total_tax_amount: nonNegativeNumberSchema.required()
});

// Invoice validation schema
export const invoiceSchema = Joi.object({
  id: optionalIdSchema,
  invoice_number: Joi.string().min(1).max(50).required(),
  client_id: idSchema,
  project_id: optionalIdSchema,
  line_items: Joi.array().items(invoiceLineItemSchema).min(1).required(),
  subtotal: positiveNumberSchema.required(),
  tax_breakdown: taxBreakdownSchema.required(),
  total_amount: positiveNumberSchema.required(),
  currency: currencySchema,
  status: Joi.string().valid(...Object.values(InvoiceStatus)).default(InvoiceStatus.DRAFT),
  issue_date: dateSchema.required(),
  due_date: dateSchema.required(),
  payment_terms: Joi.string().max(255).default('Net 30'),
  notes: Joi.string().max(1000).allow('').optional(),
  terms_conditions: Joi.string().max(2000).allow('').optional(),
  is_recurring: Joi.boolean().default(false),
  recurring_frequency: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly').allow(null).optional(),
  next_invoice_date: dateSchema.allow(null).optional(),
  payment_status: Joi.string().valid(...Object.values(PaymentStatus)).default(PaymentStatus.PENDING),
  paid_amount: nonNegativeNumberSchema.default(0),
  payment_date: dateSchema.allow(null).optional(),
  payment_method: Joi.string().max(100).allow(null).optional(),
  late_fee_applied: nonNegativeNumberSchema.optional(),
  discount_percentage: Joi.number().min(0).max(100).optional(),
  discount_amount: nonNegativeNumberSchema.optional(),
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
}).custom((value, helpers) => {
  // Custom validation: due_date should be after issue_date
  if (new Date(value.due_date) <= new Date(value.issue_date)) {
    return helpers.error('custom.dueDateRange');
  }
  
  // Validate that paid_amount doesn't exceed total_amount
  if (value.paid_amount > value.total_amount) {
    return helpers.error('custom.paidAmountExceeds');
  }
  
  return value;
}, 'Invoice validation').messages({
  'custom.dueDateRange': 'Due date must be after issue date',
  'custom.paidAmountExceeds': 'Paid amount cannot exceed total amount'
});

// Time entry validation schema
export const timeEntrySchema = Joi.object({
  id: optionalIdSchema,
  task_id: idSchema,
  project_id: idSchema,
  hours: positiveNumberSchema.required(),
  description: Joi.string().max(500).required(),
  date: dateSchema.required(),
  start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  is_billable: Joi.boolean().default(true),
  hourly_rate: positiveNumberSchema.optional(),
  total_amount: nonNegativeNumberSchema.optional(),
  user_id: optionalIdSchema,
  invoice_id: optionalIdSchema,
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
}).custom((value, helpers) => {
  // Custom validation: end_time should be after start_time if both provided
  if (value.start_time && value.end_time) {
    const [startHour, startMin] = value.start_time.split(':').map(Number);
    const [endHour, endMin] = value.end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      return helpers.error('custom.timeRange');
    }
  }
  
  return value;
}, 'Time validation').messages({
  'custom.timeRange': 'End time must be after start time'
});

// Expense validation schema
export const expenseSchema = Joi.object({
  id: optionalIdSchema,
  project_id: idSchema,
  category: Joi.string().valid(...Object.values(ExpenseCategory)).required(),
  amount: positiveNumberSchema.required(),
  currency: currencySchema,
  description: Joi.string().min(1).max(500).required(),
  date: dateSchema.required(),
  receipt_url: Joi.string().uri().optional(),
  vendor: Joi.string().max(255).optional(),
  is_billable: Joi.boolean().default(false),
  tax_amount: nonNegativeNumberSchema.optional(),
  tax_rate: nonNegativeNumberSchema.max(100).optional(),
  reimbursable: Joi.boolean().default(false),
  approval_status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
  approved_by: Joi.string().max(100).optional(),
  approved_at: dateSchema.optional(),
  invoice_id: optionalIdSchema,
  created_at: dateSchema.optional(),
  updated_at: dateSchema.optional()
});

// Validation function factory
export const createValidator = (schema: Joi.ObjectSchema) => {
  return (data: any) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      return { isValid: false, errors, data: null };
    }
    
    return { isValid: true, errors: [], data: value };
  };
};

// Export validators
export const validateProject = createValidator(projectSchema);
export const validateTask = createValidator(taskSchema);
export const validateClient = createValidator(clientSchema);
export const validateInvoice = createValidator(invoiceSchema);
export const validateTimeEntry = createValidator(timeEntrySchema);
export const validateExpense = createValidator(expenseSchema);