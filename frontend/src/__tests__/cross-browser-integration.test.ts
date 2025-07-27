import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { chromium, firefox, webkit, Browser, Page } from 'playwright';

describe('Cross-Browser Integration Tests', () => {
  let browsers: { name: string; browser: Browser }[] = [];
  const baseUrl = process.env.REACT_APP_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Launch all browsers
    const browserConfigs = [
      { name: 'Chromium', launcher: chromium },
      { name: 'Firefox', launcher: firefox },
      { name: 'WebKit', launcher: webkit }
    ];

    for (const config of browserConfigs) {
      try {
        const browser = await config.launcher.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        browsers.push({ name: config.name, browser });
      } catch (error) {
        console.warn(`Failed to launch ${config.name}:`, error);
      }
    }
  });

  afterAll(async () => {
    // Close all browsers
    await Promise.all(browsers.map(({ browser }) => browser.close()));
  });

  describe('Authentication Flow', () => {
    it('should work across all browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          await page.goto(`${baseUrl}/login`);
          
          // Wait for login form to load
          await page.waitForSelector('form', { timeout: 10000 });
          
          // Fill login form
          await page.fill('input[type="email"]', 'test@example.com');
          await page.fill('input[type="password"]', 'testpassword');
          
          // Submit form
          await page.click('button[type="submit"]');
          
          // Wait for redirect to dashboard
          await page.waitForURL('**/dashboard', { timeout: 10000 });
          
          // Verify dashboard loaded
          const dashboardTitle = await page.textContent('h1');
          expect(dashboardTitle).toContain('Dashboard');
          
          console.log(`✓ Authentication flow works in ${name}`);
        } catch (error) {
          console.error(`✗ Authentication flow failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  describe('Project Management Interface', () => {
    it('should display and interact with projects across browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          // Login first
          await loginUser(page);
          
          // Navigate to projects
          await page.goto(`${baseUrl}/projects`);
          await page.waitForSelector('[data-testid="projects-list"]', { timeout: 10000 });
          
          // Test project creation
          await page.click('[data-testid="create-project-btn"]');
          await page.waitForSelector('[data-testid="project-form"]');
          
          await page.fill('input[name="name"]', `Test Project ${name}`);
          await page.fill('textarea[name="description"]', 'Cross-browser test project');
          await page.selectOption('select[name="status"]', 'active');
          
          await page.click('button[type="submit"]');
          
          // Verify project was created
          await page.waitForSelector(`text=Test Project ${name}`, { timeout: 5000 });
          
          console.log(`✓ Project management works in ${name}`);
        } catch (error) {
          console.error(`✗ Project management failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  describe('Invoice Generation', () => {
    it('should generate invoices across browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          await loginUser(page);
          
          // Navigate to invoices
          await page.goto(`${baseUrl}/invoices`);
          await page.waitForSelector('[data-testid="invoices-list"]', { timeout: 10000 });
          
          // Create new invoice
          await page.click('[data-testid="create-invoice-btn"]');
          await page.waitForSelector('[data-testid="invoice-form"]');
          
          // Fill invoice form
          await page.selectOption('select[name="client_id"]', { index: 1 });
          await page.fill('input[name="line_items[0].description"]', 'Test Service');
          await page.fill('input[name="line_items[0].quantity"]', '1');
          await page.fill('input[name="line_items[0].rate"]', '1000');
          
          await page.click('button[type="submit"]');
          
          // Verify invoice was created
          await page.waitForSelector('[data-testid="invoice-preview"]', { timeout: 5000 });
          
          console.log(`✓ Invoice generation works in ${name}`);
        } catch (error) {
          console.error(`✗ Invoice generation failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should work on mobile viewports across browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          // Set mobile viewport
          await page.setViewportSize({ width: 375, height: 667 });
          
          await loginUser(page);
          
          // Test mobile navigation
          await page.goto(`${baseUrl}/dashboard`);
          
          // Check if mobile menu button exists
          const mobileMenuBtn = await page.locator('[data-testid="mobile-menu-btn"]');
          if (await mobileMenuBtn.isVisible()) {
            await mobileMenuBtn.click();
            
            // Verify mobile menu opened
            await page.waitForSelector('[data-testid="mobile-menu"]', { state: 'visible' });
          }
          
          // Test responsive layout
          const mainContent = await page.locator('main');
          const boundingBox = await mainContent.boundingBox();
          
          expect(boundingBox?.width).toBeLessThanOrEqual(375);
          
          console.log(`✓ Mobile responsiveness works in ${name}`);
        } catch (error) {
          console.error(`✗ Mobile responsiveness failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should load pages within acceptable time across browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          await loginUser(page);
          
          const pages = ['/dashboard', '/projects', '/invoices', '/clients'];
          
          for (const pagePath of pages) {
            const startTime = Date.now();
            
            await page.goto(`${baseUrl}${pagePath}`);
            await page.waitForLoadState('networkidle');
            
            const loadTime = Date.now() - startTime;
            
            // Page should load within 3 seconds
            expect(loadTime).toBeLessThan(3000);
            
            console.log(`✓ ${pagePath} loaded in ${loadTime}ms in ${name}`);
          }
        } catch (error) {
          console.error(`✗ Performance test failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  describe('Accessibility Tests', () => {
    it('should meet accessibility standards across browsers', async () => {
      for (const { name, browser } of browsers) {
        const page = await browser.newPage();
        
        try {
          await loginUser(page);
          
          // Test keyboard navigation
          await page.goto(`${baseUrl}/dashboard`);
          
          // Tab through interactive elements
          await page.keyboard.press('Tab');
          const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
          expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
          
          // Test ARIA labels
          const buttons = await page.locator('button').all();
          for (const button of buttons) {
            const ariaLabel = await button.getAttribute('aria-label');
            const textContent = await button.textContent();
            
            // Button should have either aria-label or text content
            expect(ariaLabel || textContent?.trim()).toBeTruthy();
          }
          
          console.log(`✓ Accessibility standards met in ${name}`);
        } catch (error) {
          console.error(`✗ Accessibility test failed in ${name}:`, error);
          throw error;
        } finally {
          await page.close();
        }
      }
    });
  });

  // Helper function to login user
  async function loginUser(page: Page) {
    await page.goto(`${baseUrl}/login`);
    await page.waitForSelector('form');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard');
  }
});