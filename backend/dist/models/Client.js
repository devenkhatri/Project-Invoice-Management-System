"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.ClientSchema = void 0;
const zod_1 = require("zod");
exports.ClientSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).optional(),
    name: zod_1.z.string().min(1, 'Client name is required').max(255, 'Client name too long'),
    email: zod_1.z.string().email('Invalid email format'),
    phone: zod_1.z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number too long'),
    address: zod_1.z.string().max(500, 'Address too long').optional().default(''),
    gstin: zod_1.z.union([
        zod_1.z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
        zod_1.z.literal('')
    ]).optional().default(''),
    payment_terms: zod_1.z.string().max(255, 'Payment terms too long').optional().default('Net 30'),
    created_at: zod_1.z.date().optional(),
    updated_at: zod_1.z.date().optional()
});
class Client {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.name = data.name || '';
        this.email = data.email || '';
        this.phone = data.phone || '';
        this.address = data.address || '';
        this.gstin = data.gstin || '';
        this.payment_terms = data.payment_terms || 'Net 30';
        this.created_at = data.created_at || new Date();
        this.updated_at = data.updated_at || new Date();
    }
    generateId() {
        return 'client_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validate() {
        try {
            exports.ClientSchema.parse(this);
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
    hasGSTIN() {
        return this.gstin.length > 0;
    }
    isGSTINValid() {
        if (!this.gstin)
            return true;
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return gstinRegex.test(this.gstin);
    }
    getPaymentTermsDays() {
        const match = this.payment_terms.match(/(\d+)/);
        return match ? parseInt(match[1]) : 30;
    }
    updateContactInfo(email, phone, address) {
        if (email)
            this.email = email;
        if (phone)
            this.phone = phone;
        if (address)
            this.address = address;
        this.updated_at = new Date();
    }
    updateGSTIN(gstin) {
        if (gstin && !this.isValidGSTINFormat(gstin)) {
            throw new Error('Invalid GSTIN format');
        }
        this.gstin = gstin;
        this.updated_at = new Date();
    }
    isValidGSTINFormat(gstin) {
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return gstinRegex.test(gstin);
    }
    updatePaymentTerms(terms) {
        this.payment_terms = terms;
        this.updated_at = new Date();
    }
    getDisplayName() {
        return this.name;
    }
    getFormattedAddress() {
        return this.address.replace(/\n/g, ', ');
    }
    toSheetRow() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            address: this.address,
            gstin: this.gstin,
            payment_terms: this.payment_terms,
            created_at: this.created_at.toISOString(),
            updated_at: this.updated_at.toISOString()
        };
    }
    static fromSheetRow(row) {
        return new Client({
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            address: row.address || '',
            gstin: row.gstin || '',
            payment_terms: row.payment_terms || 'Net 30',
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at)
        });
    }
}
exports.Client = Client;
//# sourceMappingURL=Client.js.map