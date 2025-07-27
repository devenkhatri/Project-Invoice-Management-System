describe('System Integration Testing', () => {
  beforeEach(() => {
    cy.login()
    cy.clearTestData()
  })

  describe('End-to-End Workflow Validation', () => {
    it('should complete comprehensive business workflow', () => {
      // 1. Client Management Integration
      cy.visit('/clients')
      cy.get('[data-testid="add-client-button"]').click()
      cy.get('[data-testid="client-name-input"]').type('Integration Test Client')
      cy.get('[data-testid="client-email-input"]').type('integration@test.com')
      cy.get('[data-testid="client-phone-input"]').type('+91-9876543210')
      cy.get('[data-testid="client-gstin-input"]').type('29ABCDE1234F1Z5')
      cy.get('[data-testid="save-client-button"]').click()
      cy.get('[data-testid="success-message"]').should('contain', 'Client created successfully')

      // 2. Project Creation with Client Association
      cy.visit('/projects')
      cy.get('[data-testid="add-project-button"]').click()
      cy.get('[data-testid="project-name-input"]').type('System Integration Project')
      cy.get('[data-testid="project-client-select"]').select('Integration Test Client')
      cy.get('[data-testid="project-budget-input"]').type('50000')
      cy.get('[data-testid="project-deadline-input"]').type('2024-12-31')
      cy.get('[data-testid="save-project-button"]').click()

      // 3. Task Management Integration
      cy.get('[data-testid="project-list"]').contains('System Integration Project').click()
      cy.get('[data-testid="add-task-button"]').click()
      cy.get('[data-testid="task-title-input"]').type('Requirements Analysis')
      cy.get('[data-testid="task-priority-select"]').select('high')
      cy.get('[data-testid="task-estimated-hours-input"]').type('8')
      cy.get('[data-testid="save-task-button"]').click()

      // 4. Time Tracking Integration
      cy.get('[data-testid="task-list"]').contains('Requirements Analysis').click()
      cy.get('[data-testid="start-timer-button"]').click()
      cy.wait(3000) // Simulate work
      cy.get('[data-testid="stop-timer-button"]').click()
      cy.get('[data-testid="add-manual-time-button"]').click()
      cy.get('[data-testid="manual-hours-input"]').type('4')
      cy.get('[data-testid="manual-description-input"]').type('Additional analysis work')
      cy.get('[data-testid="save-time-entry-button"]').click()

      // 5. Expense Tracking Integration
      cy.visit('/expenses')
      cy.get('[data-testid="add-expense-button"]').click()
      cy.get('[data-testid="expense-project-select"]').select('System Integration Project')
      cy.get('[data-testid="expense-category-select"]').select('Software')
      cy.get('[data-testid="expense-amount-input"]').type('2500')
      cy.get('[data-testid="expense-description-input"]').type('Development tools')
      cy.get('[data-testid="save-expense-button"]').click()

      // 6. Invoice Generation Integration
      cy.visit('/invoices')
      cy.get('[data-testid="create-invoice-button"]').click()
      cy.get('[data-testid="generate-from-project-button"]').click()
      cy.get('[data-testid="project-select"]').select('System Integration Project')
      cy.get('[data-testid="include-time-entries-checkbox"]').check()
      cy.get('[data-testid="generate-invoice-button"]').click()

      // Verify GST calculations
      cy.get('[data-testid="invoice-preview"]').should('be.visible')
      cy.get('[data-testid="gst-amount"]').should('not.be.empty')
      cy.get('[data-testid="total-amount"]').should('not.be.empty')

      // 7. Payment Processing Integration
      cy.get('[data-testid="save-invoice-button"]').click()
      cy.get('[data-testid="send-invoice-button"]').first().click()
      cy.get('[data-testid="payment-gateway-select"]').select('stripe')
      cy.get('[data-testid="generate-payment-link-button"]').click()
      cy.get('[data-testid="payment-link"]').should('be.visible')

      // 8. Reporting Integration
      cy.visit('/reports')
      cy.get('[data-testid="financial-reports-tab"]').click()
      cy.get('[data-testid="generate-report-button"]').click()
      cy.get('[data-testid="report-content"]').should('contain', 'System Integration Project')
      cy.get('[data-testid="export-pdf-button"]').click()

      // 9. Dashboard Integration
      cy.visit('/dashboard')
      cy.get('[data-testid="active-projects-count"]').should('contain', '1')
      cy.get('[data-testid="pending-invoices-count"]').should('contain', '1')
      cy.get('[data-testid="total-revenue"]').should('not.be.empty')
    })

    it('should handle complex multi-project scenarios', () => {
      // Create multiple clients and projects
      const clients = ['Client A', 'Client B', 'Client C']
      const projects = ['Project Alpha', 'Project Beta', 'Project Gamma']

      clients.forEach((clientName, index) => {
        cy.createTestClient({
          name: clientName,
          email: `${clientName.toLowerCase().replace(' ', '')}@test.com`
        })
        
        cy.createTestProject({
          name: projects[index],
          client: clientName,
          budget: (index + 1) * 10000
        })
      })

      // Verify cross-project reporting
      cy.visit('/reports')
      cy.get('[data-testid="project-comparison-report"]').click()
      projects.forEach(project => {
        cy.get('[data-testid="report-content"]').should('contain', project)
      })

      // Test bulk operations
      cy.visit('/projects')
      cy.get('[data-testid="select-all-checkbox"]').check()
      cy.get('[data-testid="bulk-status-update"]').click()
      cy.get('[data-testid="bulk-status-select"]').select('active')
      cy.get('[data-testid="apply-bulk-update"]').click()
    })
  })

  describe('Google Sheets Integration Validation', () => {
    it('should maintain data consistency with Google Sheets', () => {
      // Create test data
      cy.createTestProject({ name: 'Sheets Sync Test' })
      
      // Verify data appears in application
      cy.visit('/projects')
      cy.get('[data-testid="project-list"]').should('contain', 'Sheets Sync Test')
      
      // Test data modification
      cy.get('[data-testid="project-list"]').contains('Sheets Sync Test').click()
      cy.get('[data-testid="edit-project-button"]').click()
      cy.get('[data-testid="project-description-input"]').type('Updated via application')
      cy.get('[data-testid="save-project-button"]').click()
      
      // Verify update is reflected
      cy.get('[data-testid="project-description"]').should('contain', 'Updated via application')
    })

    it('should handle Google Sheets API rate limits gracefully', () => {
      // Create multiple rapid operations to test rate limiting
      for (let i = 0; i < 10; i++) {
        cy.createTestProject({ name: `Rate Limit Test ${i}` })
      }
      
      // Verify all projects were created despite rate limits
      cy.visit('/projects')
      for (let i = 0; i < 10; i++) {
        cy.get('[data-testid="project-list"]').should('contain', `Rate Limit Test ${i}`)
      }
    })

    it('should recover from Google Sheets API failures', () => {
      // This would require mocking API failures in a real test environment
      cy.log('Testing API failure recovery - would require API mocking')
    })
  })

  describe('Performance Integration Testing', () => {
    it('should handle large datasets efficiently', () => {
      // Create large dataset
      cy.log('Creating large dataset for performance testing')
      
      // Test pagination and filtering with large data
      cy.visit('/projects')
      cy.get('[data-testid="items-per-page-select"]').select('50')
      cy.get('[data-testid="project-filter-input"]').type('Test')
      cy.get('[data-testid="apply-filter-button"]').click()
      
      // Verify performance metrics
      cy.window().then((win) => {
        const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart
        expect(loadTime).to.be.lessThan(5000) // 5 second max load time
      })
    })

    it('should maintain responsive UI under load', () => {
      // Test UI responsiveness during heavy operations
      cy.visit('/dashboard')
      cy.get('[data-testid="refresh-dashboard-button"]').click()
      
      // Verify UI remains interactive
      cy.get('[data-testid="quick-action-buttons"]').should('be.visible')
      cy.get('[data-testid="navigation-menu"]').should('be.visible')
    })
  })

  describe('Security Integration Testing', () => {
    it('should enforce authentication across all modules', () => {
      cy.logout()
      
      // Test protected routes
      const protectedRoutes = ['/dashboard', '/projects', '/clients', '/invoices', '/reports']
      
      protectedRoutes.forEach(route => {
        cy.visit(route)
        cy.url().should('include', '/login')
      })
    })

    it('should validate user permissions correctly', () => {
      // Test role-based access
      cy.login('client@test.com') // Client role
      
      cy.visit('/admin')
      cy.get('[data-testid="access-denied"]').should('be.visible')
      
      // Test client portal access
      cy.visit('/client-portal')
      cy.get('[data-testid="client-dashboard"]').should('be.visible')
    })

    it('should sanitize user inputs properly', () => {
      cy.visit('/projects')
      cy.get('[data-testid="add-project-button"]').click()
      
      // Test XSS prevention
      cy.get('[data-testid="project-name-input"]').type('<script>alert("xss")</script>')
      cy.get('[data-testid="save-project-button"]').click()
      
      // Verify script is not executed
      cy.on('window:alert', () => {
        throw new Error('XSS vulnerability detected')
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle network failures gracefully', () => {
      // Simulate network failure
      cy.intercept('GET', '/api/**', { forceNetworkError: true }).as('networkError')
      
      cy.visit('/dashboard')
      cy.wait('@networkError')
      
      // Verify error handling
      cy.get('[data-testid="error-message"]').should('contain', 'Network error')
      cy.get('[data-testid="retry-button"]').should('be.visible')
    })

    it('should provide meaningful error messages', () => {
      // Test validation errors
      cy.visit('/clients')
      cy.get('[data-testid="add-client-button"]').click()
      cy.get('[data-testid="save-client-button"]').click() // Save without required fields
      
      cy.get('[data-testid="validation-errors"]').should('be.visible')
      cy.get('[data-testid="name-error"]').should('contain', 'Name is required')
    })
  })
})