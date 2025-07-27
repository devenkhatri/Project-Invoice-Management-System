describe('GST Compliance and Reporting Workflow', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should generate GST-compliant invoices with proper tax calculations', () => {
    // Create Indian client with GST details
    cy.createTestClient({
      name: 'GST Test Client',
      email: 'gst@test.com',
      gstin: '29ABCDE1234F1Z5',
      address: 'Mumbai, Maharashtra, India'
    })

    // Create project
    cy.createTestProject({
      name: 'GST Compliance Project',
      client: 'GST Test Client'
    })

    // Create invoice with GST calculations
    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    cy.get('[data-testid="client-select"]').select('GST Test Client')
    
    // Add line items
    cy.get('[data-testid="add-line-item-button"]').click()
    cy.get('[data-testid="item-description-input"]').type('Web Development Services')
    cy.get('[data-testid="item-hsn-input"]').type('998314')
    cy.get('[data-testid="item-quantity-input"]').type('1')
    cy.get('[data-testid="item-rate-input"]').type('50000')
    
    // Verify GST calculations
    cy.get('[data-testid="cgst-amount"]').should('contain', '4500') // 9% CGST
    cy.get('[data-testid="sgst-amount"]').should('contain', '4500') // 9% SGST
    cy.get('[data-testid="total-amount"]').should('contain', '59000')
    
    // Save and generate PDF
    cy.get('[data-testid="save-invoice-button"]').click()
    cy.get('[data-testid="generate-pdf-button"]').click()
    
    // Verify PDF contains GST details
    cy.get('[data-testid="pdf-preview"]').should('contain', 'GSTIN: 29ABCDE1234F1Z5')
    cy.get('[data-testid="pdf-preview"]').should('contain', 'HSN/SAC: 998314')
  })

  it('should generate GSTR1 report for outward supplies', () => {
    // Navigate to GST reports
    cy.visit('/reports/gst')
    cy.get('[data-testid="gstr1-tab"]').click()
    
    // Set date range
    cy.get('[data-testid="from-date-input"]').type('2024-01-01')
    cy.get('[data-testid="to-date-input"]').type('2024-01-31')
    cy.get('[data-testid="generate-report-button"]').click()
    
    // Verify report sections
    cy.get('[data-testid="b2b-supplies"]').should('be.visible')
    cy.get('[data-testid="b2c-supplies"]').should('be.visible')
    cy.get('[data-testid="export-supplies"]').should('be.visible')
    
    // Export report
    cy.get('[data-testid="export-excel-button"]').click()
    cy.get('[data-testid="download-link"]').should('be.visible')
  })

  it('should handle inter-state vs intra-state GST calculations', () => {
    // Create clients in different states
    cy.createTestClient({
      name: 'Maharashtra Client',
      gstin: '27ABCDE1234F1Z5',
      state: 'Maharashtra'
    })
    
    cy.createTestClient({
      name: 'Karnataka Client', 
      gstin: '29ABCDE1234F1Z5',
      state: 'Karnataka'
    })

    // Test intra-state transaction (CGST + SGST)
    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    cy.get('[data-testid="client-select"]').select('Maharashtra Client')
    cy.addInvoiceLineItem('Services', 10000)
    
    cy.get('[data-testid="cgst-amount"]').should('contain', '900')
    cy.get('[data-testid="sgst-amount"]').should('contain', '900')
    cy.get('[data-testid="igst-amount"]').should('not.exist')
    
    // Test inter-state transaction (IGST)
    cy.get('[data-testid="client-select"]').select('Karnataka Client')
    cy.get('[data-testid="igst-amount"]').should('contain', '1800')
    cy.get('[data-testid="cgst-amount"]').should('not.exist')
    cy.get('[data-testid="sgst-amount"]').should('not.exist')
  })

  it('should generate e-invoices with QR codes and IRN', () => {
    cy.createTestClient({
      name: 'E-Invoice Client',
      gstin: '29ABCDE1234F1Z5'
    })

    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    cy.get('[data-testid="client-select"]').select('E-Invoice Client')
    cy.addInvoiceLineItem('Consulting', 100000)
    
    // Enable e-invoicing
    cy.get('[data-testid="enable-einvoice-checkbox"]').check()
    cy.get('[data-testid="save-invoice-button"]').click()
    
    // Generate e-invoice
    cy.get('[data-testid="generate-einvoice-button"]').click()
    
    // Verify e-invoice elements
    cy.get('[data-testid="irn-number"]').should('be.visible')
    cy.get('[data-testid="qr-code"]').should('be.visible')
    cy.get('[data-testid="ack-number"]').should('be.visible')
    cy.get('[data-testid="ack-date"]').should('be.visible')
  })
})

describe('GST Compliance Edge Cases', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should handle reverse charge mechanism', () => {
    cy.createTestClient({
      name: 'Unregistered Client',
      gstin: null,
      isUnregistered: true
    })

    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    cy.get('[data-testid="client-select"]').select('Unregistered Client')
    cy.addInvoiceLineItem('Legal Services', 50000)
    
    // Enable reverse charge
    cy.get('[data-testid="reverse-charge-checkbox"]').check()
    
    // Verify reverse charge indication
    cy.get('[data-testid="reverse-charge-note"]').should('contain', 'Reverse Charge Applicable')
    cy.get('[data-testid="tax-amount"]').should('contain', '0')
  })

  it('should validate GST rates for different HSN codes', () => {
    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    
    // Test different HSN codes with their respective GST rates
    const hsnTestCases = [
      { hsn: '998314', rate: 18, description: 'IT Services' },
      { hsn: '996511', rate: 18, description: 'Consulting' },
      { hsn: '854232', rate: 18, description: 'Software' }
    ]

    hsnTestCases.forEach((testCase, index) => {
      cy.get('[data-testid="add-line-item-button"]').click()
      cy.get(`[data-testid="item-hsn-input-${index}"]`).type(testCase.hsn)
      cy.get(`[data-testid="item-description-input-${index}"]`).type(testCase.description)
      cy.get(`[data-testid="item-rate-input-${index}"]`).type('10000')
      
      // Verify auto-populated GST rate
      cy.get(`[data-testid="gst-rate-${index}"]`).should('contain', testCase.rate)
    })
  })
})