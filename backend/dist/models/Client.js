"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const schemas_1 = require("../validation/schemas");
class Client {
    constructor(data) {
        const validation = (0, schemas_1.validateClient)(data);
        if (!validation.isValid) {
            throw new Error(`Invalid client data: ${validation.errors.map(e => e.message).join(', ')}`);
        }
        const validatedData = validation.data;
        Object.assign(this, validatedData);
        if (!this.created_at) {
            this.created_at = new Date().toISOString();
        }
        this.updated_at = new Date().toISOString();
    }
    validateGSTIN() {
        if (!this.gstin)
            return true;
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        return gstinRegex.test(this.gstin);
    }
    validatePAN() {
        if (!this.pan)
            return true;
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        return panRegex.test(this.pan);
    }
    getFullAddress() {
        const parts = [
            this.address,
            this.city,
            this.state,
            this.postal_code,
            this.country
        ].filter(Boolean);
        return parts.join(', ');
    }
    getBillingAddress() {
        return this.billing_address || this.getFullAddress();
    }
    getShippingAddress() {
        return this.shipping_address || this.getFullAddress();
    }
    isIndianClient() {
        return this.country.toLowerCase() === 'india';
    }
    requiresGST() {
        return this.isIndianClient() && !!this.gstin;
    }
    getPaymentTermsDays() {
        const match = this.payment_terms.match(/(\d+)/);
        return match ? parseInt(match[1]) : 30;
    }
    isGSTRegistered() {
        return !!this.gstin && this.validateGSTIN();
    }
    getStateCode() {
        if (!this.gstin || !this.validateGSTIN())
            return null;
        return this.gstin.substring(0, 2);
    }
    calculateTaxRates(supplierStateCode) {
        if (!this.isIndianClient() || !this.isGSTRegistered()) {
            return { cgst: 0, sgst: 0, igst: 0 };
        }
        const clientStateCode = this.getStateCode();
        const isIntraState = clientStateCode === supplierStateCode;
        if (isIntraState) {
            return { cgst: 9, sgst: 9, igst: 0 };
        }
        else {
            return { cgst: 0, sgst: 0, igst: 18 };
        }
    }
    getPrimaryContact() {
        return this.contact_person || this.name;
    }
    getContactInfo() {
        return {
            name: this.getPrimaryContact(),
            email: this.email,
            phone: this.phone
        };
    }
    activate() {
        this.is_active = true;
        this.updated_at = new Date().toISOString();
    }
    deactivate() {
        this.is_active = false;
        this.updated_at = new Date().toISOString();
    }
    updateContactInfo(updates) {
        if (updates.email)
            this.email = updates.email;
        if (updates.phone)
            this.phone = updates.phone;
        if (updates.contact_person)
            this.contact_person = updates.contact_person;
        this.updated_at = new Date().toISOString();
    }
    updateAddress(updates) {
        if (updates.address)
            this.address = updates.address;
        if (updates.city)
            this.city = updates.city;
        if (updates.state)
            this.state = updates.state;
        if (updates.postal_code)
            this.postal_code = updates.postal_code;
        if (updates.country)
            this.country = updates.country;
        this.updated_at = new Date().toISOString();
    }
    static validate(data) {
        return (0, schemas_1.validateClient)(data);
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            address: this.address,
            city: this.city,
            state: this.state,
            country: this.country,
            postal_code: this.postal_code,
            gstin: this.gstin,
            pan: this.pan,
            payment_terms: this.payment_terms,
            default_currency: this.default_currency,
            billing_address: this.billing_address,
            shipping_address: this.shipping_address,
            contact_person: this.contact_person,
            website: this.website,
            notes: this.notes,
            is_active: this.is_active,
            portal_access_enabled: this.portal_access_enabled,
            portal_password_hash: this.portal_password_hash,
            last_portal_login: this.last_portal_login,
            company_name: this.company_name,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
    static fromJSON(data) {
        return new Client(data);
    }
}
exports.Client = Client;
//# sourceMappingURL=Client.js.map