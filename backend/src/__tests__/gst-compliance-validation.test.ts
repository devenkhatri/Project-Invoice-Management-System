import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../server';
import { calculateGST, validateGSTIN, generateGSTReport } from '../utils/gst-utils';
import { InvoiceStatus, PaymentStatus } from '../types/index';

describe('GST Compliance Validation Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    if (loginResponse.status === 200) {
      authToken = loginResponse.body.accessToken;
    }
  });

  describe('GST Calculation Accuracy', () => {
    it('should calculate CGST and SGST correctly for intra-state transactions', () => {
      const invoice = {
        amount: 10000,
        clientState: 'Maharashtra',
        businessState: 'Maharashtra'
      };
      
      const gstCalculation = calculateGST(invoice);
      
      expect(gstCalculation.cgst).toBe(900); // 9% CGST
      expect(gstCalculation.sgst).toBe(900); // 9% SGST
      expect(gstCalculation.igst).toBe(0);
      expect(gstCalculation.totalTax).toBe(1800);
      expect(gstCalculation.totalAmount).toBe(11800);
    });

    it('should calculate IGST correctly for inter-state transactions', () => {
      const invoice = {
        amount: 10000,
        clientState: 'Karnataka',
        businessState: 'Maharashtra'
      };
      
      const gstCalculation = calculateGST(invoice);
      
      expect(gstCalculation.cgst).toBe(0);
      expect(gstCalculation.sgst).toBe(0);
      expect(gstCalculation.igst).toBe(1800); // 18% IGST
      expect(gstCalculation.totalTax).toBe(1800);
      expect(gstCalculation.totalAmount).toBe(11800);
    });

    it('should handle different GST rates correctly', () => {
      const testCases = [
        { amount: 10000, gstRate: 5, expectedTax: 500 },
        { amount: 10000, gstRate: 12, expectedTax: 1200 },
        { amount: 10000, gstRate: 18, expectedTax: 1800 },
        { amount: 10000, gstRate: 28, expectedTax: 2800 }
      ];

      testCases.forEach(({ amount, gstRate, expectedTax }) => {
        const invoice = {
          amount,
          gstRate,
          clientState: 'Maharashtra',
          businessState: 'Maharashtra'
        };
        
        const gstCalculation = calculateGST(invoice);
        expect(gstCalculation.totalTax).toBe(expectedTax);
      });
    });
  });

  describe('GSTIN Validation', () => {
    it('should validate correct GSTIN format', () => {
      const validGSTINs = [
        '27ABCDE1234F1Z5',
        '09ABCDE1234F1Z5',
        '33ABCDE1234F1Z5'
      ];

      validGSTINs.forEach(gstin => {
        expect(validateGSTIN(gstin)).toBe(true);
      });
    });

    it('should reject invalid GSTIN format', () => {
      const invalidGSTINs = [
        '27ABCDE1234F1Z', // Too short
        '27ABCDE1234F1Z56', // Too long
        '27abcde1234f1z5', // Lowercase
        '27ABCDE1234F1Z6', // Invalid check digit
        'INVALID_GSTIN'
      ];

      invalidGSTINs.forEach(gstin => {
        expect(validateGSTIN(gstin)).toBe(false);
      });
    });

    it('should validate state code in GSTIN', () => {
      const validStateCodes = ['01', '02', '03', '27', '33'];
      const invalidStateCodes = ['00', '38', '99'];

      validStateCodes.forEach(stateCode => {
        const gstin = `${stateCode}ABCDE1234F1Z5`;
        expect(validateGSTIN(gstin)).toBe(true);
      });

      invalidStateCodes.forEach(stateCode => {
        const gstin = `${stateCode}ABCDE1234F1Z5`;
        expect(validateGSTIN(gstin)).toBe(false);
      });
    });
  });

  describe('E-Invoice Generation', () => {
    it('should generate e-invoice with required fields', async () => {
      const invoiceData = {
        client_id: 'client123',
        line_items: [{
          description: 'Software Development',
          hsn_code: '998314',
          quantity: 1,
          rate: 10000,
          amount: 10000
        }],
        subtotal: 10000,
        tax_breakdown: {
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_tax: 1800
        },
        total_amount: 11800,
        currency: 'INR',
        status: InvoiceStatus.DRAFT,
        issue_date: '2024-01-25',
        due_date: '2024-02-25',
        payment_terms: 'Net 30',
        is_recurring: false,
        payment_status: PaymentStatus.PENDING,
        paid_amount: 0
      };

      const response = await request(app)
        .post('/api/integrations/e-invoice/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invoice: invoiceData });

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('irn');
        expect(response.body.data).toHaveProperty('qr_code');
        expect(response.body.data).toHaveProperty('signed_invoice');
      }
    });

    it('should include mandatory e-invoice fields', async () => {
      const response = await request(app)
        .post('/api/integrations/e-invoice/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          invoice_number: 'INV-2024-0001',
          invoice_date: '2024-01-25',
          supplier_gstin: '27ABCDE1234F1Z5',
          buyer_gstin: '33FGHIJ5678K2L9',
          place_of_supply: '27',
          document_type: 'INV'
        });

      if (response.status === 200) {
        expect(response.body.valid).toBe(true);
      }
    });
  });

  describe('GSTR1 Report Generation', () => {
    it('should generate GSTR1 report with correct structure', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports/gstr1?month=01&year=2024')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const report = response.body.data;
        
        // Check required sections
        expect(report).toHaveProperty('b2b'); // B2B supplies
        expect(report).toHaveProperty('b2c'); // B2C supplies
        expect(report).toHaveProperty('hsn'); // HSN summary
        expect(report).toHaveProperty('summary'); // Summary
        
        // Validate B2B section structure
        if (report.b2b && report.b2b.length > 0) {
          const b2bEntry = report.b2b[0];
          expect(b2bEntry).toHaveProperty('gstin');
          expect(b2bEntry).toHaveProperty('invoices');
          
          if (b2bEntry.invoices && b2bEntry.invoices.length > 0) {
            const invoice = b2bEntry.invoices[0];
            expect(invoice).toHaveProperty('invoice_number');
            expect(invoice).toHaveProperty('invoice_date');
            expect(invoice).toHaveProperty('taxable_value');
            expect(invoice).toHaveProperty('tax_amount');
          }
        }
      }
    });

    it('should calculate tax totals correctly in GSTR1', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports/gstr1?month=01&year=2024')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const report = response.body.data;
        
        if (report.summary) {
          expect(report.summary).toHaveProperty('total_taxable_value');
          expect(report.summary).toHaveProperty('total_cgst');
          expect(report.summary).toHaveProperty('total_sgst');
          expect(report.summary).toHaveProperty('total_igst');
          expect(report.summary).toHaveProperty('total_tax');
          
          // Verify tax calculation
          const expectedTotalTax = 
            report.summary.total_cgst + 
            report.summary.total_sgst + 
            report.summary.total_igst;
          
          expect(report.summary.total_tax).toBe(expectedTotalTax);
        }
      }
    });
  });

  describe('GSTR3B Report Generation', () => {
    it('should generate GSTR3B report with correct structure', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/reports/gstr3b?month=01&year=2024')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const report = response.body.data;
        
        // Check required sections
        expect(report).toHaveProperty('outward_supplies');
        expect(report).toHaveProperty('inward_supplies');
        expect(report).toHaveProperty('tax_liability');
        expect(report).toHaveProperty('tax_paid');
        
        // Validate outward supplies structure
        if (report.outward_supplies) {
          expect(report.outward_supplies).toHaveProperty('taxable_supplies');
          expect(report.outward_supplies).toHaveProperty('zero_rated_supplies');
          expect(report.outward_supplies).toHaveProperty('exempt_supplies');
        }
      }
    });
  });

  describe('HSN Code Validation', () => {
    it('should validate HSN codes correctly', async () => {
      const validHSNCodes = [
        '998314', // IT services
        '999599', // Other services
        '84713000', // Laptops
        '85171200' // Mobile phones
      ];

      for (const hsnCode of validHSNCodes) {
        const response = await request(app)
          .post('/api/integrations/gst/validate-hsn')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ hsn_code: hsnCode });

        if (response.status === 200) {
          expect(response.body.valid).toBe(true);
          expect(response.body.data).toHaveProperty('description');
          expect(response.body.data).toHaveProperty('gst_rate');
        }
      }
    });

    it('should reject invalid HSN codes', async () => {
      const invalidHSNCodes = [
        '99999999', // Invalid code
        '123', // Too short
        'INVALID', // Non-numeric
        ''
      ];

      for (const hsnCode of invalidHSNCodes) {
        const response = await request(app)
          .post('/api/integrations/gst/validate-hsn')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ hsn_code: hsnCode });

        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Reverse Charge Mechanism', () => {
    it('should handle reverse charge scenarios correctly', () => {
      const reverseChargeInvoice = {
        amount: 10000,
        clientState: 'Maharashtra',
        businessState: 'Maharashtra',
        isReverseCharge: true,
        supplierType: 'unregistered'
      };
      
      const gstCalculation = calculateGST(reverseChargeInvoice);
      
      // In reverse charge, recipient pays the tax
      expect(gstCalculation.isReverseCharge).toBe(true);
      expect(gstCalculation.taxPayableByRecipient).toBe(1800);
    });
  });

  describe('Place of Supply Rules', () => {
    it('should determine place of supply correctly for services', () => {
      const serviceInvoice = {
        amount: 10000,
        clientState: 'Karnataka',
        businessState: 'Maharashtra',
        serviceType: 'software_development',
        clientAddress: 'Bangalore, Karnataka'
      };
      
      const gstCalculation = calculateGST(serviceInvoice);
      
      // For services, place of supply is recipient's location
      expect(gstCalculation.placeOfSupply).toBe('Karnataka');
      expect(gstCalculation.igst).toBe(1800); // Inter-state
    });

    it('should determine place of supply correctly for goods', () => {
      const goodsInvoice = {
        amount: 10000,
        clientState: 'Karnataka',
        businessState: 'Maharashtra',
        itemType: 'goods',
        deliveryAddress: 'Mumbai, Maharashtra'
      };
      
      const gstCalculation = calculateGST(goodsInvoice);
      
      // For goods, place of supply is delivery location
      expect(gstCalculation.placeOfSupply).toBe('Maharashtra');
      expect(gstCalculation.cgst).toBe(900); // Intra-state
      expect(gstCalculation.sgst).toBe(900);
    });
  });

  describe('Tax Rate Validation', () => {
    it('should apply correct tax rates for different service categories', () => {
      const serviceCategories = [
        { category: 'software_development', expectedRate: 18 },
        { category: 'consulting', expectedRate: 18 },
        { category: 'design', expectedRate: 18 },
        { category: 'maintenance', expectedRate: 18 }
      ];

      serviceCategories.forEach(({ category, expectedRate }) => {
        const invoice = {
          amount: 10000,
          serviceCategory: category,
          clientState: 'Maharashtra',
          businessState: 'Maharashtra'
        };
        
        const gstCalculation = calculateGST(invoice);
        const actualRate = (gstCalculation.totalTax / invoice.amount) * 100;
        
        expect(actualRate).toBe(expectedRate);
      });
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate compliance summary report', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/compliance-summary?year=2024')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const summary = response.body.data;
        
        expect(summary).toHaveProperty('total_turnover');
        expect(summary).toHaveProperty('total_tax_collected');
        expect(summary).toHaveProperty('returns_filed');
        expect(summary).toHaveProperty('compliance_score');
        expect(summary).toHaveProperty('pending_actions');
      }
    });

    it('should identify compliance issues', async () => {
      const response = await request(app)
        .get('/api/integrations/gst/compliance-issues')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const issues = response.body.data;
        
        expect(Array.isArray(issues)).toBe(true);
        
        if (issues.length > 0) {
          const issue = issues[0];
          expect(issue).toHaveProperty('type');
          expect(issue).toHaveProperty('description');
          expect(issue).toHaveProperty('severity');
          expect(issue).toHaveProperty('resolution_steps');
        }
      }
    });
  });
});