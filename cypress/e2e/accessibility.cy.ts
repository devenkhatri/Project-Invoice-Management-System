describe('Accessibility Compliance Tests', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.injectAxe()
  })

  it('should have no accessibility violations on homepage', () => {
    cy.checkA11y()
  })

  it('should have no accessibility violations on dashboard', () => {
    cy.login()
    cy.visit('/dashboard')
    cy.checkA11y()
  })

  it('should have no accessibility violations on project list', () => {
    cy.login()
    cy.visit('/projects')
    cy.checkA11y()
  })

  it('should have no accessibility violations on invoice form', () => {
    cy.login()
    cy.visit('/invoices/new')
    cy.checkA11y()
  })

  it('should have no accessibility violations on client portal', () => {
    cy.visit('/client-portal')
    cy.checkA11y()
  })

  it('should support keyboard navigation', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Test tab navigation
    cy.get('body').tab()
    cy.focused().should('be.visible')
    
    // Continue tabbing through focusable elements
    for (let i = 0; i < 10; i++) {
      cy.focused().tab()
      cy.focused().should('be.visible')
    }
  })

  it('should have proper heading hierarchy', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Check that headings follow proper hierarchy (h1 -> h2 -> h3, etc.)
    cy.get('h1, h2, h3, h4, h5, h6').then($headings => {
      let previousLevel = 0
      $headings.each((index, heading) => {
        const currentLevel = parseInt(heading.tagName.charAt(1))
        expect(currentLevel).to.be.at.most(previousLevel + 1)
        previousLevel = currentLevel
      })
    })
  })

  it('should have proper form labels', () => {
    cy.login()
    cy.visit('/invoices/new')
    
    // Check that all form inputs have associated labels
    cy.get('input, select, textarea').each($input => {
      const id = $input.attr('id')
      const ariaLabel = $input.attr('aria-label')
      const ariaLabelledBy = $input.attr('aria-labelledby')
      
      if (id) {
        cy.get(`label[for="${id}"]`).should('exist')
      } else {
        expect(ariaLabel || ariaLabelledBy).to.exist
      }
    })
  })

  it('should have sufficient color contrast', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Check color contrast compliance
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    })
  })

  it('should have proper ARIA landmarks', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Check for essential landmarks
    cy.get('[role="main"], main').should('exist')
    cy.get('[role="navigation"], nav').should('exist')
    cy.get('[role="banner"], header').should('exist')
  })

  it('should have descriptive link text', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Check that links have descriptive text
    cy.get('a').each($link => {
      const linkText = $link.text().trim()
      const ariaLabel = $link.attr('aria-label')
      const title = $link.attr('title')
      
      const accessibleName = ariaLabel || linkText || title
      expect(accessibleName).to.have.length.greaterThan(3)
      
      // Avoid generic link text
      const genericTexts = ['click here', 'read more', 'link', 'here']
      expect(genericTexts).to.not.include(accessibleName.toLowerCase())
    })
  })

  it('should support screen readers with proper ARIA attributes', () => {
    cy.login()
    cy.visit('/projects')
    
    // Check for ARIA live regions for dynamic content
    cy.get('[aria-live], [role="status"], [role="alert"]').should('exist')
    
    // Check for proper button descriptions
    cy.get('button').each($button => {
      const ariaLabel = $button.attr('aria-label')
      const textContent = $button.text().trim()
      const title = $button.attr('title')
      
      expect(ariaLabel || textContent || title).to.exist
    })
  })

  it('should handle focus management in modals', () => {
    cy.login()
    cy.visit('/projects')
    
    // Open a modal
    cy.get('[data-testid="create-project-button"]').click()
    
    // Focus should be trapped within modal
    cy.get('[role="dialog"]').should('be.visible')
    cy.focused().should('be.within', '[role="dialog"]')
    
    // Escape key should close modal
    cy.get('body').type('{esc}')
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('should provide skip links for keyboard users', () => {
    cy.visit('/')
    
    // Tab to reveal skip links
    cy.get('body').tab()
    cy.get('[href="#main-content"], [href="#main"]').should('be.visible')
  })

  it('should have proper table accessibility', () => {
    cy.login()
    cy.visit('/projects')
    
    // Check for table headers and scope attributes
    cy.get('table').each($table => {
      cy.wrap($table).find('th').should('exist')
      cy.wrap($table).find('th').each($header => {
        expect($header.attr('scope')).to.be.oneOf(['col', 'row', 'colgroup', 'rowgroup'])
      })
    })
  })

  it('should support high contrast mode', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Simulate high contrast mode
    cy.get('body').invoke('attr', 'style', 'filter: contrast(200%)')
    
    // Check that content is still readable
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    })
  })

  it('should handle reduced motion preferences', () => {
    // Set reduced motion preference
    cy.window().then(win => {
      Object.defineProperty(win, 'matchMedia', {
        writable: true,
        value: cy.stub().returns({
          matches: true,
          media: '(prefers-reduced-motion: reduce)',
          onchange: null,
          addListener: cy.stub(),
          removeListener: cy.stub(),
          addEventListener: cy.stub(),
          removeEventListener: cy.stub(),
          dispatchEvent: cy.stub(),
        }),
      })
    })
    
    cy.login()
    cy.visit('/dashboard')
    
    // Verify animations are reduced or disabled
    cy.get('[data-testid="animated-element"]').should('have.css', 'animation-duration', '0s')
  })

  it('should be usable with voice control', () => {
    cy.login()
    cy.visit('/projects')
    
    // Check that interactive elements have accessible names for voice control
    cy.get('button, [role="button"]').each($element => {
      const accessibleName = $element.attr('aria-label') || 
                           $element.text().trim() || 
                           $element.attr('title')
      
      expect(accessibleName).to.exist
      expect(accessibleName).to.have.length.greaterThan(2)
    })
  })

  it('should support zoom up to 200% without horizontal scrolling', () => {
    cy.login()
    cy.visit('/dashboard')
    
    // Set zoom to 200%
    cy.get('body').invoke('attr', 'style', 'zoom: 2')
    
    // Check that horizontal scrolling is not required
    cy.window().then(win => {
      expect(win.document.body.scrollWidth).to.be.at.most(win.innerWidth)
    })
  })

  it('should provide error messages that are accessible', () => {
    cy.login()
    cy.visit('/invoices/new')
    
    // Trigger validation errors
    cy.get('[data-testid="save-invoice-button"]').click()
    
    // Check that error messages are properly associated with form fields
    cy.get('[role="alert"], .error-message').each($error => {
      const id = $error.attr('id')
      if (id) {
        cy.get(`[aria-describedby*="${id}"]`).should('exist')
      }
    })
  })
})