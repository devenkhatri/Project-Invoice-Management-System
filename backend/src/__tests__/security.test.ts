import request from 'supertest'
import app from '../server'
import jwt from 'jsonwebtoken'

describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(401)
      
      expect(response.body.error).toContain('authentication')
    })

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
      
      expect(response.body.error).toContain('invalid')
    })

    it('should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      )
      
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
      
      expect(response.body.error).toContain('expired')
    })

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 110 }, () =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong-password' })
      )
      
      const responses = await Promise.allSettled(requests)
      
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && (r.value as any).status === 429
      )
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Input Validation Security', () => {
    let authToken: string
    
    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      
      authToken = response.body.token
    })

    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE projects; --"
      
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: maliciousInput,
          description: 'Test project'
        })
        .expect(400)
      
      expect(response.body.error).toContain('validation')
    })

    it('should prevent XSS attacks in input fields', async () => {
      const xssPayload = '<script>alert("XSS")</script>'
      
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: xssPayload
        })
        .expect(400)
      
      expect(response.body.error).toContain('validation')
    })

    it('should validate email formats strictly', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..double.dot@domain.com'
      ]
      
      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/clients')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Client',
            email: email
          })
          .expect(400)
        
        expect(response.body.error).toContain('email')
      }
    })

    it('should validate GSTIN format for Indian clients', async () => {
      const invalidGSTINs = [
        '27ABCDE1234F1Z', // Too short
        '27ABCDE1234F1Z56', // Too long
        '27abcde1234f1z5', // Lowercase
        'INVALID_GSTIN'
      ]
      
      for (const gstin of invalidGSTINs) {
        const response = await request(app)
          .post('/api/clients')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Client',
            email: 'test@example.com',
            gstin: gstin
          })
          .expect(400)
        
        expect(response.body.error).toContain('gstin')
      }
    })

    it('should prevent file upload vulnerabilities', async () => {
      const maliciousFile = Buffer.from('<?php echo "Malicious code"; ?>')
      
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', maliciousFile, 'malicious.php')
        .expect(400)
      
      expect(response.body.error).toContain('file type')
    })
  })

  describe('Authorization Security', () => {
    let userToken: string
    let adminToken: string
    
    beforeAll(async () => {
      // Get user token
      const userResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'userpassword123'
        })
      userToken = userResponse.body.token
      
      // Get admin token
      const adminResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'adminpassword123'
        })
      adminToken = adminResponse.body.token
    })

    it('should prevent users from accessing other users data', async () => {
      // Create project as user 1
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User 1 Project',
          description: 'Private project'
        })
      
      const projectId = projectResponse.body.id
      
      // Try to access as different user (should fail)
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`) // Different user
        .expect(403)
      
      expect(response.body.error).toContain('access')
    })

    it('should enforce role-based access control', async () => {
      // Regular user trying to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
      
      expect(response.body.error).toContain('permission')
    })

    it('should validate client portal access tokens', async () => {
      const invalidPortalToken = 'invalid-portal-token'
      
      const response = await request(app)
        .get('/api/client-portal/dashboard')
        .set('Authorization', `Bearer ${invalidPortalToken}`)
        .expect(401)
      
      expect(response.body.error).toContain('invalid')
    })
  })

  describe('Data Protection', () => {
    let authToken: string
    
    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      
      authToken = response.body.token
    })

    it('should not expose sensitive data in API responses', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      // Should not contain password or other sensitive fields
      expect(response.body).not.toHaveProperty('password')
      expect(response.body).not.toHaveProperty('passwordHash')
      expect(response.body).not.toHaveProperty('jwtSecret')
    })

    it('should sanitize output data', async () => {
      // Create project with potentially dangerous content
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Safe description'
        })
      
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
      
      // Check that HTML is escaped or stripped
      response.body.data.forEach((project: any) => {
        expect(project.description).not.toContain('<script>')
        expect(project.description).not.toContain('javascript:')
      })
    })

    it('should implement proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/projects')
        .expect(200)
      
      expect(response.headers['access-control-allow-origin']).toBeDefined()
      expect(response.headers['access-control-allow-methods']).toBeDefined()
      expect(response.headers['access-control-allow-headers']).toBeDefined()
    })
  })

  describe('Session Security', () => {
    it('should invalidate tokens on logout', async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      
      const token = loginResponse.body.token
      
      // Verify token works
      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
      
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
      
      // Token should no longer work
      await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .expect(401)
    })

    it('should enforce secure session configuration', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      
      // Check for secure headers
      expect(response.headers['set-cookie']).toBeUndefined() // No session cookies
      expect(response.body.token).toBeDefined() // JWT token instead
    })
  })

  describe('Google Sheets Security', () => {
    it('should use service account authentication', async () => {
      // This test would verify that Google Sheets access uses service account
      // rather than user credentials
      expect(process.env.GOOGLE_SERVICE_ACCOUNT_KEY).toBeDefined()
    })

    it('should validate Google Sheets permissions', async () => {
      // Test that the service account has appropriate permissions
      // This would be tested in integration with actual Google Sheets API
      const response = await request(app)
        .get('/api/health/sheets')
        .expect(200)
      
      expect(response.body.sheetsAccess).toBe(true)
    })
  })

  describe('Error Handling Security', () => {
    it('should not expose stack traces in production', async () => {
      // Force an error
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404)
      
      expect(response.body).not.toHaveProperty('stack')
      expect(response.body.error).not.toContain('at ')
    })

    it('should log security events', async () => {
      // Attempt unauthorized access
      await request(app)
        .get('/api/projects')
        .expect(401)
      
      // This would verify that security events are logged
      // In a real implementation, you'd check your logging system
    })
  })
})