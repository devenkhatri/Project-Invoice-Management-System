import { Client as IClient } from '../types';
export declare class Client implements IClient {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city?: string;
    state?: string;
    country: string;
    postal_code?: string;
    gstin?: string;
    pan?: string;
    payment_terms: string;
    default_currency: string;
    billing_address?: string;
    shipping_address?: string;
    contact_person?: string;
    website?: string;
    notes?: string;
    is_active: boolean;
    portal_access_enabled?: boolean;
    portal_password_hash?: string;
    last_portal_login?: string;
    company_name?: string;
    created_at: string;
    updated_at?: string;
    constructor(data: Partial<IClient>);
    validateGSTIN(): boolean;
    validatePAN(): boolean;
    getFullAddress(): string;
    getBillingAddress(): string;
    getShippingAddress(): string;
    isIndianClient(): boolean;
    requiresGST(): boolean;
    getPaymentTermsDays(): number;
    isGSTRegistered(): boolean;
    getStateCode(): string | null;
    calculateTaxRates(supplierStateCode: string): {
        cgst: number;
        sgst: number;
        igst: number;
    };
    getPrimaryContact(): string;
    getContactInfo(): {
        name: string;
        email: string;
        phone: string;
    };
    activate(): void;
    deactivate(): void;
    updateContactInfo(updates: {
        email?: string;
        phone?: string;
        contact_person?: string;
    }): void;
    updateAddress(updates: {
        address?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
    }): void;
    static validate(data: Partial<IClient>): {
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
    toJSON(): IClient;
    static fromJSON(data: any): Client;
}
//# sourceMappingURL=Client.d.ts.map