import { Client as IClient } from '../types';
import { validateClient } from '../validation/schemas';

export class Client implements IClient {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
  address!: string;
  city?: string;
  state?: string;
  country!: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  payment_terms!: string;
  default_currency!: string;
  billing_address?: string;
  shipping_address?: string;
  contact_person?: string;
  website?: string;
  notes?: string;
  is_active!: boolean;
  portal_access_enabled?: boolean;
  portal_password_hash?: string;
  last_portal_login?: string;
  company_name?: string;
  created_at!: string;
  updated_at?: string;

  constructor(data: Partial<IClient>) {
    const validation = validateClient(data);
    if (!validation.isValid) {
      throw new Error(`Invalid client data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const validatedData = validation.data as IClient;
    Object.assign(this, validatedData);
    
    if (!this.created_at) {
      this.created_at = new Date().toISOString();
    }
    this.updated_at = new Date().toISOString();
  }

  // Business logic methods
  validateGSTIN(): boolean {
    if (!this.gstin) return true; // GSTIN is optional
    
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(this.gstin);
  }

  validatePAN(): boolean {
    if (!this.pan) return true; // PAN is optional
    
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(this.pan);
  }

  getFullAddress(): string {
    const parts = [
      this.address,
      this.city,
      this.state,
      this.postal_code,
      this.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  getBillingAddress(): string {
    return this.billing_address || this.getFullAddress();
  }

  getShippingAddress(): string {
    return this.shipping_address || this.getFullAddress();
  }

  isIndianClient(): boolean {
    return this.country.toLowerCase() === 'india';
  }

  requiresGST(): boolean {
    return this.isIndianClient() && !!this.gstin;
  }

  getPaymentTermsDays(): number {
    const match = this.payment_terms.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

  isGSTRegistered(): boolean {
    return !!this.gstin && this.validateGSTIN();
  }

  getStateCode(): string | null {
    if (!this.gstin || !this.validateGSTIN()) return null;
    return this.gstin.substring(0, 2);
  }

  // Tax calculation helpers
  calculateTaxRates(supplierStateCode: string): {
    cgst: number;
    sgst: number;
    igst: number;
  } {
    if (!this.isIndianClient() || !this.isGSTRegistered()) {
      return { cgst: 0, sgst: 0, igst: 0 };
    }

    const clientStateCode = this.getStateCode();
    const isIntraState = clientStateCode === supplierStateCode;

    if (isIntraState) {
      // Intra-state: CGST + SGST
      return { cgst: 9, sgst: 9, igst: 0 };
    } else {
      // Inter-state: IGST
      return { cgst: 0, sgst: 0, igst: 18 };
    }
  }

  // Contact methods
  getPrimaryContact(): string {
    return this.contact_person || this.name;
  }

  getContactInfo(): {
    name: string;
    email: string;
    phone: string;
  } {
    return {
      name: this.getPrimaryContact(),
      email: this.email,
      phone: this.phone
    };
  }

  // Status methods
  activate(): void {
    this.is_active = true;
    this.updated_at = new Date().toISOString();
  }

  deactivate(): void {
    this.is_active = false;
    this.updated_at = new Date().toISOString();
  }

  updateContactInfo(updates: {
    email?: string;
    phone?: string;
    contact_person?: string;
  }): void {
    if (updates.email) this.email = updates.email;
    if (updates.phone) this.phone = updates.phone;
    if (updates.contact_person) this.contact_person = updates.contact_person;
    this.updated_at = new Date().toISOString();
  }

  updateAddress(updates: {
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  }): void {
    if (updates.address) this.address = updates.address;
    if (updates.city) this.city = updates.city;
    if (updates.state) this.state = updates.state;
    if (updates.postal_code) this.postal_code = updates.postal_code;
    if (updates.country) this.country = updates.country;
    this.updated_at = new Date().toISOString();
  }

  // Validation methods
  static validate(data: Partial<IClient>) {
    return validateClient(data);
  }

  // Serialization methods
  toJSON(): IClient {
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

  static fromJSON(data: any): Client {
    return new Client(data);
  }
}