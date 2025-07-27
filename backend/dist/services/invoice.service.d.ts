import { Invoice } from '../models/Invoice';
import { Client } from '../models/Client';
export declare function generateInvoicePDF(invoice: Invoice, client: Client): Promise<Buffer>;
interface EmailOptions {
    invoice: Invoice;
    client: Client;
    pdfBuffer: Buffer;
    recipientEmail: string;
    subject?: string;
    message?: string;
}
export declare function sendInvoiceEmail(options: EmailOptions): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function calculateGSTBreakdown(amount: number, gstRate: number, isInterState: boolean): {
    cgst_rate: number;
    cgst_amount: number;
    sgst_rate: number;
    sgst_amount: number;
    igst_rate: number;
    igst_amount: number;
    total_tax_amount: number;
};
export declare function validateGSTIN(gstin: string): boolean;
export declare function getStateCodeFromGSTIN(gstin: string): string;
export declare const commonHSNCodes: {
    software_development: string;
    consulting: string;
    training: string;
    maintenance: string;
    hosting: string;
};
export declare function getHSNCodeForService(serviceType: string): string;
export declare function generateInvoiceNumber(prefix?: string, year?: number): string;
export declare function calculateNextInvoiceDate(currentDate: string, frequency: string): string;
export declare function shouldSendReminder(invoice: Invoice, reminderType: 'before_due' | 'after_due'): boolean;
export declare function generatePaymentReminderEmail(invoice: Invoice, client: Client, reminderType: 'before_due' | 'after_due'): Promise<{
    subject: string;
    message: string;
}>;
export {};
//# sourceMappingURL=invoice.service.d.ts.map