"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Invoice = exports.InvoiceSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.InvoiceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    invoice_number: zod_1.z.string().min(1, 'Invoice number is required').max(50, 'Invoice number too long'),
    client_id: zod_1.z.string().min(1, 'Client ID is required'),
    project_id: zod_1.z.string().min(1, 'Project ID is required'),
    amount: zod_1.z.number().min(0, 'Amount must be non-negative'),
    tax_amount: zod_1.z.number().min(0, 'Tax amount must be non-negative'),
    total_amount: zod_1.z.number().min(0, 'Total amount must be non-negative'),
    status: zod_1.z.nativeEnum(types_1.InvoiceStatus),
    due_date: zod_1.z.date(),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
}).refine(data => data.total_amount >= data.amount + data.tax_amount, {
    message: 'Total amount must be at least the sum of amount and tax',
    path: ['total_amount']
});
class Invoice {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.invoice_number = data.invoice_number || this.generateInvoiceNumber();
        this.client_id = data.client_id || '';
        this.project_id = data.project_id || '';
        this.amount = data.amount || 0;
        this.tax_amount = data.tax_amount || 0;
        this.total_amount = data.total_amount || 0;
        this.status = data.status || types_1.InvoiceStatus.DRAFT;
        this.due_date = data.due_date || this.getDefaultDueDate();
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'inv_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-6);
        return `INV-${year}${month}-${timestamp}`;
    }
    getDefaultDueDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
    }
    validate() {
        try {
            exports.InvoiceSchema.parse(this);
            return { isValid: true, errors: [] };
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                const errors = error.issues.map((err) => ({
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
    isPaid() {
        return this.status === types_1.InvoiceStatus.PAID;
    }
    isOverdue() {
        return this.due_date < new Date() && this.status !== types_1.InvoiceStatus.PAID;
    }
    getDaysOverdue() {
        if (!this.isOverdue())
            return 0;
        const today = new Date();
        const diffTime = today.getTime() - this.due_date.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    getDaysUntilDue() {
        const today = new Date();
        if (this.due_date < today)
            return 0;
        const diffTime = this.due_date.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    calculateGST(rate = 18) {
        this.tax_amount = (this.amount * rate) / 100;
        this.total_amount = this.amount + this.tax_amount;
        this.updated_at = new Date();
    }
    markAsSent() {
        if (this.status === types_1.InvoiceStatus.DRAFT) {
            this.status = types_1.InvoiceStatus.SENT;
            this.updated_at = new Date();
        }
    }
    markAsPaid() {
        this.status = types_1.InvoiceStatus.PAID;
        this.updated_at = new Date();
    }
    markAsOverdue() {
        if (this.status === types_1.InvoiceStatus.SENT && this.isOverdue()) {
            this.status = types_1.InvoiceStatus.OVERDUE;
            this.updated_at = new Date();
        }
    }
    updateAmount(amount, taxRate = 18) {
        if (amount < 0) {
            throw new Error('Amount cannot be negative');
        }
        this.amount = amount;
        this.calculateGST(taxRate);
    }
    updateDueDate(dueDate) {
        this.due_date = dueDate;
        this.updated_at = new Date();
    }
    getSubtotal() {
        return this.amount;
    }
    getTaxRate() {
        if (this.amount === 0)
            return 0;
        return (this.tax_amount / this.amount) * 100;
    }
    toSheetRow() {
        return {
            id: this.id,
            invoice_number: this.invoice_number,
            client_id: this.client_id,
            project_id: this.project_id,
            amount: this.amount,
            tax_amount: this.tax_amount,
            total_amount: this.total_amount,
            status: this.status,
            due_date: this.due_date.toISOString(),
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }
    static fromSheetRow(row) {
        return new Invoice({
            id: row.id,
            invoice_number: row.invoice_number,
            client_id: row.client_id,
            project_id: row.project_id,
            amount: parseFloat(row.amount) || 0,
            tax_amount: parseFloat(row.tax_amount) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            status: row.status,
            due_date: new Date(row.due_date),
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
}
exports.Invoice = Invoice;
//# sourceMappingURL=Invoice.js.map