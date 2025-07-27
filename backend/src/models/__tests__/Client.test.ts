import { Client } from '../Client';

describe('Client Model', () => {
  const validClientData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Company',
    email: 'test@company.com',
    phone: '+919876543210',
    address: '123 Test Street',
    country: 'India',
    gstin: '07AABCU9603R1ZX',
    pan: 'AABCU9603R',
    payment_terms: 'Net 30',
    default_currency: 'INR',
    is_active: true
  };

  describe('Constructor', () => {
    it('should create a client with valid data', () => {
      const client = new Client(validClientData);
      expect(client.name).toBe('Test Company');
      expect(client.email).toBe('test@company.com');
      expect(client.country).toBe('India');
      expect(client.created_at).toBeDefined();
      expect(client.updated_at).toBeDefined();
    });

    it('should throw error with invalid email', () => {
      expect(() => {
        new Client({ ...validClientData, email: 'invalid-email' });
      }).toThrow('Invalid client data');
    });

    it('should throw error with invalid GSTIN', () => {
      expect(() => {
        new Client({ ...validClientData, gstin: 'invalid-gstin' });
      }).toThrow('Invalid client data');
    });
  });

  describe('Business Logic Methods', () => {
    let client: Client;

    beforeEach(() => {
      client = new Client(validClientData);
    });

    describe('validateGSTIN', () => {
      it('should return true for valid GSTIN', () => {
        expect(client.validateGSTIN()).toBe(true);
      });

      it('should return true for undefined GSTIN', () => {
        client.gstin = undefined;
        expect(client.validateGSTIN()).toBe(true);
      });

      it('should return false for invalid GSTIN', () => {
        client.gstin = 'invalid-gstin';
        expect(client.validateGSTIN()).toBe(false);
      });
    });

    describe('validatePAN', () => {
      it('should return true for valid PAN', () => {
        expect(client.validatePAN()).toBe(true);
      });

      it('should return true for undefined PAN', () => {
        client.pan = undefined;
        expect(client.validatePAN()).toBe(true);
      });

      it('should return false for invalid PAN', () => {
        client.pan = 'invalid-pan';
        expect(client.validatePAN()).toBe(false);
      });
    });

    describe('getFullAddress', () => {
      it('should return formatted full address', () => {
        client.city = 'Mumbai';
        client.state = 'Maharashtra';
        client.postal_code = '400001';
        
        const fullAddress = client.getFullAddress();
        expect(fullAddress).toBe('123 Test Street, Mumbai, Maharashtra, 400001, India');
      });

      it('should handle missing address components', () => {
        const fullAddress = client.getFullAddress();
        expect(fullAddress).toBe('123 Test Street, India');
      });
    });

    describe('isIndianClient', () => {
      it('should return true for Indian client', () => {
        expect(client.isIndianClient()).toBe(true);
      });

      it('should return false for non-Indian client', () => {
        client.country = 'USA';
        expect(client.isIndianClient()).toBe(false);
      });
    });

    describe('requiresGST', () => {
      it('should return true for Indian client with GSTIN', () => {
        expect(client.requiresGST()).toBe(true);
      });

      it('should return false for Indian client without GSTIN', () => {
        client.gstin = undefined;
        expect(client.requiresGST()).toBe(false);
      });

      it('should return false for non-Indian client', () => {
        client.country = 'USA';
        expect(client.requiresGST()).toBe(false);
      });
    });

    describe('getStateCode', () => {
      it('should return state code from GSTIN', () => {
        expect(client.getStateCode()).toBe('07');
      });

      it('should return null for invalid GSTIN', () => {
        client.gstin = 'invalid';
        expect(client.getStateCode()).toBe(null);
      });
    });

    describe('calculateTaxRates', () => {
      it('should return intra-state tax rates for same state', () => {
        const rates = client.calculateTaxRates('07');
        expect(rates).toEqual({ cgst: 9, sgst: 9, igst: 0 });
      });

      it('should return inter-state tax rates for different state', () => {
        const rates = client.calculateTaxRates('27');
        expect(rates).toEqual({ cgst: 0, sgst: 0, igst: 18 });
      });

      it('should return zero rates for non-GST client', () => {
        client.gstin = undefined;
        const rates = client.calculateTaxRates('07');
        expect(rates).toEqual({ cgst: 0, sgst: 0, igst: 0 });
      });
    });

    describe('getPaymentTermsDays', () => {
      it('should extract days from payment terms', () => {
        expect(client.getPaymentTermsDays()).toBe(30);
      });

      it('should return default 30 days for invalid terms', () => {
        client.payment_terms = 'Due on Receipt';
        expect(client.getPaymentTermsDays()).toBe(30);
      });
    });

    describe('Status Methods', () => {
      it('should activate client', async () => {
        client.is_active = false;
        const originalUpdatedAt = client.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        client.activate();
        
        expect(client.is_active).toBe(true);
        expect(client.updated_at).not.toBe(originalUpdatedAt);
      });

      it('should deactivate client', async () => {
        const originalUpdatedAt = client.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        client.deactivate();
        
        expect(client.is_active).toBe(false);
        expect(client.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('updateContactInfo', () => {
      it('should update contact information', async () => {
        const originalUpdatedAt = client.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        client.updateContactInfo({
          email: 'new@company.com',
          phone: '+919999999999',
          contact_person: 'John Doe'
        });
        
        expect(client.email).toBe('new@company.com');
        expect(client.phone).toBe('+919999999999');
        expect(client.contact_person).toBe('John Doe');
        expect(client.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('updateAddress', () => {
      it('should update address information', async () => {
        const originalUpdatedAt = client.updated_at;
        
        // Add small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 1));
        client.updateAddress({
          address: '456 New Street',
          city: 'Delhi',
          state: 'Delhi',
          postal_code: '110001'
        });
        
        expect(client.address).toBe('456 New Street');
        expect(client.city).toBe('Delhi');
        expect(client.state).toBe('Delhi');
        expect(client.postal_code).toBe('110001');
        expect(client.updated_at).not.toBe(originalUpdatedAt);
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const client = new Client(validClientData);
      const json = client.toJSON();
      
      expect(json.name).toBe('Test Company');
      expect(json.email).toBe('test@company.com');
      expect(json.gstin).toBe('07AABCU9603R1ZX');
    });

    it('should deserialize from JSON correctly', () => {
      const client = Client.fromJSON(validClientData);
      
      expect(client).toBeInstanceOf(Client);
      expect(client.name).toBe('Test Company');
      expect(client.email).toBe('test@company.com');
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = Client.validate(validClientData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = Client.validate({ ...validClientData, email: 'invalid' });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});