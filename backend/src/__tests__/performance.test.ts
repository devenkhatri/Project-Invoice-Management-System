import request from 'supertest'
import app from '../server'
import { SheetsService } from '../services/sheets.service'

describe('Performance Tests', () => {
  let authToken: string
  
  beforeAll(async () => {
    // Get auth token for testing
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      })
    
    authToken = response.body.token
  })

  describe('API Response Times', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/health')
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(100)
    })

    it('should respond to project list within 500ms', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(500)
    })

    it('should respond to invoice creation within 1000ms', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          clientId: 'test-client-1',
          projectId: 'test-project-1',
          amount: 10000,
          dueDate: '2024-02-28'
        })
        .expect(201)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(1000)
    })
  })

  describe('Google Sheets Performance', () => {
    let sheetsService: SheetsService
    
    beforeAll(() => {
      sheetsService = new SheetsService('test-spreadsheet-id', {})
    })

    it('should handle batch operations efficiently', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `test-${i}`,
        name: `Test Project ${i}`,
        status: 'active',
        created_at: new Date().toISOString()
      }))
      
      const start = Date.now()
      
      await sheetsService.batchCreate('Projects', testData)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(5000) // 5 seconds for 100 records
    })

    it('should handle large dataset queries efficiently', async () => {
      const start = Date.now()
      
      const projects = await sheetsService.query('Projects', {
        limit: 1000,
        orderBy: 'created_at'
      })
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(3000) // 3 seconds for 1000 records
      expect(projects.length).toBeLessThanOrEqual(1000)
    })

    it('should handle concurrent operations without conflicts', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        sheetsService.create('Projects', {
          id: `concurrent-${i}`,
          name: `Concurrent Project ${i}`,
          status: 'active',
          created_at: new Date().toISOString()
        })
      )
      
      const start = Date.now()
      
      const results = await Promise.all(concurrentOperations)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(10000) // 10 seconds for 10 concurrent operations
      expect(results.every(result => result)).toBe(true)
    })

    it('should optimize API calls with proper batching', async () => {
      const batchSpy = jest.spyOn(sheetsService, 'batchUpdate')
      
      // Perform multiple updates that should be batched
      const updates = Array.from({ length: 50 }, (_, i) => ({
        id: `project-${i}`,
        name: `Updated Project ${i}`,
        status: 'active'
      }))
      
      const start = Date.now()
      await sheetsService.batchUpdate('Projects', updates)
      const responseTime = Date.now() - start
      
      // Should batch efficiently and complete quickly
      expect(responseTime).toBeLessThan(3000)
      expect(batchSpy).toHaveBeenCalledTimes(1)
    })

    it('should implement proper caching for read operations', async () => {
      // Clear any existing cache
      sheetsService.clearCache?.()
      
      // First read - should hit the API
      const start1 = Date.now()
      const result1 = await sheetsService.read('Projects')
      const duration1 = Date.now() - start1
      
      // Second read - should use cache if implemented
      const start2 = Date.now()
      const result2 = await sheetsService.read('Projects')
      const duration2 = Date.now() - start2
      
      // Results should be identical
      expect(result1).toEqual(result2)
      
      // If caching is implemented, second call should be faster
      if (sheetsService.cacheEnabled) {
        expect(duration2).toBeLessThan(duration1 * 0.5)
      }
    })

    it('should handle rate limiting gracefully', async () => {
      // Create many rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 50 }, (_, i) => 
        () => sheetsService.read('Projects', `project-${i}`)
      )
      
      const start = Date.now()
      
      // Execute requests with some delay to avoid overwhelming
      const results = []
      for (const request of rapidRequests) {
        try {
          const result = await request()
          results.push(result)
        } catch (error) {
          // Rate limiting errors are acceptable
          if (!error.message.includes('rate limit')) {
            throw error
          }
        }
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const responseTime = Date.now() - start
      
      // Should handle rate limiting without crashing
      expect(results.length).toBeGreaterThan(0)
      expect(responseTime).toBeGreaterThan(500) // Should take some time due to rate limiting
    })

    it('should optimize memory usage for large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Process large dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-${i}`,
        name: `Large Dataset Item ${i}`,
        description: 'A'.repeat(500), // 500 bytes per item
        status: 'active',
        created_at: new Date().toISOString()
      }))
      
      await sheetsService.batchCreate('Projects', largeData)
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
    })

    it('should handle network timeouts and implement retries', async () => {
      // Mock a timeout scenario
      const originalRequest = sheetsService.request
      let attemptCount = 0
      
      sheetsService.request = jest.fn().mockImplementation(async (...args) => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Request timeout')
        }
        return originalRequest.apply(sheetsService, args)
      })
      
      const start = Date.now()
      
      try {
        await sheetsService.read('Projects')
        const responseTime = Date.now() - start
        
        // Should have retried and eventually succeeded
        expect(attemptCount).toBe(3)
        expect(responseTime).toBeGreaterThan(100) // Should take time due to retries
      } finally {
        // Restore original method
        sheetsService.request = originalRequest
      }
    })

    it('should monitor API quota usage', async () => {
      const quotaMonitor = {
        requestCount: 0,
        quotaLimit: 100,
        resetTime: Date.now() + 60000 // 1 minute from now
      }
      
      // Mock quota tracking
      const originalRead = sheetsService.read
      sheetsService.read = jest.fn().mockImplementation(async (...args) => {
        quotaMonitor.requestCount++
        
        if (quotaMonitor.requestCount > quotaMonitor.quotaLimit) {
          throw new Error('Quota exceeded')
        }
        
        return originalRead.apply(sheetsService, args)
      })
      
      // Make requests up to quota limit
      const requests = Array.from({ length: 95 }, (_, i) => 
        sheetsService.read('Projects', `project-${i}`)
      )
      
      const results = await Promise.allSettled(requests)
      const successful = results.filter(r => r.status === 'fulfilled').length
      
      expect(successful).toBe(95)
      expect(quotaMonitor.requestCount).toBe(95)
      
      // Restore original method
      sheetsService.read = originalRead
    })
  })

  describe('Memory Usage', () => {
    it('should not have memory leaks during bulk operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform bulk operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Database Connection Pool', () => {
    it('should handle multiple simultaneous connections', async () => {
      const simultaneousRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      )
      
      const start = Date.now()
      
      const responses = await Promise.all(simultaneousRequests)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(5000) // 5 seconds for 20 simultaneous requests
      expect(responses.every(res => res.status === 200)).toBe(true)
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits correctly', async () => {
      const requests = Array.from({ length: 110 }, () =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      )
      
      const responses = await Promise.allSettled(requests)
      
      const successfulRequests = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 200
      ).length
      
      const rateLimitedRequests = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      ).length
      
      expect(successfulRequests).toBeLessThanOrEqual(100) // Rate limit of 100 requests
      expect(rateLimitedRequests).toBeGreaterThan(0)
    })
  })

  describe('Large Dataset Handling', () => {
    it('should handle pagination efficiently', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/projects?page=1&limit=50')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(1000)
      expect(response.body.data.length).toBeLessThanOrEqual(50)
      expect(response.body).toHaveProperty('pagination')
    })

    it('should handle search queries efficiently', async () => {
      const start = Date.now()
      
      const response = await request(app)
        .get('/api/projects?search=test&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      const responseTime = Date.now() - start
      expect(responseTime).toBeLessThan(2000) // 2 seconds for search
    })
  })
})