"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateExpense = exports.validateTimeEntry = exports.validateInvoice = exports.validateClient = exports.validateTask = exports.validateProject = exports.createValidator = exports.expenseSchema = exports.timeEntrySchema = exports.invoiceSchema = exports.taxBreakdownSchema = exports.invoiceLineItemSchema = exports.clientSchema = exports.taskSchema = exports.projectSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const types_1 = require("../types");
const idSchema = joi_1.default.string().required();
const optionalIdSchema = joi_1.default.string().optional();
const emailSchema = joi_1.default.string().email().required();
const phoneSchema = joi_1.default.string().pattern(/^[\+]?[0-9\-\s]{7,20}$/).optional();
const currencySchema = joi_1.default.string().length(3).uppercase().default('INR');
const dateSchema = joi_1.default.string().isoDate();
const positiveNumberSchema = joi_1.default.number().positive();
const nonNegativeNumberSchema = joi_1.default.number().min(0);
const gstinSchema = joi_1.default.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional();
const panSchema = joi_1.default.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional();
exports.projectSchema = joi_1.default.object({
    id: optionalIdSchema,
    name: joi_1.default.string().min(1).max(255).required(),
    client_id: idSchema,
    status: joi_1.default.string().valid(...Object.values(types_1.ProjectStatus)).default(types_1.ProjectStatus.ACTIVE),
    start_date: dateSchema.required(),
    end_date: dateSchema.required(),
    budget: positiveNumberSchema.required(),
    actual_cost: nonNegativeNumberSchema.optional(),
    description: joi_1.default.string().max(1000).optional(),
    progress_percentage: joi_1.default.number().min(0).max(100).optional(),
    is_billable: joi_1.default.boolean().default(true),
    hourly_rate: positiveNumberSchema.optional(),
    currency: currencySchema,
    tags: joi_1.default.array().items(joi_1.default.string().max(50)).optional(),
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
}).custom((value, helpers) => {
    if (new Date(value.end_date) <= new Date(value.start_date)) {
        return helpers.error('custom.dateRange');
    }
    return value;
}, 'Date range validation').messages({
    'custom.dateRange': 'End date must be after start date'
});
exports.taskSchema = joi_1.default.object({
    id: optionalIdSchema,
    project_id: idSchema,
    title: joi_1.default.string().min(1).max(255).required(),
    description: joi_1.default.string().max(1000).optional(),
    status: joi_1.default.string().valid(...Object.values(types_1.TaskStatus)).default(types_1.TaskStatus.TODO),
    priority: joi_1.default.string().valid(...Object.values(types_1.TaskPriority)).default(types_1.TaskPriority.MEDIUM),
    due_date: dateSchema.required(),
    estimated_hours: positiveNumberSchema.required(),
    actual_hours: nonNegativeNumberSchema.default(0),
    is_billable: joi_1.default.boolean().default(true),
    hourly_rate: positiveNumberSchema.optional(),
    assignee: joi_1.default.string().max(100).optional(),
    dependencies: joi_1.default.array().items(idSchema).optional(),
    tags: joi_1.default.array().items(joi_1.default.string().max(50)).optional(),
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
});
exports.clientSchema = joi_1.default.object({
    id: optionalIdSchema,
    name: joi_1.default.string().min(1).max(255).required(),
    email: emailSchema,
    phone: phoneSchema,
    address: joi_1.default.string().max(500).required(),
    city: joi_1.default.string().max(100).optional(),
    state: joi_1.default.string().max(100).optional(),
    country: joi_1.default.string().max(100).default('India'),
    postal_code: joi_1.default.string().max(20).optional(),
    gstin: gstinSchema,
    pan: panSchema,
    payment_terms: joi_1.default.string().max(255).default('Net 30'),
    default_currency: currencySchema,
    billing_address: joi_1.default.string().max(500).optional(),
    shipping_address: joi_1.default.string().max(500).optional(),
    contact_person: joi_1.default.string().max(100).optional(),
    website: joi_1.default.string().uri().optional(),
    notes: joi_1.default.string().max(1000).optional(),
    is_active: joi_1.default.boolean().default(true),
    portal_access_enabled: joi_1.default.boolean().default(false),
    portal_password_hash: joi_1.default.string().optional(),
    last_portal_login: dateSchema.optional(),
    company_name: joi_1.default.string().max(255).optional(),
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
});
exports.invoiceLineItemSchema = joi_1.default.object({
    id: optionalIdSchema,
    description: joi_1.default.string().min(1).max(255).required(),
    quantity: positiveNumberSchema.required(),
    unit_price: positiveNumberSchema.required(),
    total_price: positiveNumberSchema.required(),
    tax_rate: nonNegativeNumberSchema.max(100).required(),
    tax_amount: nonNegativeNumberSchema.required(),
    hsn_sac_code: joi_1.default.string().max(20).optional()
});
exports.taxBreakdownSchema = joi_1.default.object({
    cgst_rate: nonNegativeNumberSchema.max(100).default(0),
    cgst_amount: nonNegativeNumberSchema.default(0),
    sgst_rate: nonNegativeNumberSchema.max(100).default(0),
    sgst_amount: nonNegativeNumberSchema.default(0),
    igst_rate: nonNegativeNumberSchema.max(100).default(0),
    igst_amount: nonNegativeNumberSchema.default(0),
    total_tax_amount: nonNegativeNumberSchema.required()
});
exports.invoiceSchema = joi_1.default.object({
    id: optionalIdSchema,
    invoice_number: joi_1.default.string().min(1).max(50).required(),
    client_id: idSchema,
    project_id: optionalIdSchema,
    line_items: joi_1.default.array().items(exports.invoiceLineItemSchema).min(1).required(),
    subtotal: positiveNumberSchema.required(),
    tax_breakdown: exports.taxBreakdownSchema.required(),
    total_amount: positiveNumberSchema.required(),
    currency: currencySchema,
    status: joi_1.default.string().valid(...Object.values(types_1.InvoiceStatus)).default(types_1.InvoiceStatus.DRAFT),
    issue_date: dateSchema.required(),
    due_date: dateSchema.required(),
    payment_terms: joi_1.default.string().max(255).default('Net 30'),
    notes: joi_1.default.string().max(1000).allow('').optional(),
    terms_conditions: joi_1.default.string().max(2000).allow('').optional(),
    is_recurring: joi_1.default.boolean().default(false),
    recurring_frequency: joi_1.default.string().valid('weekly', 'monthly', 'quarterly', 'yearly').allow(null).optional(),
    next_invoice_date: dateSchema.allow(null).optional(),
    payment_status: joi_1.default.string().valid(...Object.values(types_1.PaymentStatus)).default(types_1.PaymentStatus.PENDING),
    paid_amount: nonNegativeNumberSchema.default(0),
    payment_date: dateSchema.allow(null).optional(),
    payment_method: joi_1.default.string().max(100).allow(null).optional(),
    late_fee_applied: nonNegativeNumberSchema.optional(),
    discount_percentage: joi_1.default.number().min(0).max(100).optional(),
    discount_amount: nonNegativeNumberSchema.optional(),
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
}).custom((value, helpers) => {
    if (new Date(value.due_date) <= new Date(value.issue_date)) {
        return helpers.error('custom.dueDateRange');
    }
    if (value.paid_amount > value.total_amount) {
        return helpers.error('custom.paidAmountExceeds');
    }
    return value;
}, 'Invoice validation').messages({
    'custom.dueDateRange': 'Due date must be after issue date',
    'custom.paidAmountExceeds': 'Paid amount cannot exceed total amount'
});
exports.timeEntrySchema = joi_1.default.object({
    id: optionalIdSchema,
    task_id: idSchema,
    project_id: idSchema,
    hours: positiveNumberSchema.required(),
    description: joi_1.default.string().max(500).required(),
    date: dateSchema.required(),
    start_time: joi_1.default.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    end_time: joi_1.default.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    is_billable: joi_1.default.boolean().default(true),
    hourly_rate: positiveNumberSchema.optional(),
    total_amount: nonNegativeNumberSchema.optional(),
    user_id: optionalIdSchema,
    invoice_id: optionalIdSchema,
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
}).custom((value, helpers) => {
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
exports.expenseSchema = joi_1.default.object({
    id: optionalIdSchema,
    project_id: idSchema,
    category: joi_1.default.string().valid(...Object.values(types_1.ExpenseCategory)).required(),
    amount: positiveNumberSchema.required(),
    currency: currencySchema,
    description: joi_1.default.string().min(1).max(500).required(),
    date: dateSchema.required(),
    receipt_url: joi_1.default.string().uri().optional(),
    vendor: joi_1.default.string().max(255).optional(),
    is_billable: joi_1.default.boolean().default(false),
    tax_amount: nonNegativeNumberSchema.optional(),
    tax_rate: nonNegativeNumberSchema.max(100).optional(),
    reimbursable: joi_1.default.boolean().default(false),
    approval_status: joi_1.default.string().valid('pending', 'approved', 'rejected').default('pending'),
    approved_by: joi_1.default.string().max(100).optional(),
    approved_at: dateSchema.optional(),
    invoice_id: optionalIdSchema,
    created_at: dateSchema.optional(),
    updated_at: dateSchema.optional()
});
const createValidator = (schema) => {
    return (data) => {
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
exports.createValidator = createValidator;
exports.validateProject = (0, exports.createValidator)(exports.projectSchema);
exports.validateTask = (0, exports.createValidator)(exports.taskSchema);
exports.validateClient = (0, exports.createValidator)(exports.clientSchema);
exports.validateInvoice = (0, exports.createValidator)(exports.invoiceSchema);
exports.validateTimeEntry = (0, exports.createValidator)(exports.timeEntrySchema);
exports.validateExpense = (0, exports.createValidator)(exports.expenseSchema);
//# sourceMappingURL=schemas.js.map