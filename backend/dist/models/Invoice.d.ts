import { z } from 'zod';
import { BaseModel, InvoiceStatus, ValidationResult } from './types';
export interface IInvoice extends BaseModel {
    invoice_number: string;
    client_id: string;
    project_id: string;
    amount: number;
    tax_amount: number;
    total_amount: number;
    status: InvoiceStatus;
    due_date: Date;
}
export declare const InvoiceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    invoice_number: z.ZodString;
    client_id: z.ZodString;
    project_id: z.ZodString;
    amount: z.ZodNumber;
    tax_amount: z.ZodNumber;
    total_amount: z.ZodNumber;
    status: z.ZodEnum<typeof InvoiceStatus>;
    due_date: z.ZodDate;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class Invoice implements IInvoice {
    id: string;
    invoice_number: string;
    client_id: string;
    project_id: string;
    amount: number;
    tax_amount: number;
    total_amount: number;
    status: InvoiceStatus;
    due_date: Date;
    created_at: Date;
    updated_at: Date;
    constructor(data: Partial<IInvoice>);
    private generateId;
    private generateInvoiceNumber;
    private getDefaultDueDate;
    validate(): ValidationResult;
    isPaid(): boolean;
    isOverdue(): boolean;
    getDaysOverdue(): number;
    getDaysUntilDue(): number;
    calculateGST(rate?: number): void;
    markAsSent(): void;
    markAsPaid(): void;
    markAsOverdue(): void;
    updateAmount(amount: number, taxRate?: number): void;
    updateDueDate(dueDate: Date): void;
    getSubtotal(): number;
    getTaxRate(): number;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): Invoice;
}
//# sourceMappingURL=Invoice.d.ts.map