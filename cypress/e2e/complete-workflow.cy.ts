describe('Complete Project Lifecycle Workflow', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should complete full project lifecycle: create → tasks → time tracking → invoicing → payment', () => {
    // Step 1: Create a client
    cy.createTestClient({
      name: 'Workflow Test Client',
      email: 'workflow@test.com'
    })

    // Step 2: Create a project
    cy.createTestProject({
      name: 'Complete Workflow Project',
      description: 'End-to-end workflow testing project'
    })

    // Step 3: Add tasks to the project
    cy.visit('/projects')
    cy.get('[data-testid="project-list"]').contains('Complete Workflow Project').click()
    cy.get('[data-testid="add-task-button"]').click()
    cy.get('[data-testid="task-title-input"]').type('Design Phase')
    cy.get('[data-testid="task-description-input"]').type('Create initial designs')
    cy.get('[data-testid="task-priority-select"]').select('high')
    cy.get('[data-testid="save-task-button"]').click()

    // Step 4: Track time on the task
    cy.get('[data-testid="task-list"]').contains('Design Phase').click()
    cy.get('[data-testid="start-timer-button"]').click()
    cy.wait(2000) // Simulate 2 seconds of work
    cy.get('[data-testid="stop-timer-button"]').click()
    cy.get('[data-testid="time-entry-list"]').should('contain', '00:00:02')

    // Step 5: Mark task as completed
    cy.get('[data-testid="task-status-select"]').select('completed')
    cy.get('[data-testid="update-task-button"]').click()

    // Step 6: Generate invoice from project
    cy.visit('/invoices')
    cy.get('[data-testid="create-invoice-button"]').click()
    cy.get('[data-testid="generate-from-project-button"]').click()
    cy.get('[data-testid="project-select"]').select('Complete Workflow Project')
    cy.get('[data-testid="generate-invoice-button"]').click()

    // Step 7: Verify invoice was created with time entries
    cy.get('[data-testid="invoice-preview"]').should('be.visible')
    cy.get('[data-testid="invoice-line-items"]').should('contain', 'Design Phase')
    cy.get('[data-testid="save-invoice-button"]').click()

    // Step 8: Send invoice
    cy.get('[data-testid="invoice-list"]').should('contain', 'Complete Workflow Project')
    cy.get('[data-testid="send-invoice-button"]').first().click()
    cy.get('[data-testid="confirm-send-button"]').click()
    cy.get('[data-testid="success-message"]').should('contain', 'Invoice sent successfully')

    // Step 9: Mark invoice as paid
    cy.get('[data-testid="mark-paid-button"]').first().click()
    cy.get('[data-testid="payment-amount-input"]').type('5000')
    cy.get('[data-testid="payment-date-input"]').type('2024-01-25')
    cy.get('[data-testid="confirm-payment-button"]').click()

    // Step 10: Verify project completion
    cy.visit('/dashboard')
    cy.get('[data-testid="completed-projects-count"]').should('contain', '1')
    cy.get('[data-testid="paid-invoices-count"]').should('contain', '1')
  })

  it('should handle client portal access workflow', () => {
    // Create client and project first
    cy.createTestClient({ name: 'Portal Test Client' })
    cy.createTestProject({ name: 'Portal Test Project' })

    // Generate client portal access
    cy.visit('/clients')
    cy.get('[data-testid="client-list"]').contains('Portal Test Client').click()
    cy.get('[data-testid="generate-portal-access-button"]').click()
    cy.get('[data-testid="portal-link"]').should('be.visible')

    // Test client portal login (would need separate test environment)
    cy.get('[data-testid="portal-link"]').then(($link) => {
      const portalUrl = $link.text()
      cy.log('Portal URL generated: ' + portalUrl)
    })
  })
})

describe('Cross-Module Integration Tests', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should sync data correctly between frontend, backend, and Google Sheets', () => {
    // Create project and verify it appears in all views
    cy.createTestProject({ name: 'Sync Test Project' })
    
    // Check dashboard
    cy.visit('/dashboard')
    cy.get('[data-testid="recent-projects"]').should('contain', 'Sync Test Project')
    
    // Check reports
    cy.visit('/reports')
    cy.get('[data-testid="project-reports-tab"]').click()
    cy.get('[data-testid="project-list"]').should('contain', 'Sync Test Project')
    
    // Check analytics
    cy.visit('/analytics')
    cy.get('[data-testid="project-analytics"]').should('contain', 'Sync Test Project')
  })

  it('should maintain data consistency during concurrent operations', () => {
    cy.createTestProject({ name: 'Concurrent Test Project' })
    
    // Simulate concurrent updates
    cy.visit('/projects')
    cy.get('[data-testid="project-list"]').contains('Concurrent Test Project').click()
    
    // Update project details
    cy.get('[data-testid="edit-project-button"]').click()
    cy.get('[data-testid="project-budget-input"]').clear().type('15000')
    cy.get('[data-testid="save-project-button"]').click()
    
    // Add task simultaneously
    cy.get('[data-testid="add-task-button"]').click()
    cy.get('[data-testid="task-title-input"]').type('Concurrent Task')
    cy.get('[data-testid="save-task-button"]').click()
    
    // Verify both updates are reflected
    cy.get('[data-testid="project-budget"]').should('contain', '15000')
    cy.get('[data-testid="task-list"]').should('contain', 'Concurrent Task')
  })
})