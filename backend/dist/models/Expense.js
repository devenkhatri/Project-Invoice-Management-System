"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = exports.ExpenseSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.ExpenseSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    project_id: zod_1.z.string().min(1, 'Project ID is required'),
    category: zod_1.z.nativeEnum(types_1.ExpenseCategory),
    amount: zod_1.z.number().min(0.01, 'Amount must be greater than 0'),
    description: zod_1.z.string().min(1, 'Description is required').max(500, 'Description too long'),
    date: zod_1.z.date(),
    receipt_url: zod_1.z.union([
        zod_1.z.string().url('Invalid URL format'),
        zod_1.z.literal('')
    ]).optional().default(''),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
});
class Expense {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.project_id = data.project_id || '';
        this.category = data.category || types_1.ExpenseCategory.OTHER;
        this.amount = data.amount || 0;
        this.description = data.description || '';
        this.date = data.date || new Date();
        this.receipt_url = data.receipt_url || '';
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'exp_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validate() {
        try {
            exports.ExpenseSchema.parse(this);
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
    hasReceipt() {
        return this.receipt_url.length > 0;
    }
    isToday() {
        const today = new Date();
        return this.date.toDateString() === today.toDateString();
    }
    isThisMonth() {
        const today = new Date();
        return this.date.getMonth() === today.getMonth() &&
            this.date.getFullYear() === today.getFullYear();
    }
    isThisYear() {
        const today = new Date();
        return this.date.getFullYear() === today.getFullYear();
    }
    getFormattedAmount() {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(this.amount);
    }
    getCategoryDisplayName() {
        return this.category.charAt(0).toUpperCase() + this.category.slice(1).toLowerCase();
    }
    updateAmount(amount) {
        if (amount <= 0) {
            throw new Error('Amount must be greater than 0');
        }
        this.amount = amount;
        this.updated_at = new Date();
    }
    updateCategory(category) {
        this.category = category;
        this.updated_at = new Date();
    }
    updateDescription(description) {
        if (!description.trim()) {
            throw new Error('Description cannot be empty');
        }
        this.description = description;
        this.updated_at = new Date();
    }
    updateReceiptUrl(url) {
        this.receipt_url = url;
        this.updated_at = new Date();
    }
    updateDate(date) {
        this.date = date;
        this.updated_at = new Date();
    }
    isWithinDateRange(startDate, endDate) {
        return this.date >= startDate && this.date <= endDate;
    }
    isTaxDeductible() {
        const deductibleCategories = [
            types_1.ExpenseCategory.EQUIPMENT,
            types_1.ExpenseCategory.SOFTWARE,
            types_1.ExpenseCategory.OFFICE,
            types_1.ExpenseCategory.TRAVEL
        ];
        return deductibleCategories.includes(this.category);
    }
    toSheetRow() {
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
    static fromSheetRow(row) {
        return new Expense({
            id: row.id,
            project_id: row.project_id,
            category: row.category,
            amount: parseFloat(row.amount) || 0,
            description: row.description || '',
            date: new Date(row.date),
            receipt_url: row.receipt_url || '',
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
    static calculateTotal(expenses) {
        return expenses.reduce((total, expense) => total + expense.amount, 0);
    }
    static groupByCategory(expenses) {
        const grouped = new Map();
        expenses.forEach(expense => {
            if (!grouped.has(expense.category)) {
                grouped.set(expense.category, []);
            }
            grouped.get(expense.category).push(expense);
        });
        return grouped;
    }
    static filterByDateRange(expenses, startDate, endDate) {
        return expenses.filter(expense => expense.isWithinDateRange(startDate, endDate));
    }
    static filterByCategory(expenses, category) {
        return expenses.filter(expense => expense.category === category);
    }
    static getTaxDeductible(expenses) {
        return expenses.filter(expense => expense.isTaxDeductible());
    }
}
exports.Expense = Expense;
//# sourceMappingURL=Expense.js.map