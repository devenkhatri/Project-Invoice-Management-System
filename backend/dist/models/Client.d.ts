import { z } from 'zod';
import { BaseModel, ValidationResult } from './types';
export interface IClient extends BaseModel {
    name: string;
    email: string;
    phone: string;
    address: string;
    gstin: string;
    payment_terms: string;
}
export declare const ClientSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    address: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    gstin: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>>>;
    payment_terms: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    created_at: z.ZodOptional<z.ZodDate>;
    updated_at: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
export declare class Client implements IClient {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    gstin: string;
    payment_terms: string;
    created_at: Date;
    updated_at: Date;
    constructor(data: Partial<IClient>);
    private generateId;
    validate(): ValidationResult;
    hasGSTIN(): boolean;
    isGSTINValid(): boolean;
    getPaymentTermsDays(): number;
    updateContactInfo(email?: string, phone?: string, address?: string): void;
    updateGSTIN(gstin: string): void;
    private isValidGSTINFormat;
    updatePaymentTerms(terms: string): void;
    getDisplayName(): string;
    getFormattedAddress(): string;
    toSheetRow(): Record<string, any>;
    static fromSheetRow(row: Record<string, any>): Client;
}
//# sourceMappingURL=Client.d.ts.map