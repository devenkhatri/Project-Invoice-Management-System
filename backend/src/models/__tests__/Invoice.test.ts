import { Invoice } from '../Invoice';
import { InvoiceStatus, PaymentStatus, InvoiceLineItem, TaxBreakdown } from '../../types';

// Create a mock client with the calculateTaxRates method
const mockClient = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Company',
  email: 'test@company.com',
  phone: '+919876543210',
  address: '123 Test Street',
  country: 'India',
  gstin: '07AABCU9603R1ZX',
  payment_terms: 'Net 30',
  default_currency: 'INR',
  is_active: true,
  calculateTaxRates: (supplierStateCode: string) => {
    const clientStateCode = '07'; // From GSTIN
    const isIntraState = clientStateCode === supplierStateCode;
    
    if (isIntraState) {
      return { cgst: 9, sgst: 9, igst: 0 };
    } else {
      return { cgst: 0, sgst: 0, igst: 18 };
    }
  }
} as any;

describe('Invoice Model', () => {


  const sampleLineItems: InvoiceLineItem[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      description: 'Web Development',
      quantity: 40,
      unit_price: 1000,
      total_price: 40000,
      tax_rate: 18,
      tax_amount: 7200,
      hsn_sac_code: '998314'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440011',
      description: 'UI Design',
      quantity: 20,
      unit_price: 1500,
      total_price: 30000,
      tax_rate: 18,
      tax_amount: 5400
    }
  ];

  const sampleTaxBreakdown: TaxBreakdown = {
    cgst_rate: 9,
    cgst_amount: 6300,
    sgst_rate: 9,
    sgst_amount: 6300,
    igst_rate: 0,
    igst_amount: 0,
    total_tax_amount: 12600
  };

  const validInvoiceData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    invoice_number: 'INV-2024-001',
    client_id: '550e8400-e29b-41d4-a716-446655440001',
    project_id: '550e8400-e29b-41d4-a716-446655440002',
    line_items: sampleLineItems,
    subtotal: 70000,
    tax_breakdown: sampleTaxBreakdown,
    total_amount: 82600,
    currency: 'INR',
    status: InvoiceStatus.DRAFT,
    issue_date: '2024-01-01',
    due_date: '2024-01-31',
    payment_terms: 'Net 30',
    is_recurring: false,
    payment_status: PaymentStatus.PENDING,
    paid_amount: 0
  };

  describe('Constructor', () => {
    it('should create an invoice with valid data', () => {
      const invoice = new Invoice(validInvoiceData);
      expect(invoice.invoice_number).toBe('INV-2024-001');
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
      expect(invoice.total_amount).toBe(82600);
      expect(invoice.created_at).toBeDefined();
      expect(invoice.updated_at).toBeDefined();
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        new Invoice({ ...validInvoiceData, invoice_number: '' });
      }).toThrow('Invalid invoice data');
    });

    it('should throw error when due date is before issue date', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          issue_date: '2024-01-31',
          due_date: '2024-01-01'
        });
      }).toThrow('Invalid invoice data');
    });

    it('should throw error when paid amount exceeds total amount', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          paid_amount: 100000
        });
      }).toThrow('Invalid invoice data');
    });
  });

  describe('Business Logic Methods', () => {
    let invoice: Invoice;

    beforeEach(() => {
      invoice = new Invoice(validInvoiceData);
    });

    describe('calculateSubtotal', () => {
      it('should calculate subtotal from line items', () => {
        expect(invoice.calculateSubtotal()).toBe(70000);
      });

      it('should return 0 for empty line items', () => {
        invoice.line_items = [];
        expect(invoice.calculateSubtotal()).toBe(0);
      });
    });

    describe('calculateTaxBreakdown', () => {
      it('should calculate intra-state tax breakdown', () => {
        const taxBreakdown = invoice.calculateTaxBreakdown(mockClient, '07');
        expect(taxBreakdown.cgst_rate).toBe(9);
        expect(taxBreakdown.sgst_rate).toBe(9);
        expect(taxBreakdown.igst_rate).toBe(0);
        expect(taxBreakdown.total_tax_amount).toBe(12600);
      });

      it('should calculate inter-state tax breakdown', () => {
        const taxBreakdown = invoice.calculateTaxBreakdown(mockClient, '27');
        expect(taxBreakdown.cgst_rate).toBe(0);
        expect(taxBreakdown.sgst_rate).toBe(0);
        expect(taxBreakdown.igst_rate).toBe(18);
        expect(taxBreakdown.total_tax_amount).toBe(12600);
      });
    });

    describe('calculateTotalAmount', () => {
      it('should calculate total amount with tax', () => {
        expect(invoice.calculateTotalAmount()).toBe(82600);
      });

      it('should apply discount percentage', () => {
        invoice.discount_percentage = 10;
        const total = invoice.calculateTotalAmount();
        expect(total).toBeLessThan(82600);
      });

      it('should apply discount amount', () => {
        invoice.discount_amount = 5000;
        const total = invoice.calculateTotalAmount();
        expect(total).toBe(77600);
      });

      it('should add late fee', () => {
        invoice.late_fee_applied = 1000;
        const total = invoice.calculateTotalAmount();
        expect(total).toBe(83600);
      });
    });

    describe('Line Item Management', () => {
      it('should add line item', () => {
        const initialCount = invoice.line_items.length;
        invoice.addLineItem({
          description: 'Testing',
          quantity: 10,
          unit_price: 500,
          total_price: 5000,
          tax_rate: 18,
          tax_amount: 900
        });
        expect(invoice.line_items.length).toBe(initialCount + 1);
        expect(invoice.line_items[initialCount].description).toBe('Testing');
        expect(invoice.line_items[initialCount].total_price).toBe(5000);
      });

      it('should remove line item', () => {
        const itemId = invoice.line_items[0].id;
        const initialCount = invoice.line_items.length;
        
        invoice.removeLineItem(itemId);
        
        expect(invoice.line_items.length).toBe(initialCount - 1);
        expect(invoice.line_items.find(item => item.id === itemId)).toBeUndefined();
      });

      it('should update line item', () => {
        const itemId = invoice.line_items[0].id;
        
        invoice.updateLineItem(itemId, {
          quantity: 50,
          unit_price: 1200
        });
        
        const updatedItem = invoice.line_items.find(item => item.id === itemId);
        expect(updatedItem?.quantity).toBe(50);
        expect(updatedItem?.unit_price).toBe(1200);
        expect(updatedItem?.total_price).toBe(60000);
      });
    });

    describe('Payment Methods', () => {
      it('should record payment', () => {
        invoice.recordPayment(50000, '2024-01-15', 'Bank Transfer');
        
        expect(invoice.paid_amount).toBe(50000);
        expect(invoice.payment_date).toBe('2024-01-15');
        expect(invoice.payment_method).toBe('Bank Transfer');
        expect(invoice.payment_status).toBe(PaymentStatus.PARTIAL);
      });

      it('should mark as fully paid when payment equals total', () => {
        invoice.recordPayment(82600, '2024-01-15');
        
        expect(invoice.payment_status).toBe(PaymentStatus.PAID);
        expect(invoice.status).toBe(InvoiceStatus.PAID);
      });

      it('should calculate remaining amount', () => {
        invoice.paid_amount = 30000;
        expect(invoice.getRemainingAmount()).toBe(52600);
      });

      it('should check if fully paid', () => {
        expect(invoice.isFullyPaid()).toBe(false);
        
        invoice.paid_amount = 82600;
        expect(invoice.isFullyPaid()).toBe(true);
      });

      it('should check if partially paid', () => {
        expect(invoice.isPartiallyPaid()).toBe(false);
        
        invoice.paid_amount = 40000;
        expect(invoice.isPartiallyPaid()).toBe(true);
        
        invoice.paid_amount = 82600;
        expect(invoice.isPartiallyPaid()).toBe(false);
      });
    });

    describe('Due Date and Overdue Methods', () => {
      it('should check if overdue', () => {
        const overdueInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31',
          paid_amount: 0
        });
        expect(overdueInvoice.isOverdue()).toBe(true);
      });

      it('should not be overdue if fully paid', () => {
        const paidInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31',
          paid_amount: 82600
        });
        expect(paidInvoice.isOverdue()).toBe(false);
      });

      it('should calculate days overdue', () => {
        const overdueInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31'
        });
        expect(overdueInvoice.getDaysOverdue()).toBeGreaterThan(0);
      });

      it('should return 0 days overdue for non-overdue invoice', () => {
        const futureInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2025-01-01',
          due_date: '2025-12-31'
        });
        expect(futureInvoice.getDaysOverdue()).toBe(0);
      });
    });

    describe('Late Fee Calculation', () => {
      it('should calculate late fee for overdue invoice', () => {
        const overdueInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31'
        });
        
        const lateFee = overdueInvoice.calculateLateFee(1.5);
        expect(lateFee).toBeGreaterThan(0);
      });

      it('should return 0 late fee for non-overdue invoice', () => {
        const futureInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2025-01-01',
          due_date: '2025-12-31'
        });
        const lateFee = futureInvoice.calculateLateFee(1.5);
        expect(lateFee).toBe(0);
      });

      it('should apply late fee', () => {
        const overdueInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31'
        });
        
        const originalTotal = overdueInvoice.total_amount;
        overdueInvoice.applyLateFee(1.5);
        
        expect(overdueInvoice.late_fee_applied).toBeGreaterThan(0);
        expect(overdueInvoice.total_amount).toBeGreaterThan(originalTotal);
      });
    });

    describe('Status Methods', () => {
      it('should mark as sent', () => {
        invoice.markAsSent();
        expect(invoice.status).toBe(InvoiceStatus.SENT);
      });

      it('should mark as overdue', () => {
        const overdueInvoice = new Invoice({
          ...validInvoiceData,
          issue_date: '2020-01-01',
          due_date: '2020-01-31'
        });
        
        overdueInvoice.markAsOverdue();
        expect(overdueInvoice.status).toBe(InvoiceStatus.OVERDUE);
      });

      it('should cancel invoice', () => {
        invoice.cancel();
        expect(invoice.status).toBe(InvoiceStatus.CANCELLED);
      });
    });

    describe('Recurring Invoice Methods', () => {
      it('should generate next invoice for recurring invoice', () => {
        const recurringInvoice = new Invoice({
          ...validInvoiceData,
          is_recurring: true,
          recurring_frequency: 'monthly',
          next_invoice_date: '2024-02-01'
        });
        
        const nextInvoice = recurringInvoice.generateNextInvoice();
        expect(nextInvoice).toBeDefined();
        expect(nextInvoice?.client_id).toBe(recurringInvoice.client_id);
        expect(nextInvoice?.is_recurring).toBe(true);
      });

      it('should return null for non-recurring invoice', () => {
        const nextInvoice = invoice.generateNextInvoice();
        expect(nextInvoice).toBeNull();
      });
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const invoice = new Invoice(validInvoiceData);
      const json = invoice.toJSON();
      
      expect(json.invoice_number).toBe('INV-2024-001');
      expect(json.status).toBe(InvoiceStatus.DRAFT);
      expect(json.total_amount).toBe(82600);
    });

    it('should deserialize from JSON correctly', () => {
      const invoice = Invoice.fromJSON(validInvoiceData);
      
      expect(invoice).toBeInstanceOf(Invoice);
      expect(invoice.invoice_number).toBe('INV-2024-001');
      expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = Invoice.validate(validInvoiceData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = Invoice.validate({ ...validInvoiceData, invoice_number: '' });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});