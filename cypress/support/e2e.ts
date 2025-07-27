// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests from command log
Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'error').as('consoleError')
  cy.stub(win.console, 'warn').as('consoleWarn')
})

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  return true
})

// Custom commands for authentication
declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      createTestProject(projectData?: any): Chainable<void>
      createTestClient(clientData?: any): Chainable<void>
      createTestInvoice(invoiceData?: any): Chainable<void>
    }
  }
}