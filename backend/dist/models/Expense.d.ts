import { Expense as IExpense, ExpenseCategory } from '../types';
export declare class Expense implements IExpense {
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
    constructor(data: Partial<IExpense>);
    calculateTotalAmount(): number;
    calculateTaxAmount(): number;
    updateTaxAmount(): void;
    approve(approvedBy: string): void;
    reject(): void;
    isApproved(): boolean;
    isRejected(): boolean;
    isPending(): boolean;
    markAsBilled(invoiceId: string): void;
    isBilled(): boolean;
    toggleBillable(): void;
    getCategoryDisplayName(): string;
    isDeductible(): boolean;
    isToday(): boolean;
    isThisWeek(): boolean;
    isThisMonth(): boolean;
    hasReceipt(): boolean;
    updateReceipt(receiptUrl: string): void;
    removeReceipt(): void;
    getFormattedAmount(): string;
    getFormattedTotalAmount(): string;
    getFormattedDate(): string;
    static calculateTotalAmount(expenses: Expense[]): number;
    static calculateTotalByCategory(expenses: Expense[]): Record<ExpenseCategory, number>;
    static calculateBillableAmount(expenses: Expense[]): number;
    static calculateReimbursableAmount(expenses: Expense[]): number;
    static groupByCategory(expenses: Expense[]): Record<ExpenseCategory, Expense[]>;
    static groupByProject(expenses: Expense[]): Record<string, Expense[]>;
    static groupByMonth(expenses: Expense[]): Record<string, Expense[]>;
    static validate(data: Partial<IExpense>): {
        isValid: boolean;
        errors: {
            field: string;
            message: string;
            value: any;
        }[];
        data: null;
    } | {
        isValid: boolean;
        errors: never[];
        data: any;
    };
    toJSON(): IExpense;
    static fromJSON(data: any): Expense;
}
//# sourceMappingURL=Expense.d.ts.map