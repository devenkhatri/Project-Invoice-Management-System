import React from 'react'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'

// Components to test
import Dashboard from '../components/dashboard/Dashboard'
import ProjectList from '../components/projects/ProjectList'
import InvoiceForm from '../components/invoices/InvoiceForm'
import ClientList from '../components/clients/ClientList'
import LoginForm from '../components/auth/LoginForm'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

const theme = createTheme()

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('Accessibility Tests', () => {
  describe('Dashboard Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithProviders(<Dashboard />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading hierarchy', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      
      // Check that headings follow proper hierarchy
      let previousLevel = 0
      headings.forEach((heading) => {
        const currentLevel = parseInt(heading.tagName.charAt(1))
        expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1)
        previousLevel = currentLevel
      })
    })

    it('should have proper ARIA labels for interactive elements', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const buttons = container.querySelectorAll('button')
      
      buttons.forEach((button) => {
        expect(
          button.getAttribute('aria-label') || 
          button.textContent || 
          button.getAttribute('title')
        ).toBeTruthy()
      })
    })
  })

  describe('Project List Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithProviders(<ProjectList />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper table accessibility', () => {
      const { container } = renderWithProviders(<ProjectList />)
      const tables = container.querySelectorAll('table')
      
      tables.forEach((table) => {
        // Check for table headers
        const headers = table.querySelectorAll('th')
        expect(headers.length).toBeGreaterThan(0)
        
        // Check for proper scope attributes
        headers.forEach((header) => {
          expect(['col', 'row', 'colgroup', 'rowgroup']).toContain(
            header.getAttribute('scope')
          )
        })
      })
    })

    it('should support keyboard navigation', () => {
      const { container } = renderWithProviders(<ProjectList />)
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      focusableElements.forEach((element) => {
        expect(element.getAttribute('tabindex')).not.toBe('-1')
      })
    })
  })

  describe('Invoice Form Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithProviders(<InvoiceForm />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      const { container } = renderWithProviders(<InvoiceForm />)
      const inputs = container.querySelectorAll('input, select, textarea')
      
      inputs.forEach((input) => {
        const id = input.getAttribute('id')
        const ariaLabel = input.getAttribute('aria-label')
        const ariaLabelledBy = input.getAttribute('aria-labelledby')
        const label = id ? container.querySelector(`label[for="${id}"]`) : null
        
        expect(label || ariaLabel || ariaLabelledBy).toBeTruthy()
      })
    })

    it('should have proper error message associations', () => {
      const { container } = renderWithProviders(<InvoiceForm />)
      const errorMessages = container.querySelectorAll('[role="alert"], .error-message')
      
      errorMessages.forEach((error) => {
        const id = error.getAttribute('id')
        if (id) {
          const associatedInput = container.querySelector(`[aria-describedby*="${id}"]`)
          expect(associatedInput).toBeTruthy()
        }
      })
    })
  })

  describe('Client List Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithProviders(<ClientList />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper list semantics', () => {
      const { container } = renderWithProviders(<ClientList />)
      const lists = container.querySelectorAll('ul, ol')
      
      lists.forEach((list) => {
        const listItems = list.querySelectorAll('li')
        expect(listItems.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Login Form Component', () => {
    it('should not have accessibility violations', async () => {
      const { container } = renderWithProviders(<LoginForm />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper password field accessibility', () => {
      const { container } = renderWithProviders(<LoginForm />)
      const passwordField = container.querySelector('input[type="password"]')
      
      if (passwordField) {
        expect(passwordField.getAttribute('autocomplete')).toBe('current-password')
        expect(passwordField.getAttribute('aria-label') || 
               passwordField.getAttribute('aria-labelledby')).toBeTruthy()
      }
    })
  })

  describe('Color Contrast', () => {
    it('should meet WCAG AA color contrast requirements', async () => {
      const { container } = renderWithProviders(<Dashboard />)
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      expect(results).toHaveNoViolations()
    })
  })

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      focusableElements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element, ':focus')
        expect(
          computedStyle.outline !== 'none' || 
          computedStyle.boxShadow !== 'none' ||
          computedStyle.border !== 'none'
        ).toBeTruthy()
      })
    })

    it('should have logical tab order', () => {
      const { container } = renderWithProviders(<InvoiceForm />)
      const focusableElements = Array.from(container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ))
      
      const tabIndexes = focusableElements.map(el => 
        parseInt(el.getAttribute('tabindex') || '0')
      )
      
      // Check that custom tab indexes are in logical order
      const customTabIndexes = tabIndexes.filter(index => index > 0)
      const sortedCustomIndexes = [...customTabIndexes].sort((a, b) => a - b)
      expect(customTabIndexes).toEqual(sortedCustomIndexes)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA landmarks', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const landmarks = container.querySelectorAll(
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer'
      )
      expect(landmarks.length).toBeGreaterThan(0)
    })

    it('should have proper ARIA live regions for dynamic content', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const liveRegions = container.querySelectorAll(
        '[aria-live], [role="status"], [role="alert"]'
      )
      
      liveRegions.forEach((region) => {
        const ariaLive = region.getAttribute('aria-live')
        if (ariaLive) {
          expect(['polite', 'assertive', 'off']).toContain(ariaLive)
        }
      })
    })

    it('should have descriptive link text', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const links = container.querySelectorAll('a')
      
      links.forEach((link) => {
        const linkText = link.textContent?.trim()
        const ariaLabel = link.getAttribute('aria-label')
        const title = link.getAttribute('title')
        
        const accessibleName = ariaLabel || linkText || title
        expect(accessibleName).toBeTruthy()
        expect(accessibleName?.length).toBeGreaterThan(3)
        
        // Avoid generic link text
        const genericTexts = ['click here', 'read more', 'link', 'here']
        expect(genericTexts).not.toContain(accessibleName?.toLowerCase())
      })
    })
  })

  describe('Mobile Accessibility', () => {
    it('should have proper touch target sizes', () => {
      const { container } = renderWithProviders(<Dashboard />)
      const touchTargets = container.querySelectorAll('button, a, input[type="checkbox"], input[type="radio"]')
      
      touchTargets.forEach((target) => {
        const rect = target.getBoundingClientRect()
        // WCAG recommends minimum 44x44 pixels for touch targets
        expect(rect.width >= 44 || rect.height >= 44).toBeTruthy()
      })
    })

    it('should support zoom up to 200% without horizontal scrolling', () => {
      // This would typically be tested with actual browser automation
      // For unit tests, we can check that elements use relative units
      const { container } = renderWithProviders(<Dashboard />)
      const elements = container.querySelectorAll('*')
      
      elements.forEach((element) => {
        const computedStyle = window.getComputedStyle(element)
        const fontSize = computedStyle.fontSize
        
        // Check that font sizes use relative units (em, rem, %) rather than px
        if (fontSize && fontSize !== 'inherit') {
          expect(fontSize).toMatch(/(em|rem|%|vw|vh)$/)
        }
      })
    })
  })
})