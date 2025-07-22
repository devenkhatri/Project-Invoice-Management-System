import { Client } from '../Client';

describe('Client Model', () => {
  const validClientData = {
    name: 'Test Client',
    email: 'test@example.com',
    phone: '9876543210',
    address: '123 Test Street, Test City',
    gstin: '29ABCDE1234F1Z5',
    payment_terms: 'Net 30'
  };

  describe('Constructor', () => {
    it('should create a client with valid data', () => {
      const client = new Client(validClientData);
      
      expect(client.name).toBe(validClientData.name);
      expect(client.email).toBe(validClientData.email);
      expect(client.phone).toBe(validClientData.phone);
      expect(client.gstin).toBe(validClientData.gstin);
      expect(client.id).toBeDefined();
      expect(client.id).toMatch(/^client_/);
    });

    it('should set default payment terms', () => {
      const client = new Client({ name: 'Test', email: 'test@example.com', phone: '1234567890' });
      expect(client.payment_terms).toBe('Net 30');
    });
  });

  describe('Validation', () => {
    it('should validate a valid client', () => {
      const client = new Client(validClientData);
      const result = client.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty name', () => {
      const client = new Client({ ...validClientData, name: '' });
      const result = client.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: 'Client name is required'
        })
      );
    });

    it('should fail validation for invalid email', () => {
      const client = new Client({ ...validClientData, email: 'invalid-email' });
      const result = client.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: 'Invalid email format'
        })
      );
    });

    it('should fail validation for short phone number', () => {
      const client = new Client({ ...validClientData, phone: '123' });
      const result = client.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'phone',
          message: 'Phone number must be at least 10 digits'
        })
      );
    });

    it('should fail validation for invalid GSTIN format', () => {
      const client = new Client({ ...validClientData, gstin: 'INVALID_GSTIN' });
      const result = client.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'gstin',
          message: 'Invalid input'
        })
      );
    });

    it('should pass validation with empty GSTIN (optional field)', () => {
      const client = new Client({ ...validClientData, gstin: '' });
      const result = client.validate();
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Business Logic Methods', () => {
    let client: Client;

    beforeEach(() => {
      client = new Client(validClientData);
    });

    it('should correctly identify if client has GSTIN', () => {
      expect(client.hasGSTIN()).toBe(true);
      
      client.gstin = '';
      expect(client.hasGSTIN()).toBe(false);
    });

    it('should validate GSTIN format correctly', () => {
      expect(client.isGSTINValid()).toBe(true);
      
      client.gstin = 'INVALID';
      expect(client.isGSTINValid()).toBe(false);
      
      client.gstin = '';
      expect(client.isGSTINValid()).toBe(true); // Empty is valid (optional)
    });

    it('should extract payment terms days correctly', () => {
      client.payment_terms = 'Net 30';
      expect(client.getPaymentTermsDays()).toBe(30);
      
      client.payment_terms = 'Net 45';
      expect(client.getPaymentTermsDays()).toBe(45);
      
      client.payment_terms = 'Immediate';
      expect(client.getPaymentTermsDays()).toBe(30); // Default fallback
    });

    it('should update contact info correctly', () => {
      const newEmail = 'new@example.com';
      const newPhone = '9999999999';
      const newAddress = 'New Address';
      
      client.updateContactInfo(newEmail, newPhone, newAddress);
      
      expect(client.email).toBe(newEmail);
      expect(client.phone).toBe(newPhone);
      expect(client.address).toBe(newAddress);
    });

    it('should update GSTIN correctly', () => {
      const newGSTIN = '29ZYXWV9876E1Z5';
      client.updateGSTIN(newGSTIN);
      expect(client.gstin).toBe(newGSTIN);
    });

    it('should throw error for invalid GSTIN format when updating', () => {
      expect(() => client.updateGSTIN('INVALID')).toThrow('Invalid GSTIN format');
    });

    it('should update payment terms correctly', () => {
      const newTerms = 'Net 45';
      client.updatePaymentTerms(newTerms);
      expect(client.payment_terms).toBe(newTerms);
    });

    it('should return display name correctly', () => {
      expect(client.getDisplayName()).toBe(client.name);
    });

    it('should format address correctly', () => {
      client.address = 'Line 1\nLine 2\nLine 3';
      expect(client.getFormattedAddress()).toBe('Line 1, Line 2, Line 3');
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const client = new Client(validClientData);
      const row = client.toSheetRow();
      
      expect(row.name).toBe(client.name);
      expect(row.email).toBe(client.email);
      expect(row.phone).toBe(client.phone);
      expect(row.gstin).toBe(client.gstin);
      expect(typeof row.created_at).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sheet Client',
        email: 'sheet@example.com',
        phone: '9876543210',
        address: 'Sheet Address',
        gstin: '29ABCDE1234F1Z5',
        payment_terms: 'Net 45',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const client = Client.fromSheetRow(sheetRow);
      
      expect(client.id).toBe(sheetRow.id);
      expect(client.name).toBe(sheetRow.name);
      expect(client.email).toBe(sheetRow.email);
      expect(client.payment_terms).toBe(sheetRow.payment_terms);
    });
  });
});