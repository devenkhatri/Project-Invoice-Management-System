describe('Cross-Browser Compatibility Tests', () => {
  const testBrowserFeatures = () => {
    // Test modern JavaScript features
    cy.window().then((win: any) => {
      expect(win.fetch).to.exist
      expect(win.Promise).to.exist
      expect(win.localStorage).to.exist
      expect(win.sessionStorage).to.exist
    })

    // Test CSS Grid and Flexbox support
    cy.get('[data-testid="dashboard-grid"]').should('have.css', 'display', 'grid')
    cy.get('[data-testid="navigation-flex"]').should('have.css', 'display', 'flex')

    // Test responsive design
    cy.viewport(1200, 800) // Desktop
    cy.get('[data-testid="sidebar"]').should('be.visible')
    
    cy.viewport(768, 1024) // Tablet
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible')
    
    cy.viewport(375, 667) // Mobile
    cy.get('[data-testid="mobile-navigation"]').should('exist')
  }

  beforeEach(() => {
    cy.login()
  })

  it('should work correctly in Chrome-based browsers', () => {
    cy.visit('/dashboard')
    testBrowserFeatures()
    
    // Test Chrome-specific features
    cy.window().then((win: any) => {
      if (win.chrome) {
        cy.log('Chrome-specific features detected')
        // Test Chrome DevTools API availability
        expect(win.chrome.runtime).to.exist
      }
    })

    // Test Chrome-specific CSS features
    cy.get('[data-testid="dashboard-container"]').should('have.css', 'display')
  })

  it('should work correctly in Firefox', () => {
    cy.visit('/dashboard')
    testBrowserFeatures()
    
    // Test Firefox-specific compatibility
    cy.window().then((win: any) => {
      expect(win.navigator.userAgent).to.exist
      if (win.InstallTrigger !== undefined) {
        cy.log('Firefox-specific features detected')
      }
    })

    // Test Firefox-specific form handling
    cy.visit('/projects')
    cy.get('[data-testid="add-project-button"]').click()
    cy.get('[data-testid="project-name-input"]').type('Firefox Test Project')
    cy.get('[data-testid="save-project-button"]').click()
  })

  it('should work correctly in Safari', () => {
    cy.visit('/dashboard')
    testBrowserFeatures()
    
    // Test Safari-specific compatibility
    cy.window().then((win: any) => {
      if (win.safari) {
        cy.log('Safari-specific features detected')
      }
      
      // Test Safari date handling
      const testDate = new Date('2024-01-01')
      expect(testDate.getFullYear()).to.equal(2024)
    })

    // Test Safari-specific CSS handling
    cy.get('[data-testid="dashboard-widgets"]').should('be.visible')
  })

  it('should work correctly in Edge', () => {
    cy.visit('/dashboard')
    testBrowserFeatures()
    
    // Test Edge-specific compatibility
    cy.window().then((win: any) => {
      const userAgent = win.navigator.userAgent
      if (userAgent.includes('Edg')) {
        cy.log('Edge browser detected')
      }
    })
  })

  it('should handle different viewport sizes correctly', () => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1366, height: 768, name: 'Desktop Standard' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 414, height: 896, name: 'Mobile Large' },
      { width: 375, height: 667, name: 'Mobile Standard' },
      { width: 320, height: 568, name: 'Mobile Small' }
    ]

    viewports.forEach((viewport) => {
      cy.viewport(viewport.width, viewport.height)
      cy.visit('/dashboard')
      cy.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`)
      
      // Test navigation visibility
      if (viewport.width >= 1024) {
        cy.get('[data-testid="sidebar"]').should('be.visible')
      } else {
        cy.get('[data-testid="mobile-menu-button"]').should('be.visible')
      }
      
      // Test content layout
      cy.get('[data-testid="main-content"]').should('be.visible')
      cy.get('[data-testid="dashboard-widgets"]').should('be.visible')
      
      // Test form responsiveness
      cy.visit('/projects')
      cy.get('[data-testid="add-project-button"]').click()
      cy.get('[data-testid="project-form"]').should('be.visible')
      
      if (viewport.width < 768) {
        // Mobile-specific form layout
        cy.get('[data-testid="project-form"]').should('have.class', 'mobile-form')
      }
    })
  })

  it('should handle browser-specific form validation', () => {
    cy.visit('/clients')
    cy.get('[data-testid="add-client-button"]').click()
    
    // Test HTML5 validation
    cy.get('[data-testid="client-email-input"]').type('invalid-email')
    cy.get('[data-testid="save-client-button"]').click()
    
    // Check for validation message (browser-specific)
    cy.get('[data-testid="client-email-input"]').then(($input) => {
      const input = $input[0] as HTMLInputElement
      expect(input.validity.valid).to.be.false
    })
  })

  it('should handle browser-specific date/time features', () => {
    cy.visit('/projects')
    cy.get('[data-testid="add-project-button"]').click()
    
    // Test date input support
    cy.get('[data-testid="project-deadline-input"]').should('have.attr', 'type', 'date')
    cy.get('[data-testid="project-deadline-input"]').type('2024-12-31')
    
    // Test time zone handling
    cy.window().then((win: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      cy.log(`Browser timezone: ${timeZone}`)
    })
  })

  it('should handle browser-specific storage features', () => {
    // Test localStorage
    cy.window().then((win: any) => {
      win.localStorage.setItem('test-key', 'test-value')
      expect(win.localStorage.getItem('test-key')).to.equal('test-value')
      win.localStorage.removeItem('test-key')
    })
    
    // Test sessionStorage
    cy.window().then((win: any) => {
      win.sessionStorage.setItem('session-key', 'session-value')
      expect(win.sessionStorage.getItem('session-key')).to.equal('session-value')
      win.sessionStorage.removeItem('session-key')
    })
    
    // Test IndexedDB availability
    cy.window().then((win: any) => {
      expect(win.indexedDB).to.exist
    })
  })

  it('should handle browser-specific network features', () => {
    // Test Fetch API
    cy.window().then((win: any) => {
      expect(win.fetch).to.exist
    })
    
    // Test WebSocket support
    cy.window().then((win: any) => {
      expect(win.WebSocket).to.exist
    })
    
    // Test Service Worker support
    cy.window().then((win: any) => {
      if ('serviceWorker' in win.navigator) {
        cy.log('Service Worker supported')
      }
    })
  })

  it('should handle browser-specific performance features', () => {
    cy.visit('/dashboard')
    
    // Test Performance API
    cy.window().then((win: any) => {
      expect(win.performance).to.exist
      expect(win.performance.now).to.exist
      
      const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart
      expect(loadTime).to.be.greaterThan(0)
    })
    
    // Test Intersection Observer
    cy.window().then((win: any) => {
      if (win.IntersectionObserver) {
        cy.log('Intersection Observer supported')
      }
    })
  })
})