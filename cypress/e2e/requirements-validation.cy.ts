describe('Requirements Validation Tests', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Requirement 1: Project Management', () => {
    it('should allow creating projects with all required fields', () => {
      cy.visit('/projects')
      cy.get('[data-testid="create-project-button"]').click()
      
      // Test all required fields
      cy.get('[data-testid="project-name-input"]').type('Test Project')
      cy.get('[data-testid="project-client-select"]').select('1')
      cy.get('[data-testid="project-deadline-input"]').type('2024-12-31')
      cy.get('[data-testid="project-status-select"]').select('active')
      cy.get('[data-testid="save-project-button"]').click()
      
      cy.get('[data-testid="success-message"]').should('contain', 'Project created successfully')
    })

    it('should display projects with filtering options', () => {
      cy.visit('/projects')
      
      // Test status filtering
      cy.get('[data-testid="status-filter"]').select('active')
      cy.get('[data-testid="project-list"]').should('be.visible')
      
      // Test search functionality
      cy.get('[data-testid="search-input"]').type('Test')
      cy.get('[data-testid="project-list"]').should('contain', 'Test')
    })

    it('should support task management with priorities and deadlines', () => {
      cy.createTestProject()
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').first().click()
      
      // Add task with priority and deadline
      cy.get('[data-testid="add-task-button"]').click()
      cy.get('[data-testid="task-title-input"]').type('High Priority Task')
      cy.get('[data-testid="task-priority-select"]').select('high')
      cy.get('[data-testid="task-due-date-input"]').type('2024-02-15')
      cy.get('[data-testid="save-task-button"]').click()
      
      cy.get('[data-testid="task-list"]').should('contain', 'High Priority Task')
    })

    it('should provide multiple task views (Kanban, Gantt, List)', () => {
      cy.createTestProject()
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').first().click()
      
      // Test Kanban view
      cy.get('[data-testid="kanban-view-button"]').click()
      cy.get('[data-testid="kanban-board"]').should('be.visible')
      
      // Test Gantt view
      cy.get('[data-testid="gantt-view-button"]').click()
      cy.get('[data-testid="gantt-chart"]').should('be.visible')
      
      // Test List view
      cy.get('[data-testid="list-view-button"]').click()
      cy.get('[data-testid="task-list"]').should('be.visible')
    })

    it('should support time tracking with timer functionality', () => {
      cy.createTestProject()
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').first().click()
      cy.get('[data-testid="add-task-button"]').click()
      cy.get('[data-testid="task-title-input"]').type('Timed Task')
      cy.get('[data-testid="save-task-button"]').click()
      
      // Test timer functionality
      cy.get('[data-testid="task-list"]').contains('Timed Task').click()
      cy.get('[data-testid="start-timer-button"]').click()
      cy.get('[data-testid="timer-display"]').should('be.visible')
      cy.wait(1000)
      cy.get('[data-testid="stop-timer-button"]').click()
      
      // Verify time entry was created
      cy.get('[data-testid="time-entries"]').should('contain', '00:00:01')
    })
  })

  describe('Requirement 2: Document and File Management', () => {
    it('should allow file uploads and association with projects', () => {
      cy.createTestProject()
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').first().click()
      
      // Test file upload
      cy.get('[data-testid="upload-file-button"]').click()
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/test-document.pdf', { force: true })
      cy.get('[data-testid="upload-button"]').click()
      
      cy.get('[data-testid="file-list"]').should('contain', 'test-document.pdf')
    })

    it('should provide secure client portal for file sharing', () => {
      cy.createTestClient()
      cy.visit('/clients')
      cy.get('[data-testid="client-list"]').first().click()
      cy.get('[data-testid="generate-portal-access-button"]').click()
      
      cy.get('[data-testid="portal-link"]').should('be.visible')
      cy.get('[data-testid="portal-credentials"]').should('be.visible')
    })
  })

  describe('Requirement 3: Invoice Generation and Management', () => {
    it('should generate GST-compliant invoices', () => {
      cy.createTestClient({ gstin: '27ABCDE1234F1Z5' })
      cy.createTestProject()
      cy.createTestInvoice()
      
      cy.visit('/invoices')
      cy.get('[data-testid="invoice-list"]').first().click()
      
      // Verify GST compliance
      cy.get('[data-testid="invoice-preview"]').should('contain', 'GSTIN')
      cy.get('[data-testid="tax-breakdown"]').should('contain', 'CGST')
      cy.get('[data-testid="tax-breakdown"]').should('contain', 'SGST')
    })

    it('should support recurring invoice scheduling', () => {
      cy.createTestClient()
      cy.visit('/invoices')
      cy.get('[data-testid="create-invoice-button"]').click()
      
      cy.get('[data-testid="recurring-invoice-checkbox"]').check()
      cy.get('[data-testid="recurring-frequency-select"]').select('monthly')
      cy.get('[data-testid="recurring-end-date-input"]').type('2024-12-31')
      
      cy.get('[data-testid="save-invoice-button"]').click()
      cy.get('[data-testid="success-message"]').should('contain', 'Recurring invoice created')
    })

    it('should support multiple currencies and tax configurations', () => {
      cy.visit('/invoices')
      cy.get('[data-testid="create-invoice-button"]').click()
      
      cy.get('[data-testid="currency-select"]').select('USD')
      cy.get('[data-testid="tax-rate-input"]').clear().type('10')
      
      cy.get('[data-testid="invoice-preview"]').should('contain', 'USD')
    })
  })

  describe('Requirement 4: Payment Processing and Tracking', () => {
    it('should integrate with multiple payment gateways', () => {
      cy.createTestInvoice()
      cy.visit('/invoices')
      cy.get('[data-testid="invoice-list"]').first().click()
      
      cy.get('[data-testid="payment-links"]').should('contain', 'Stripe')
      cy.get('[data-testid="payment-links"]').should('contain', 'PayPal')
      cy.get('[data-testid="payment-links"]').should('contain', 'Razorpay')
    })

    it('should automatically update invoice status when payment received', () => {
      cy.createTestInvoice()
      cy.visit('/invoices')
      
      // Simulate payment received
      cy.get('[data-testid="mark-paid-button"]').first().click()
      cy.get('[data-testid="payment-amount-input"]').type('5000')
      cy.get('[data-testid="confirm-payment-button"]').click()
      
      cy.get('[data-testid="invoice-status"]').should('contain', 'Paid')
    })

    it('should send automated payment reminders for overdue invoices', () => {
      cy.visit('/settings/automation')
      cy.get('[data-testid="payment-reminders-toggle"]').should('be.checked')
      
      // Verify reminder configuration
      cy.get('[data-testid="reminder-schedule"]').should('be.visible')
    })
  })

  describe('Requirement 5: Client and Contact Management', () => {
    it('should maintain comprehensive client database', () => {
      cy.createTestClient({
        name: 'Comprehensive Client',
        email: 'comprehensive@test.com',
        phone: '+91-9876543210',
        address: 'Test Address',
        gstin: '27ABCDE1234F1Z5'
      })
      
      cy.visit('/clients')
      cy.get('[data-testid="client-list"]').should('contain', 'Comprehensive Client')
      
      // Test client details view
      cy.get('[data-testid="client-list"]').contains('Comprehensive Client').click()
      cy.get('[data-testid="client-details"]').should('contain', 'comprehensive@test.com')
      cy.get('[data-testid="client-details"]').should('contain', '+91-9876543210')
    })

    it('should provide search and filtering capabilities', () => {
      cy.visit('/clients')
      
      cy.get('[data-testid="search-input"]').type('Test')
      cy.get('[data-testid="client-list"]').should('be.visible')
      
      cy.get('[data-testid="filter-by-status"]').select('active')
      cy.get('[data-testid="client-list"]').should('be.visible')
    })
  })

  describe('Requirement 6: Financial Tracking and Reporting', () => {
    it('should track expenses by project', () => {
      cy.createTestProject()
      cy.visit('/expenses')
      
      cy.get('[data-testid="add-expense-button"]').click()
      cy.get('[data-testid="expense-project-select"]').select('1')
      cy.get('[data-testid="expense-amount-input"]').type('1000')
      cy.get('[data-testid="expense-category-select"]').select('travel')
      cy.get('[data-testid="save-expense-button"]').click()
      
      cy.get('[data-testid="expense-list"]').should('contain', '1000')
    })

    it('should calculate profit/loss per project and overall', () => {
      cy.visit('/reports/financial')
      
      cy.get('[data-testid="profit-loss-report"]').should('be.visible')
      cy.get('[data-testid="project-profitability"]').should('be.visible')
      cy.get('[data-testid="overall-profit-loss"]').should('be.visible')
    })

    it('should support multiple export formats', () => {
      cy.visit('/reports')
      
      cy.get('[data-testid="export-button"]').click()
      cy.get('[data-testid="export-format-select"]').should('contain', 'PDF')
      cy.get('[data-testid="export-format-select"]').should('contain', 'Excel')
      cy.get('[data-testid="export-format-select"]').should('contain', 'CSV')
    })
  })

  describe('Requirement 11: Google Sheets Backend', () => {
    it('should store all data in Google Sheets', () => {
      // This would require backend API testing
      cy.request('GET', '/api/health').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('sheetsConnected', true)
      })
    })

    it('should maintain data relationships across sheets', () => {
      cy.createTestClient()
      cy.createTestProject()
      
      // Verify relationship is maintained
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').first().click()
      cy.get('[data-testid="project-client"]').should('be.visible')
    })
  })
})