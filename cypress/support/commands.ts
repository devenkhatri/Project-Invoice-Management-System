// Authentication commands
Cypress.Commands.add('login', (email = Cypress.env('testUser').email, password = Cypress.env('testUser').password) => {
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type(email)
  cy.get('[data-testid="password-input"]').type(password)
  cy.get('[data-testid="login-button"]').click()
  cy.url().should('not.include', '/login')
  cy.get('[data-testid="dashboard"]').should('be.visible')
})

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('include', '/login')
})

// Test data creation commands
Cypress.Commands.add('createTestProject', (projectData = {}) => {
  const defaultProject = {
    name: 'Test Project',
    description: 'Test project description',
    clientId: '1',
    budget: 10000,
    deadline: '2024-12-31',
    status: 'active'
  }
  
  const project = { ...defaultProject, ...projectData }
  
  cy.visit('/projects')
  cy.get('[data-testid="create-project-button"]').click()
  cy.get('[data-testid="project-name-input"]').type(project.name)
  cy.get('[data-testid="project-description-input"]').type(project.description)
  cy.get('[data-testid="project-budget-input"]').type(project.budget.toString())
  cy.get('[data-testid="project-deadline-input"]').type(project.deadline)
  cy.get('[data-testid="save-project-button"]').click()
  cy.get('[data-testid="project-list"]').should('contain', project.name)
})

Cypress.Commands.add('createTestClient', (clientData = {}) => {
  const defaultClient = {
    name: 'Test Client',
    email: 'client@test.com',
    phone: '+91-9876543210',
    address: 'Test Address, Mumbai, Maharashtra',
    gstin: '27ABCDE1234F1Z5'
  }
  
  const client = { ...defaultClient, ...clientData }
  
  cy.visit('/clients')
  cy.get('[data-testid="create-client-button"]').click()
  cy.get('[data-testid="client-name-input"]').type(client.name)
  cy.get('[data-testid="client-email-input"]').type(client.email)
  cy.get('[data-testid="client-phone-input"]').type(client.phone)
  cy.get('[data-testid="client-address-input"]').type(client.address)
  cy.get('[data-testid="client-gstin-input"]').type(client.gstin)
  cy.get('[data-testid="save-client-button"]').click()
  cy.get('[data-testid="client-list"]').should('contain', client.name)
})

Cypress.Commands.add('createTestInvoice', (invoiceData = {}) => {
  const defaultInvoice = {
    clientId: '1',
    projectId: '1',
    amount: 50000,
    dueDate: '2024-02-28'
  }
  
  const invoice = { ...defaultInvoice, ...invoiceData }
  
  cy.visit('/invoices')
  cy.get('[data-testid="create-invoice-button"]').click()
  cy.get('[data-testid="invoice-client-select"]').select(invoice.clientId)
  cy.get('[data-testid="invoice-project-select"]').select(invoice.projectId)
  cy.get('[data-testid="invoice-amount-input"]').type(invoice.amount.toString())
  cy.get('[data-testid="invoice-due-date-input"]').type(invoice.dueDate)
  cy.get('[data-testid="save-invoice-button"]').click()
  cy.get('[data-testid="invoice-list"]').should('contain', invoice.amount.toString())
})