import { test, expect } from '@playwright/test'

test.describe('Cross-Browser Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load homepage correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Project Invoice Management/)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('should handle login flow', async ({ page }) => {
    await page.click('[data-testid="login-button"]')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="submit-button"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('should be responsive on different screen sizes', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible()
  })

  test('should handle form interactions', async ({ page }) => {
    await page.goto('/projects/new')
    
    // Fill form
    await page.fill('[data-testid="project-name-input"]', 'Test Project')
    await page.fill('[data-testid="project-description-input"]', 'Test Description')
    await page.selectOption('[data-testid="project-status-select"]', 'active')
    
    // Submit form
    await page.click('[data-testid="save-project-button"]')
    
    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('should handle keyboard navigation', async ({ page }) => {
    // Tab through navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'dashboard-link')
    
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'projects-link')
    
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'clients-link')
  })

  test('should handle drag and drop (Kanban board)', async ({ page }) => {
    await page.goto('/projects/1/kanban')
    
    const taskCard = page.locator('[data-testid="task-card-1"]')
    const todoColumn = page.locator('[data-testid="todo-column"]')
    const inProgressColumn = page.locator('[data-testid="in-progress-column"]')
    
    // Drag task from todo to in-progress
    await taskCard.dragTo(inProgressColumn)
    
    // Verify task moved
    await expect(inProgressColumn.locator('[data-testid="task-card-1"]')).toBeVisible()
  })

  test('should handle file uploads', async ({ page }) => {
    await page.goto('/projects/1/files')
    
    // Create a test file
    const fileContent = 'Test file content'
    const fileName = 'test-file.txt'
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]')
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent)
    })
    
    await page.click('[data-testid="upload-button"]')
    
    // Verify file uploaded
    await expect(page.locator(`[data-testid="file-${fileName}"]`)).toBeVisible()
  })

  test('should handle date picker interactions', async ({ page }) => {
    await page.goto('/invoices/new')
    
    // Open date picker
    await page.click('[data-testid="due-date-input"]')
    
    // Select date
    await page.click('[data-testid="date-picker-day-15"]')
    
    // Verify date selected
    await expect(page.locator('[data-testid="due-date-input"]')).toHaveValue(/15/)
  })

  test('should handle modal dialogs', async ({ page }) => {
    await page.goto('/projects')
    
    // Open delete confirmation modal
    await page.click('[data-testid="delete-project-button"]')
    
    // Verify modal is visible
    await expect(page.locator('[data-testid="confirmation-modal"]')).toBeVisible()
    
    // Close modal with escape key
    await page.keyboard.press('Escape')
    
    // Verify modal is closed
    await expect(page.locator('[data-testid="confirmation-modal"]')).not.toBeVisible()
  })

  test('should handle data table interactions', async ({ page }) => {
    await page.goto('/projects')
    
    // Test sorting
    await page.click('[data-testid="sort-by-name"]')
    await expect(page.locator('[data-testid="sort-indicator"]')).toHaveClass(/asc/)
    
    // Test filtering
    await page.fill('[data-testid="search-input"]', 'Test Project')
    await expect(page.locator('[data-testid="project-row"]')).toHaveCount(1)
    
    // Test pagination
    await page.click('[data-testid="next-page-button"]')
    await expect(page.locator('[data-testid="page-indicator"]')).toContainText('2')
  })

  test('should handle print functionality', async ({ page }) => {
    await page.goto('/invoices/1')
    
    // Mock print dialog
    let printTriggered = false
    await page.exposeFunction('mockPrint', () => {
      printTriggered = true
    })
    
    await page.addInitScript(() => {
      window.print = () => (window as any).mockPrint()
    })
    
    // Trigger print
    await page.click('[data-testid="print-invoice-button"]')
    
    // Verify print was triggered
    expect(printTriggered).toBe(true)
  })
})

test.describe('Performance Tests', () => {
  test('should load pages within acceptable time limits', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/dashboard')
    const loadTime = Date.now() - startTime
    
    expect(loadTime).toBeLessThan(3000) // 3 seconds
  })

  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/projects')
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="project-list"]')
    
    // Measure scroll performance
    const startTime = Date.now()
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    const scrollTime = Date.now() - startTime
    
    expect(scrollTime).toBeLessThan(100) // 100ms for smooth scrolling
  })
})

test.describe('Accessibility Tests', () => {
  test('should have proper focus management', async ({ page }) => {
    await page.goto('/')
    
    // Tab through focusable elements
    const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all()
    
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab')
      const focused = await page.locator(':focus').first()
      await expect(focused).toBeVisible()
    }
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check for ARIA landmarks
    await expect(page.locator('[role="main"]')).toBeVisible()
    await expect(page.locator('[role="navigation"]')).toBeVisible()
    
    // Check for ARIA labels on interactive elements
    const buttons = await page.locator('button').all()
    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label')
      const textContent = await button.textContent()
      expect(ariaLabel || textContent).toBeTruthy()
    }
  })
})