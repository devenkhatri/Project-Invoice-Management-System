import { z } from 'zod';
import { BaseModel, ExpenseCategory, ValidationResult } from './types';
export interface IExpense extends BaseModel {
    project_id: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: Date;
    receipt_url: string;
}
export declare const ExpenseSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    project_id: z.ZodString;
    category: z.ZodEnum<typeof ExpenseCategory>;
    amount: z.ZodNumber;
    description: z.ZodString;
    date: z.ZodDate;
    receipt_url: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>>>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class Expense implements IExpense {
    id: string;
    project_id: string;
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: Date;
    receipt_url: string;
    created_at: Date;
    updated_at: Date;
    constructor(data: Partial<IExpense>);
    private generateId;
    validate(): ValidationResult;
    hasReceipt(): boolean;
    isToday(): boolean;
    isThisMonth(): boolean;
    isThisYear(): boolean;
    getFormattedAmount(): string;
    getCategoryDisplayName(): string;
    updateAmount(amount: number): void;
    updateCategory(category: ExpenseCategory): void;
    updateDescription(description: string): void;
    updateReceiptUrl(url: string): void;
    updateDate(date: Date): void;
    isWithinDateRange(startDate: Date, endDate: Date): boolean;
    isTaxDeductible(): boolean;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): Expense;
    static calculateTotal(expenses: Expense[]): number;
    static groupByCategory(expenses: Expense[]): Map<ExpenseCategory, Expense[]>;
    static filterByDateRange(expenses: Expense[], startDate: Date, endDate: Date): Expense[];
    static filterByCategory(expenses: Expense[], category: ExpenseCategory): Expense[];
    static getTaxDeductible(expenses: Expense[]): Expense[];
}
//# sourceMappingURL=Expense.d.ts.map