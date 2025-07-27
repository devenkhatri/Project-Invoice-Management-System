import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import request from 'supertest';
import app from '../server';
import { SheetsService } from '../services/sheets.service';

describe('System Integration Tests', () => {
  let authToken: string;
  let testProjectId: string;
  let testClientId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    // Setup test authentication
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    if (loginResponse.status === 200) {
      authToken = loginResponse.body.accessToken;
    }
  });

  describe('End-to-End Workflow: Project to Invoice', () => {
    it('should complete full project lifecycle', async () => {
      // Step 1: Create a client
      const clientResponse = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Client',
          email: 'client@test.com',
          phone: '+91-9876543210',
          address: 'Test Address, Mumbai, Maharashtra',
          gstin: '27ABCDE1234F1Z5',
          payment_terms: 'Net 30'
        });

      expect(clientResponse.status).toBe(201);
      testClientId = clientResponse.body.data.id;

      // Step 2: Create a project
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          client_id: testClientId,
          description: 'Integration test project',
          start_date: '2024-01-01',
          end_date: '2024-03-01',
          budget: 50000,
          status: 'active'
        });

      expect(projectResponse.status).toBe(201);
      testProjectId = projectResponse.body.data.id;

      // Step 3: Add tasks to project
      const taskResponse = await request(app)
        .post(`/api/projects/${testProjectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Development Task',
          description: 'Main development work',
          priority: 'high',
          estimated_hours: 40,
          due_date: '2024-02-15'
        });

      expect(taskResponse.status).toBe(201);
      const taskId = taskResponse.body.data.id;

      // Step 4: Log time entries
      const timeEntryResponse = await request(app)
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          task_id: taskId,
          project_id: testProjectId,
          hours: 8,
          description: 'Development work',
          date: '2024-01-15'
        });

      expect(timeEntryResponse.status).toBe(201);

      // Step 5: Complete the task
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed',
          actual_hours: 8
        });

      // Step 6: Generate invoice from project
      const invoiceResponse = await request(app)
        .post(`/api/invoices/from-project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          include_time_entries: true,
          hourly_rate: 1000
        });

      expect(invoiceResponse.status).toBe(201);
      testInvoiceId = invoiceResponse.body.data.id;

      // Step 7: Verify invoice details
      const invoiceDetails = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invoiceDetails.status).toBe(200);
      expect(invoiceDetails.body.data.client_id).toBe(testClientId);
      expect(invoiceDetails.body.data.project_id).toBe(testProjectId);
      expect(invoiceDetails.body.data.subtotal).toBe(8000); // 8 hours * 1000 rate

      // Step 8: Send invoice
      const sendResponse = await request(app)
        .post(`/api/invoices/${testInvoiceId}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email_template: 'standard',
          send_copy_to_self: true
        });

      expect(sendResponse.status).toBe(200);

      // Step 9: Record payment
      const paymentResponse = await request(app)
        .post(`/api/invoices/${testInvoiceId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: invoiceDetails.body.data.total_amount,
          payment_method: 'bank_transfer',
          payment_date: '2024-02-01',
          transaction_id: 'TXN123456'
        });

      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.data.is_fully_paid).toBe(true);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain referential integrity across sheets', async () => {
      // Verify project-client relationship
      const projectResponse = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(projectResponse.status).toBe(200);
      expect(projectResponse.body.data.client_id).toBe(testClientId);

      // Verify invoice-project-client relationships
      const invoiceResponse = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invoiceResponse.status).toBe(200);
      expect(invoiceResponse.body.data.client_id).toBe(testClientId);
      expect(invoiceResponse.body.data.project_id).toBe(testProjectId);
    });

    it('should handle concurrent operations correctly', async () => {
      // Create multiple time entries simultaneously
      const timeEntryPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/time-entries')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            project_id: testProjectId,
            hours: 2,
            description: `Concurrent work ${i + 1}`,
            date: '2024-01-16'
          })
      );

      const results = await Promise.all(timeEntryPromises);
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      // Verify all entries were created
      const timeEntriesResponse = await request(app)
        .get(`/api/time-entries?project_id=${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(timeEntriesResponse.status).toBe(200);
      expect(timeEntriesResponse.body.data.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large dataset operations efficiently', async () => {
      const startTime = Date.now();

      // Create multiple projects
      const projectPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: `Performance Test Project ${i + 1}`,
            client_id: testClientId,
            description: `Performance test project ${i + 1}`,
            start_date: '2024-01-01',
            end_date: '2024-03-01',
            budget: 10000,
            status: 'active'
          })
      );

      await Promise.all(projectPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify projects were created
      const projectsResponse = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(projectsResponse.status).toBe(200);
      expect(projectsResponse.body.data.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle API rate limits gracefully', async () => {
      // Make rapid API calls
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const results = await Promise.all(rapidRequests);
      
      // All requests should either succeed or be rate limited (not crash)
      results.forEach(result => {
        expect([200, 429]).toContain(result.status);
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle invalid data gracefully', async () => {
      // Try to create project with invalid client_id
      const invalidProjectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Project',
          client_id: 'invalid-client-id',
          description: 'This should fail',
          start_date: '2024-01-01',
          end_date: '2024-03-01',
          budget: 10000,
          status: 'active'
        });

      expect(invalidProjectResponse.status).toBe(400);
      expect(invalidProjectResponse.body.success).toBe(false);
    });

    it('should handle missing authentication', async () => {
      const unauthenticatedResponse = await request(app)
        .get('/api/projects');

      expect(unauthenticatedResponse.status).toBe(401);
    });

    it('should handle Google Sheets API errors', async () => {
      // Mock Google Sheets API failure
      const originalMethod = SheetsService.prototype.read;
      SheetsService.prototype.read = jest.fn().mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);

      // Restore original method
      SheetsService.prototype.read = originalMethod;
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testInvoiceId) {
      await request(app)
        .delete(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    if (testProjectId) {
      await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    if (testClientId) {
      await request(app)
        .delete(`/api/clients/${testClientId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
  });
});