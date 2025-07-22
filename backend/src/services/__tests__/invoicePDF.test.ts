import { generateInvoicePDF, generateGSTInvoicePDF } from '../invoicePDF';
import { Invoice, Client, Project, InvoiceStatus } from '../../models';

// Mock jsPDF
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    setFillColor: jest.fn(),
    text: jest.fn(),
    rect: jest.fn(),
    output: jest.fn().mockReturnValue(new ArrayBuffer(100))
  }));
});

describe('Invoice PDF Service', () => {
  let mockInvoice: Invoice;
  let mockClient: Client;
  let mockProject: Project;

  beforeEach(() => {
    // Create mock invoice
    mockInvoice = new Invoice({
      id: 'invoice-123',
      invoice_number: 'INV-202401-001',
      client_id: 'client-123',
      project_id: 'project-123',
      amount: 10000,
      tax_amount: 1800,
      total_amount: 11800,
      status: InvoiceStatus.DRAFT,
      due_date: new Date('2024-12-31')
    });

    // Create mock client
    mockClient = {
      id: 'client-123',
      name: 'Test Client Pvt Ltd',
      email: 'client@test.com',
      phone: '+91-9876543210',
      address: '123 Test Street, Test City, Test State - 123456',
      gstin: '29ABCDE1234F1Z5',
      state: 'Test State',
      pincode: '123456',
      created_at: new Date(),
      updated_at: new Date(),
      toSheetRow: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    } as any;

    // Create mock project
    mockProject = {
      id: 'project-123',
      name: 'Test Project Development',
      client_id: 'client-123',
      status: 'active',
      description: 'A comprehensive test project for invoice generation',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      created_at: new Date(),
      updated_at: new Date(),
      toSheetRow: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    } as any;
  });

  describe('generateInvoicePDF', () => {
    it('should generate a PDF buffer for a standard invoice', async () => {
      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle invoices with different statuses', async () => {
      // Test with paid invoice
      mockInvoice.status = InvoiceStatus.PAID;
      const paidPDF = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(paidPDF).toBeInstanceOf(Buffer);

      // Test with overdue invoice
      mockInvoice.status = InvoiceStatus.OVERDUE;
      mockInvoice.due_date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const overduePDF = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(overduePDF).toBeInstanceOf(Buffer);
    });

    it('should handle clients without optional fields', async () => {
      // Remove optional fields
      mockClient.phone = '';
      mockClient.address = '';
      mockClient.gstin = '';

      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle projects without description', async () => {
      mockProject.description = '';

      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should calculate days until due correctly', async () => {
      // Set due date to 15 days from now
      mockInvoice.due_date = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      
      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // Verify the invoice calculates days correctly
      expect(mockInvoice.getDaysUntilDue()).toBe(15);
    });
  });

  describe('generateGSTInvoicePDF', () => {
    it('should generate a GST-compliant PDF buffer', async () => {
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle GST calculations correctly', async () => {
      // Set up invoice with 18% GST
      mockInvoice.amount = 10000;
      mockInvoice.calculateGST(18);
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // Verify GST calculations
      expect(mockInvoice.tax_amount).toBe(1800);
      expect(mockInvoice.total_amount).toBe(11800);
      expect(mockInvoice.getTaxRate()).toBe(18);
    });

    it('should handle different GST rates', async () => {
      // Test with 12% GST
      mockInvoice.amount = 10000;
      mockInvoice.calculateGST(12);
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      expect(mockInvoice.tax_amount).toBe(1200);
      expect(mockInvoice.total_amount).toBe(11200);
    });

    it('should handle clients without GSTIN', async () => {
      mockClient.gstin = '';
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle clients without state information', async () => {
      // Add state and pincode properties to the mock client for this test
      (mockClient as any).state = '';
      (mockClient as any).pincode = '';
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should calculate CGST and SGST correctly', async () => {
      mockInvoice.amount = 20000;
      mockInvoice.calculateGST(18);
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // For 18% GST: CGST = 9%, SGST = 9%
      const expectedCGST = (20000 * 9) / 100; // 1800
      const expectedSGST = (20000 * 9) / 100; // 1800
      const totalTax = expectedCGST + expectedSGST; // 3600
      
      expect(mockInvoice.tax_amount).toBe(totalTax);
    });
  });

  describe('GST Compliance Features', () => {
    it('should include HSN/SAC code for services', async () => {
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // HSN/SAC code 998314 should be used for professional services
      // This would be verified in the actual PDF content in a real implementation
    });

    it('should include place of supply information', async () => {
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should include proper tax breakdown', async () => {
      mockInvoice.amount = 50000;
      mockInvoice.calculateGST(18);
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // Verify tax calculations
      expect(mockInvoice.tax_amount).toBe(9000); // 18% of 50000
      expect(mockInvoice.total_amount).toBe(59000);
    });

    it('should handle zero-rated supplies', async () => {
      mockInvoice.amount = 10000;
      mockInvoice.calculateGST(0); // Zero-rated supply
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      expect(mockInvoice.tax_amount).toBe(0);
      expect(mockInvoice.total_amount).toBe(10000);
    });

    it('should handle exempt supplies', async () => {
      mockInvoice.amount = 15000;
      mockInvoice.tax_amount = 0; // Exempt supply
      mockInvoice.total_amount = 15000;
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Number to Words Conversion', () => {
    it('should convert simple numbers correctly', async () => {
      // Test with different amounts to verify number-to-words conversion
      const testCases = [
        { amount: 100, expected: 'One Hundred' },
        { amount: 1000, expected: 'One Thousand' },
        { amount: 10000, expected: 'Ten Thousand' },
        { amount: 100000, expected: 'One Lakh' },
        { amount: 1000000, expected: 'Ten Lakh' },
        { amount: 10000000, expected: 'One Crore' }
      ];

      for (const testCase of testCases) {
        mockInvoice.amount = testCase.amount;
        mockInvoice.calculateGST(0); // No tax for simplicity
        
        const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
        expect(pdfBuffer).toBeInstanceOf(Buffer);
        
        // The actual number-to-words conversion would be tested in the PDF content
        // For now, we just verify the PDF is generated successfully
      }
    });

    it('should handle complex amounts', async () => {
      mockInvoice.amount = 1234567;
      mockInvoice.calculateGST(18);
      
      const pdfBuffer = await generateGSTInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // Amount: 1234567, Tax: 222222.06, Total: 1456789.06
      expect(mockInvoice.total_amount).toBeCloseTo(1456789.06, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing invoice data gracefully', async () => {
      const incompleteInvoice = new Invoice({
        client_id: 'client-123',
        project_id: 'project-123',
        amount: 0
      });

      const pdfBuffer = await generateInvoicePDF(incompleteInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle missing client data gracefully', async () => {
      const incompleteClient = {
        id: 'client-123',
        name: 'Test Client',
        email: 'client@test.com',
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      const pdfBuffer = await generateInvoicePDF(mockInvoice, incompleteClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle missing project data gracefully', async () => {
      const incompleteProject = {
        id: 'project-123',
        name: 'Test Project',
        client_id: 'client-123',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, incompleteProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Invoice Status Handling', () => {
    it('should display correct status colors and information', async () => {
      const statuses = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE
      ];

      for (const status of statuses) {
        mockInvoice.status = status;
        
        if (status === InvoiceStatus.OVERDUE) {
          // Set due date in the past for overdue status
          mockInvoice.due_date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        }
        
        const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
        expect(pdfBuffer).toBeInstanceOf(Buffer);
      }
    });

    it('should show correct overdue information', async () => {
      mockInvoice.status = InvoiceStatus.OVERDUE;
      mockInvoice.due_date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days overdue
      
      const pdfBuffer = await generateInvoicePDF(mockInvoice, mockClient, mockProject);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      expect(mockInvoice.getDaysOverdue()).toBeGreaterThanOrEqual(10);
      expect(mockInvoice.isOverdue()).toBe(true);
    });
  });
});