import { z } from 'zod';
import { BaseModel, ValidationResult, ValidationError } from './types';

// TypeScript interface for Client
export interface IClient extends BaseModel {
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  payment_terms: string;
}

// Zod schema for validation
export const ClientSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Client name is required').max(255, 'Client name too long'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number too long'),
  address: z.string().max(500, 'Address too long').optional().default(''),
  gstin: z.union([
    z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
    z.literal('')
  ]).optional().default(''),
  payment_terms: z.string().max(255, 'Payment terms too long').optional().default('Net 30'),
  created_at: z.date().optional(),
  updated_at: z.date().optional()
});

// Client model class with business logic
export class Client implements IClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  payment_terms: string;
  created_at: Date;
  updated_at: Date;

  constructor(data: Partial<IClient>) {
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

  private generateId(): string {
    return 'client_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Validation method
  validate(): ValidationResult {
    try {
      ClientSchema.parse(this);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: ValidationError[] = error.issues.map((err: any) => ({
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

  // Business logic methods
  hasGSTIN(): boolean {
    return this.gstin.length > 0;
  }

  isGSTINValid(): boolean {
    if (!this.gstin) return true; // Optional field
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(this.gstin);
  }

  getPaymentTermsDays(): number {
    const match = this.payment_terms.match(/(\d+)/);
    return match ? parseInt(match[1]) : 30;
  }

  updateContactInfo(email?: string, phone?: string, address?: string): void {
    if (email) this.email = email;
    if (phone) this.phone = phone;
    if (address) this.address = address;
    this.updated_at = new Date();
  }

  updateGSTIN(gstin: string): void {
    if (gstin && !this.isValidGSTINFormat(gstin)) {
      throw new Error('Invalid GSTIN format');
    }
    this.gstin = gstin;
    this.updated_at = new Date();
  }

  private isValidGSTINFormat(gstin: string): boolean {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  }

  updatePaymentTerms(terms: string): void {
    this.payment_terms = terms;
    this.updated_at = new Date();
  }

  getDisplayName(): string {
    return this.name;
  }

  getFormattedAddress(): string {
    return this.address.replace(/\n/g, ', ');
  }

  // Convert to plain object for Google Sheets
  toSheetRow(): Record<string, any> {
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

  // Create from Google Sheets row
  static fromSheetRow(row: Record<string, any>): Client {
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