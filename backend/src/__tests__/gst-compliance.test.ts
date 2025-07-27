import { calculateGST, validateGSTIN, generateGSTReport } from '../utils/gst-utils'
import { Invoice } from '../models/Invoice'
import { Client } from '../models/Client'
import { InvoiceStatus, PaymentStatus } from '../types/index'

describe('GST Compliance Tests', () => {
  describe('GST Calculations', () => {
    it('should calculate CGST and SGST for intra-state transactions', () => {
      const invoice = {
        amount: 10000,
        clientState: 'Maharashtra',
        businessState: 'Maharashtra'
      }
      
      const gstCalculation = calculateGST(invoice)
      
      expect(gstCalculation.cgst).toBe(900) // 9% CGST
      expect(gstCalculation.sgst).toBe(900) // 9% SGST
      expect(gstCalculation.igst).toBe(0)
      expect(gstCalculation.totalTax).toBe(1800)
      expect(gstCalculation.totalAmount).toBe(11800)
    })

    it('should calculate IGST for inter-state transactions', () => {
      const invoice = {
        amount: 10000,
        clientState: 'Karnataka',
        businessState: 'Maharashtra'
      }
      
      const gstCalculation = calculateGST(invoice)
      
      expect(gstCalculation.cgst).toBe(0)
      expect(gstCalculation.sgst).toBe(0)
      expect(gstCalculation.igst).toBe(1800) // 18% IGST
      expect(gstCalculation.totalTax).toBe(1800)
      expect(gstCalculation.totalAmount).toBe(11800)
    })

    it('should handle different GST rates based on service type', () => {
      const consultingInvoice = {
        amount: 10000,
        serviceType: 'consulting',
        clientState: 'Maharashtra',
        businessState: 'Maharashtra'
      }
      
      const gstCalculation = calculateGST(consultingInvoice)
      expect(gstCalculation.totalTax).toBe(1800) // 18% for consulting
      
      const designInvoice = {
        amount: 10000,
        serviceType: 'design',
        clientState: 'Maharashtra',
        businessState: 'Maharashtra'
      }
      
      const designGST = calculateGST(designInvoice)
      expect(designGST.totalTax).toBe(1800) // 18% for design services
    })
  })

  describe('GSTIN Validation', () => {
    it('should validate correct GSTIN format', () => {
      const validGSTINs = [
        '27ABCDE1234F1Z5',
        '09ABCDE1234F1Z5',
        '33ABCDE1234F1Z5'
      ]
      
      validGSTINs.forEach(gstin => {
        expect(validateGSTIN(gstin)).toBe(true)
      })
    })

    it('should reject invalid GSTIN format', () => {
      const invalidGSTINs = [
        '27ABCDE1234F1Z', // Too short
        '27ABCDE1234F1Z56', // Too long
        '27abcde1234f1z5', // Lowercase
        '27ABCDE1234F1Z6', // Invalid check digit
        'INVALID_GSTIN'
      ]
      
      invalidGSTINs.forEach(gstin => {
        expect(validateGSTIN(gstin)).toBe(false)
      })
    })

    it('should validate GSTIN check digit', () => {
      // Test with known valid GSTIN
      expect(validateGSTIN('27ABCDE1234F1Z5')).toBe(true)
      
      // Test with invalid check digit
      expect(validateGSTIN('27ABCDE1234F1Z6')).toBe(false)
    })
  })

  describe('HSN/SAC Code Integration', () => {
    it('should assign correct HSN codes for products', () => {
      const productInvoice = {
        lineItems: [
          { description: 'Software License', type: 'product', hsnCode: '85234910' },
          { description: 'Hardware', type: 'product', hsnCode: '84713000' }
        ]
      }
      
      productInvoice.lineItems.forEach(item => {
        expect(item.hsnCode).toMatch(/^\d{8}$/)
      })
    })

    it('should assign correct SAC codes for services', () => {
      const serviceInvoice = {
        lineItems: [
          { description: 'Consulting Services', type: 'service', sacCode: '998314' },
          { description: 'Design Services', type: 'service', sacCode: '998399' }
        ]
      }
      
      serviceInvoice.lineItems.forEach(item => {
        expect(item.sacCode).toMatch(/^\d{6}$/)
      })
    })
  })

  describe('E-Invoice Generation', () => {
    it('should generate e-invoice JSON in government format', () => {
      const invoice = new Invoice({
        invoice_number: 'INV-2024-001',
        client_id: 'client-1',
        subtotal: 10000,
        tax_breakdown: {
          cgst: 900,
          sgst: 900,
          igst: 0,
          total_tax: 1800
        },
        total_amount: 11800,
        line_items: [
          {
            description: 'Consulting Services',
            quantity: 1,
            rate: 10000,
            amount: 10000,
            hsn_sac_code: '998314'
          }
        ],
        currency: 'INR',
        status: 'draft',
        issue_date: '2024-01-25',
        due_date: '2024-02-25',
        payment_terms: 'Net 30',
        is_recurring: false,
        payment_status: 'pending',
        paid_amount: 0
      })
      
      const client = new Client({
        name: 'Test Client',
        gstin: '27ABCDE1234F1Z5',
        address: 'Test Address, Mumbai, Maharashtra, 400001'
      })
      
      // Mock e-invoice generation
      const eInvoice = {
        Version: '1.1',
        TranDtls: { TaxSch: 'GST', SupTyp: 'B2B' },
        DocDtls: { No: invoice.invoice_number, Dt: invoice.issue_date },
        SellerDtls: { Gstin: '27ABCDE1234F1Z5' },
        BuyerDtls: { Gstin: client.gstin },
        ItemList: invoice.line_items,
        ValDtls: { TotInvVal: invoice.total_amount }
      }
      
      // Validate e-invoice structure
      expect(eInvoice).toHaveProperty('Version', '1.1')
      expect(eInvoice).toHaveProperty('TranDtls')
      expect(eInvoice).toHaveProperty('DocDtls')
      expect(eInvoice).toHaveProperty('SellerDtls')
      expect(eInvoice).toHaveProperty('BuyerDtls')
      expect(eInvoice).toHaveProperty('ItemList')
      expect(eInvoice).toHaveProperty('ValDtls')
      
      // Validate mandatory fields
      expect(eInvoice.DocDtls.No).toBe('INV-2024-001')
      expect(eInvoice.BuyerDtls.Gstin).toBe('27ABCDE1234F1Z5')
      expect(eInvoice.ValDtls.TotInvVal).toBe(11800)
    })

    it('should generate QR code for e-invoice', () => {
      const invoice = new Invoice({
        invoice_number: 'INV-2024-001',
        client_id: 'client-1',
        subtotal: 10000,
        tax_breakdown: { cgst: 900, sgst: 900, igst: 0, total_tax: 1800 },
        total_amount: 11800,
        line_items: [],
        currency: 'INR',
        status: 'draft',
        issue_date: '2024-01-25',
        due_date: '2024-02-25',
        payment_terms: 'Net 30',
        is_recurring: false,
        payment_status: 'pending',
        paid_amount: 0
      })
      
      // Mock QR code generation
      const qrCode = `${invoice.invoice_number}|${invoice.total_amount}|test-irn-123456789`
      
      expect(qrCode).toContain('INV-2024-001')
      expect(qrCode).toContain('11800')
      expect(qrCode).toContain('test-irn-123456789')
    })
  })

  describe('GST Reports Generation', () => {
    it('should generate GSTR1 report for outward supplies', () => {
      const invoices = [
        {
          invoiceNumber: 'INV-001',
          clientGSTIN: '27ABCDE1234F1Z5',
          amount: 10000,
          gstAmount: 1800,
          invoiceDate: '2024-01-15',
          placeOfSupply: 'Maharashtra'
        },
        {
          invoiceNumber: 'INV-002',
          clientGSTIN: '29ABCDE1234F1Z5',
          amount: 15000,
          gstAmount: 2700,
          invoiceDate: '2024-01-20',
          placeOfSupply: 'Karnataka'
        }
      ]
      
      const gstr1Report = generateGSTReport('GSTR1', invoices, '2024-01')
      
      expect(gstr1Report).toHaveProperty('b2b') // B2B supplies
      expect(gstr1Report).toHaveProperty('b2cl') // B2C large supplies
      expect(gstr1Report).toHaveProperty('hsn') // HSN summary
      
      // Validate B2B section
      expect(gstr1Report.b2b).toHaveLength(2)
      expect(gstr1Report.b2b[0].ctin).toBe('27ABCDE1234F1Z5')
    })

    it('should generate GSTR3B monthly summary', () => {
      const transactions = [
        { type: 'outward', amount: 100000, gstAmount: 18000 },
        { type: 'inward', amount: 50000, gstAmount: 9000 }
      ]
      
      const gstr3bReport = generateGSTReport('GSTR3B', transactions, '2024-01')
      
      expect(gstr3bReport).toHaveProperty('outward_supplies')
      expect(gstr3bReport).toHaveProperty('inward_supplies')
      expect(gstr3bReport).toHaveProperty('itc_details')
      expect(gstr3bReport).toHaveProperty('tax_liability')
      
      expect(gstr3bReport.outward_supplies.total_taxable_value).toBe(100000)
      expect(gstr3bReport.outward_supplies.total_tax_amount).toBe(18000)
    })
  })

  describe('Reverse Charge Mechanism', () => {
    it('should apply reverse charge for applicable services', () => {
      const reverseChargeInvoice = {
        amount: 10000,
        serviceType: 'legal_services',
        clientType: 'business',
        reverseCharge: true
      }
      
      const gstCalculation = calculateGST(reverseChargeInvoice)
      
      expect(gstCalculation.reverseCharge).toBe(true)
      expect(gstCalculation.supplierTax).toBe(0)
      expect(gstCalculation.recipientTax).toBe(1800)
    })
  })

  describe('TDS Integration', () => {
    it('should calculate TDS for applicable transactions', () => {
      const invoice = {
        amount: 100000,
        clientType: 'government',
        serviceType: 'consulting',
        tdsApplicable: true
      }
      
      const tdsCalculation = calculateGST(invoice)
      
      expect(tdsCalculation.tdsRate).toBe(10) // 10% TDS for consulting
      expect(tdsCalculation.tdsAmount).toBe(10000)
      expect(tdsCalculation.netPayable).toBe(108000) // Amount + GST - TDS
    })
  })
})