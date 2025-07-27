"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const types_1 = require("../types");
const schemas_1 = require("../validation/schemas");
class Expense {
    constructor(data) {
        const validation = (0, schemas_1.validateExpense)(data);
        if (!validation.isValid) {
            throw new Error(`Invalid expense data: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const validatedData = validation.data;
        Object.assign(this, validatedData);
        if (!this.created_at) {
            this.created_at = new Date().toISOString();
        }
        this.updated_at = new Date().toISOString();
    }
    calculateTotalAmount() {
        return this.amount + (this.tax_amount || 0);
    }
    calculateTaxAmount() {
        if (!this.tax_rate)
            return 0;
        return Math.round((this.amount * this.tax_rate / 100) * 100) / 100;
    }
    updateTaxAmount() {
        this.tax_amount = this.calculateTaxAmount();
        this.updated_at = new Date().toISOString();
    }
    approve(approvedBy) {
        this.approval_status = 'approved';
        this.approved_by = approvedBy;
        this.approved_at = new Date().toISOString();
        this.updated_at = new Date().toISOString();
    }
    reject() {
        this.approval_status = 'rejected';
        this.approved_by = undefined;
        this.approved_at = undefined;
        this.updated_at = new Date().toISOString();
    }
    isApproved() {
        return this.approval_status === 'approved';
    }
    isRejected() {
        return this.approval_status === 'rejected';
    }
    isPending() {
        return this.approval_status === 'pending';
    }
    markAsBilled(invoiceId) {
        if (!this.is_billable) {
            throw new Error('Cannot bill non-billable expense');
        }
        this.invoice_id = invoiceId;
        this.updated_at = new Date().toISOString();
    }
    isBilled() {
        return !!this.invoice_id;
    }
    toggleBillable() {
        this.is_billable = !this.is_billable;
        this.updated_at = new Date().toISOString();
    }
    getCategoryDisplayName() {
        const categoryNames = {
            [types_1.ExpenseCategory.TRAVEL]: 'Travel & Transportation',
            [types_1.ExpenseCategory.EQUIPMENT]: 'Equipment & Hardware',
            [types_1.ExpenseCategory.SOFTWARE]: 'Software & Subscriptions',
            [types_1.ExpenseCategory.MARKETING]: 'Marketing & Advertising',
            [types_1.ExpenseCategory.OFFICE]: 'Office Supplies',
            [types_1.ExpenseCategory.PROFESSIONAL]: 'Professional Services',
            [types_1.ExpenseCategory.OTHER]: 'Other'
        };
        return categoryNames[this.category] || this.category;
    }
    isDeductible() {
        const deductibleCategories = [
            types_1.ExpenseCategory.EQUIPMENT,
            types_1.ExpenseCategory.SOFTWARE,
            types_1.ExpenseCategory.PROFESSIONAL,
            types_1.ExpenseCategory.OFFICE,
            types_1.ExpenseCategory.TRAVEL
        ];
        return deductibleCategories.includes(this.category);
    }
    isToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.date === today;
    }
    isThisWeek() {
        const expenseDate = new Date(this.date);
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        return expenseDate >= startOfWeek && expenseDate <= endOfWeek;
    }
    isThisMonth() {
        const expenseDate = new Date(this.date);
        const today = new Date();
        return expenseDate.getMonth() === today.getMonth() &&
            expenseDate.getFullYear() === today.getFullYear();
    }
    hasReceipt() {
        return !!this.receipt_url;
    }
    updateReceipt(receiptUrl) {
        this.receipt_url = receiptUrl;
        this.updated_at = new Date().toISOString();
    }
    removeReceipt() {
        this.receipt_url = undefined;
        this.updated_at = new Date().toISOString();
    }
    getFormattedAmount() {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: this.currency
        }).format(this.amount);
    }
    getFormattedTotalAmount() {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: this.currency
        }).format(this.calculateTotalAmount());
    }
    getFormattedDate() {
        return new Date(this.date).toLocaleDateString();
    }
    static calculateTotalAmount(expenses) {
        return expenses.reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
    }
    static calculateTotalByCategory(expenses) {
        const totals = {};
        Object.values(types_1.ExpenseCategory).forEach(category => {
            totals[category] = 0;
        });
        expenses.forEach(expense => {
            totals[expense.category] += expense.calculateTotalAmount();
        });
        return totals;
    }
    static calculateBillableAmount(expenses) {
        return expenses
            .filter(expense => expense.is_billable)
            .reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
    }
    static calculateReimbursableAmount(expenses) {
        return expenses
            .filter(expense => expense.reimbursable && expense.isApproved())
            .reduce((total, expense) => total + expense.calculateTotalAmount(), 0);
    }
    static groupByCategory(expenses) {
        const groups = {};
        Object.values(types_1.ExpenseCategory).forEach(category => {
            groups[category] = [];
        });
        expenses.forEach(expense => {
            groups[expense.category].push(expense);
        });
        return groups;
    }
    static groupByProject(expenses) {
        return expenses.reduce((groups, expense) => {
            const projectId = expense.project_id;
            if (!groups[projectId]) {
                groups[projectId] = [];
            }
            groups[projectId].push(expense);
            return groups;
        }, {});
    }
    static groupByMonth(expenses) {
        return expenses.reduce((groups, expense) => {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groups[monthKey]) {
                groups[monthKey] = [];
            }
            groups[monthKey].push(expense);
            return groups;
        }, {});
    }
    static validate(data) {
        return (0, schemas_1.validateExpense)(data);
    }
    toJSON() {
        return {
            id: this.id,
            project_id: this.project_id,
            category: this.category,
            amount: this.amount,
            currency: this.currency,
            description: this.description,
            date: this.date,
            receipt_url: this.receipt_url,
            vendor: this.vendor,
            is_billable: this.is_billable,
            tax_amount: this.tax_amount,
            tax_rate: this.tax_rate,
            reimbursable: this.reimbursable,
            approval_status: this.approval_status,
            approved_by: this.approved_by,
            approved_at: this.approved_at,
            invoice_id: this.invoice_id,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    static fromJSON(data) {
        return new Expense(data);
    }
}
exports.Expense = Expense;
//# sourceMappingURL=Expense.js.map