import { Invoice } from '../Invoice';
import { InvoiceStatus } from '../types';

describe('Invoice Model', () => {
  const validInvoiceData = {
    invoice_number: 'INV-2024-001',
    client_id: '123e4567-e89b-12d3-a456-426614174000',
    project_id: '123e4567-e89b-12d3-a456-426614174001',
    amount: 10000,
    tax_amount: 1800,
    total_amount: 11800,
    status: InvoiceStatus.DRAFT,
    due_date: new Date('2024-12-31')
  };

  describe('Constructor', () => {
    it('should create an invoice with valid data', () => {
      const invoice = new Invoice(validInvoiceData);
      
      expect(invoice.invoice_number).toBe(validInvoiceData.invoice_number);
      expect(invoice.client_id).toBe(validInvoiceData.client_id);
      expect(invoice.amount).toBe(validInvoiceData.amount);
      expect(invoice.total_amount).toBe(validInvoiceData.total_amount);
      expect(invoice.id).toBeDefined();
      expect(invoice.id).toMatch(/^inv_/);
    });

    it('should generate invoice number if not provided', () => {
      const invoice = new Invoice({ ...validInvoiceData, invoice_number: undefined });
      expect(invoice.invoice_number).toMatch(/^INV-\d{6}-\d{6}$/);
    });

    it('should set default due date if not provided', () => {
      const invoice = new Invoice({ ...validInvoiceData, due_date: undefined });
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      
      expect(invoice.due_date.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('Validation', () => {
    it('should validate a valid invoice', () => {
      const invoice = new Invoice(validInvoiceData);
      const result = invoice.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty invoice number', () => {
      const invoice = new Invoice({ ...validInvoiceData });
      invoice.invoice_number = ''; // Set after construction to bypass default generation
      const result = invoice.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'invoice_number',
          message: 'Invoice number is required'
        })
      );
    });

    it('should fail validation for empty client_id', () => {
      const invoice = new Invoice({ ...validInvoiceData, client_id: '' });
      const result = invoice.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'client_id',
          message: 'Client ID is required'
        })
      );
    });

    it('should fail validation for negative amount', () => {
      const invoice = new Invoice({ ...validInvoiceData, amount: -1000 });
      const result = invoice.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Amount must be non-negative'
        })
      );
    });

    it('should fail validation when total is less than amount + tax', () => {
      const invoice = new Invoice({
        ...validInvoiceData,
        amount: 10000,
        tax_amount: 1800,
        total_amount: 10000 // Should be at least 11800
      });
      const result = invoice.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'total_amount',
          message: 'Total amount must be at least the sum of amount and tax'
        })
      );
    });
  });

  describe('Business Logic Methods', () => {
    let invoice: Invoice;

    beforeEach(() => {
      invoice = new Invoice(validInvoiceData);
    });

    it('should correctly identify paid invoices', () => {
      invoice.status = InvoiceStatus.PAID;
      expect(invoice.isPaid()).toBe(true);

      invoice.status = InvoiceStatus.DRAFT;
      expect(invoice.isPaid()).toBe(false);
    });

    it('should correctly identify overdue invoices', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      invoice.due_date = pastDate;
      invoice.status = InvoiceStatus.SENT;
      expect(invoice.isOverdue()).toBe(true);

      invoice.status = InvoiceStatus.PAID;
      expect(invoice.isOverdue()).toBe(false);
    });

    it('should calculate days overdue correctly', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      
      invoice.due_date = pastDate;
      invoice.status = InvoiceStatus.SENT;
      const daysOverdue = invoice.getDaysOverdue();
      expect(daysOverdue).toBeGreaterThanOrEqual(5);
      expect(daysOverdue).toBeLessThanOrEqual(6); // Account for timing differences
    });

    it('should calculate days until due correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      invoice.due_date = futureDate;
      expect(invoice.getDaysUntilDue()).toBe(10);
    });

    it('should calculate GST correctly', () => {
      invoice.amount = 10000;
      invoice.calculateGST(18);
      
      expect(invoice.tax_amount).toBe(1800);
      expect(invoice.total_amount).toBe(11800);
    });

    it('should mark as sent correctly', () => {
      invoice.status = InvoiceStatus.DRAFT;
      invoice.markAsSent();
      expect(invoice.status).toBe(InvoiceStatus.SENT);
    });

    it('should not change status if not draft when marking as sent', () => {
      invoice.status = InvoiceStatus.PAID;
      invoice.markAsSent();
      expect(invoice.status).toBe(InvoiceStatus.PAID);
    });

    it('should mark as paid correctly', () => {
      invoice.markAsPaid();
      expect(invoice.status).toBe(InvoiceStatus.PAID);
    });

    it('should mark as overdue correctly', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      invoice.due_date = pastDate;
      invoice.status = InvoiceStatus.SENT;
      invoice.markAsOverdue();
      expect(invoice.status).toBe(InvoiceStatus.OVERDUE);
    });

    it('should update amount and recalculate tax', () => {
      invoice.updateAmount(15000, 18);
      
      expect(invoice.amount).toBe(15000);
      expect(invoice.tax_amount).toBe(2700);
      expect(invoice.total_amount).toBe(17700);
    });

    it('should throw error for negative amount', () => {
      expect(() => invoice.updateAmount(-1000)).toThrow('Amount cannot be negative');
    });

    it('should update due date correctly', () => {
      const newDate = new Date('2025-01-31');
      invoice.updateDueDate(newDate);
      expect(invoice.due_date).toEqual(newDate);
    });

    it('should return correct subtotal', () => {
      expect(invoice.getSubtotal()).toBe(invoice.amount);
    });

    it('should calculate tax rate correctly', () => {
      invoice.amount = 10000;
      invoice.tax_amount = 1800;
      expect(invoice.getTaxRate()).toBe(18);
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const invoice = new Invoice(validInvoiceData);
      const row = invoice.toSheetRow();
      
      expect(row.invoice_number).toBe(invoice.invoice_number);
      expect(row.client_id).toBe(invoice.client_id);
      expect(row.amount).toBe(invoice.amount);
      expect(row.total_amount).toBe(invoice.total_amount);
      expect(typeof row.due_date).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_number: 'INV-SHEET-001',
        client_id: '123e4567-e89b-12d3-a456-426614174001',
        project_id: '123e4567-e89b-12d3-a456-426614174002',
        amount: '15000',
        tax_amount: '2700',
        total_amount: '17700',
        status: 'sent',
        due_date: '2024-12-31T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const invoice = Invoice.fromSheetRow(sheetRow);
      
      expect(invoice.id).toBe(sheetRow.id);
      expect(invoice.invoice_number).toBe(sheetRow.invoice_number);
      expect(invoice.amount).toBe(15000);
      expect(invoice.tax_amount).toBe(2700);
      expect(invoice.due_date).toBeInstanceOf(Date);
    });
  });
});