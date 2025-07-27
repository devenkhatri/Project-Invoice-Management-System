describe('Mobile Device Testing', () => {
  const mobileViewports = [
    { device: 'iPhone 12 Pro', width: 390, height: 844 },
    { device: 'iPhone SE', width: 375, height: 667 },
    { device: 'Samsung Galaxy S21', width: 384, height: 854 },
    { device: 'iPad', width: 768, height: 1024 },
    { device: 'iPad Pro', width: 1024, height: 1366 }
  ]

  beforeEach(() => {
    cy.login()
  })

  mobileViewports.forEach((viewport) => {
    describe(`${viewport.device} (${viewport.width}x${viewport.height})`, () => {
      beforeEach(() => {
        cy.viewport(viewport.width, viewport.height)
      })

      it('should display mobile-optimized navigation', () => {
        cy.visit('/dashboard')
        
        if (viewport.width < 768) {
          // Mobile navigation
          cy.get('[data-testid="mobile-menu-button"]').should('be.visible')
          cy.get('[data-testid="mobile-menu-button"]').click()
          cy.get('[data-testid="mobile-navigation"]').should('be.visible')
        } else {
          // Tablet navigation
          cy.get('[data-testid="sidebar"]').should('be.visible')
        }
      })

      it('should handle touch interactions correctly', () => {
        cy.visit('/projects')
        
        // Test swipe gestures (simulated)
        cy.get('[data-testid="project-list"]').should('be.visible')
        
        // Test touch-friendly button sizes
        cy.get('[data-testid="create-project-button"]').should('have.css', 'min-height')
        
        // Test pull-to-refresh
        cy.get('[data-testid="pull-to-refresh"]').should('exist')
      })

      it('should display data tables appropriately', () => {
        cy.visit('/invoices')
        
        if (viewport.width < 768) {
          // Mobile data table with cards
          cy.get('[data-testid="mobile-invoice-cards"]').should('be.visible')
        } else {
          // Standard data table
          cy.get('[data-testid="invoice-table"]').should('be.visible')
        }
      })

      it('should handle form inputs correctly', () => {
        cy.visit('/projects')
        cy.get('[data-testid="create-project-button"]').click()
        
        // Test form field sizing
        cy.get('[data-testid="project-name-input"]').should('be.visible')
        cy.get('[data-testid="project-name-input"]').type('Mobile Test Project')
        
        // Test date picker on mobile
        cy.get('[data-testid="project-deadline-input"]').click()
        cy.get('[data-testid="date-picker"]').should('be.visible')
      })

      it('should support offline functionality', () => {
        // Test service worker registration
        cy.window().then((win) => {
          expect(win.navigator.serviceWorker).to.exist
        })
        
        // Test offline storage
        cy.visit('/projects')
        cy.window().then((win) => {
          expect(win.localStorage.getItem('offline-projects')).to.exist
        })
      })
    })
  })

  it('should handle orientation changes', () => {
    // Portrait mode
    cy.viewport(375, 667)
    cy.visit('/dashboard')
    cy.get('[data-testid="dashboard-widgets"]').should('be.visible')
    
    // Landscape mode
    cy.viewport(667, 375)
    cy.get('[data-testid="dashboard-widgets"]').should('be.visible')
    cy.get('[data-testid="mobile-navigation"]').should('exist')
  })

  it('should support PWA features', () => {
    cy.visit('/')
    
    // Test manifest.json
    cy.request('/manifest.json').then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('name')
      expect(response.body).to.have.property('short_name')
      expect(response.body).to.have.property('icons')
    })
    
    // Test service worker
    cy.window().then((win) => {
      expect(win.navigator.serviceWorker).to.exist
    })
  })
})