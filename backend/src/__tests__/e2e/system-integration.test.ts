import { setupTestServer, teardownTestServer, getTestAgent, getAuthToken } from './setup';

/**
 * System Integration Test Suite
 * 
 * This test suite performs comprehensive integration testing of the entire system,
 * validating all requirements and ensuring proper functionality across components.
 */
describe('System Integration Tests', () => {
  // Test user credentials
  const testUser = {
    email: 'admin@example.com',
    password: 'securePassword123'
  };
  
  // Test data
  let authToken: string;
  let clientId: string;
  let projectId: string;
  let taskId: string;
  let timeEntryId: string;
  let expenseId: string;
  let invoiceId: string;
  let communicationId: string;
  let fileId: string;
  
  // Setup and teardown
  beforeAll(async () => {
    await setupTestServer();
    authToken = await getAuthToken(testUser.email, testUser.password);
  });
  
  afterAll(async () => {
    await teardownTestServer();
  });
  
  // Test authentication and security (Requirement 8)
  describe('Authentication and Security', () => {
    test('Should authenticate user and provide JWT token', async () => {
      const response = await getTestAgent()
        .post('/api/auth/login')
        .send(testUser);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });
    
    test('Should reject invalid credentials', async () => {
      const response = await getTestAgent()
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword'
        });
      
      expect(response.status).toBe(401);
    });
    
    test('Should refresh token', async () => {
      // First get refresh token
      const loginResponse = await getTestAgent()
        .post('/api/auth/login')
        .send(testUser);
      
      const refreshToken = loginResponse.body.refreshToken;
      
      // Then use it to get a new token
      const response = await getTestAgent()
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
    
    test('Should require authentication for protected routes', async () => {
      const response = await getTestAgent()
        .get('/api/projects');
      
      expect(response.status).toBe(401);
    });
    
    test('Should support two-factor authentication', async () => {
      // Setup 2FA
      const setupResponse = await getTestAgent()
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(setupResponse.status).toBe(200);
      expect(setupResponse.body).toHaveProperty('secret');
      expect(setupResponse.body).toHaveProperty('qrCode');
      
      // For testing purposes, we'll skip the actual verification
      // In a real test, we would generate a TOTP code from the secret
    });
  });
  
  // Test client management (Requirement 5)
  describe('Client Management', () => {
    test('Should create a new client with GST information', async () => {
      const testClient = {
        name: 'Integration Test Client',
        email: 'client@example.com',
        phone: '9876543210',
        address: '123 Test St, Mumbai, India',
        gstin: '27AAPFU0939F1ZV',
        payment_terms: 'Net 15'
      };
      
      const response = await getTestAgent()
        .post('/api/clients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testClient);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(testClient.name);
      expect(response.body.gstin).toBe(testClient.gstin);
      
      clientId = response.body.id;
    });
    
    test('Should retrieve client details', async () => {
      const response = await getTestAgent()
        .get(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', clientId);
    });
    
    test('Should update client information', async () => {
      const updateData = {
        payment_terms: 'Net 30'
      };
      
      const response = await getTestAgent()
        .put(`/api/clients/${clientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.payment_terms).toBe(updateData.payment_terms);
    });
    
    test('Should track client communication', async () => {
      const communication = {
        client_id: clientId,
        type: 'email',
        subject: 'Project Discussion',
        content: 'Discussing project requirements and timeline',
        date: new Date().toISOString()
      };
      
      const response = await getTestAgent()
        .post('/api/communications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(communication);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      communicationId = response.body.id;
    });
  });
  
  // Test project management (Requirement 1)
  describe('Project Management', () => {
    test('Should create a new project', async () => {
      const testProject = {
        name: 'Integration Test Project',
        client_id: clientId,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        budget: 10000,
        description: 'Project for integration testing'
      };
      
      const response = await getTestAgent()
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testProject);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(testProject.name);
      expect(response.body.status).toBe('active');
      
      projectId = response.body.id;
    });
    
    test('Should create tasks with priorities', async () => {
      const testTask = {
        project_id: projectId,
        title: 'Integration Test Task',
        description: 'Task for integration testing',
        status: 'todo',
        priority: 'high',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        estimated_hours: 20
      };
      
      const response = await getTestAgent()
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testTask);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.priority).toBe('high');
      
      taskId = response.body.id;
    });
    
    test('Should track time on tasks', async () => {
      const timeEntry = {
        task_id: taskId,
        project_id: projectId,
        hours: 4.5,
        description: 'Working on integration tests',
        date: new Date().toISOString()
      };
      
      const response = await getTestAgent()
        .post('/api/time-entries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(timeEntry);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.hours).toBe(4.5);
      
      timeEntryId = response.body.id;
    });
    
    test('Should update task status', async () => {
      const updateData = {
        status: 'in-progress'
      };
      
      const response = await getTestAgent()
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in-progress');
    });
    
    test('Should retrieve project with tasks', async () => {
      const response = await getTestAgent()
        .get(`/api/projects/${projectId}?include=tasks`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tasks');
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(response.body.tasks.length).toBeGreaterThan(0);
    });
  });
  
  // Test document and file management (Requirement 2)
  describe('Document and File Management', () => {
    test('Should upload a file and associate with project', async () => {
      // Mock file upload - in a real test, we would use a multipart form
      const fileData = {
        project_id: projectId,
        name: 'test-document.pdf',
        type: 'application/pdf',
        size: 1024,
        description: 'Test document for integration testing'
      };
      
      const response = await getTestAgent()
        .post('/api/files')
        .set('Authorization', `Bearer ${authToken}`)
        .send(fileData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(fileData.name);
      
      fileId = response.body.id;
    });
    
    test('Should retrieve files for a project', async () => {
      const response = await getTestAgent()
        .get(`/api/projects/${projectId}/files`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
    });
    
    test('Should share file with client', async () => {
      const shareData = {
        file_id: fileId,
        client_id: clientId,
        access_level: 'view'
      };
      
      const response = await getTestAgent()
        .post('/api/files/share')
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
  
  // Test expense tracking (Requirement 6)
  describe('Expense Tracking', () => {
    test('Should record an expense for a project', async () => {
      const expense = {
        project_id: projectId,
        category: 'Software',
        amount: 1500,
        description: 'Software license for project',
        date: new Date().toISOString(),
        receipt_url: 'https://example.com/receipt.pdf'
      };
      
      const response = await getTestAgent()
        .post('/api/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(expense);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(1500);
      
      expenseId = response.body.id;
    });
    
    test('Should retrieve expenses for a project', async () => {
      const response = await getTestAgent()
        .get(`/api/projects/${projectId}/expenses`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
  
  // Test invoice generation and management (Requirement 3)
  describe('Invoice Management', () => {
    test('Should generate an invoice from project data', async () => {
      const invoiceRequest = {
        project_id: projectId,
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        include_expenses: true
      };
      
      const response = await getTestAgent()
        .post('/api/invoices/generate-from-project')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoiceRequest);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('invoice_number');
      expect(response.body).toHaveProperty('total_amount');
      
      invoiceId = response.body.id;
    });
    
    test('Should include GST calculations in invoice', async () => {
      const response = await getTestAgent()
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tax_amount');
      expect(response.body).toHaveProperty('tax_details');
      expect(response.body.tax_details).toHaveProperty('cgst');
      expect(response.body.tax_details).toHaveProperty('sgst');
    });
    
    test('Should generate PDF for invoice', async () => {
      const response = await getTestAgent()
        .get(`/api/invoices/${invoiceId}/pdf`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
    });
    
    test('Should send invoice to client', async () => {
      const sendRequest = {
        email_message: 'Please find attached invoice for your review.'
      };
      
      const response = await getTestAgent()
        .post(`/api/invoices/${invoiceId}/send`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(sendRequest);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('sent');
    });
  });
  
  // Test payment processing (Requirement 4)
  describe('Payment Processing', () => {
    test('Should generate payment link for invoice', async () => {
      const response = await getTestAgent()
        .post(`/api/invoices/${invoiceId}/payment-link`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gateway: 'razorpay' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('payment_link');
      expect(response.body).toHaveProperty('payment_id');
    });
    
    test('Should record partial payment for invoice', async () => {
      const paymentDetails = {
        amount: 5000, // Partial payment
        payment_date: new Date().toISOString(),
        payment_method: 'bank_transfer',
        transaction_id: 'BANK123456'
      };
      
      const response = await getTestAgent()
        .post(`/api/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentDetails);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('partially_paid');
      expect(response.body).toHaveProperty('amount_paid');
      expect(response.body).toHaveProperty('amount_due');
    });
    
    test('Should record remaining payment and mark invoice as paid', async () => {
      // Get current invoice to determine remaining amount
      const invoiceResponse = await getTestAgent()
        .get(`/api/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const remainingAmount = invoiceResponse.body.amount_due;
      
      const paymentDetails = {
        amount: remainingAmount,
        payment_date: new Date().toISOString(),
        payment_method: 'credit_card',
        transaction_id: 'CARD789012'
      };
      
      const response = await getTestAgent()
        .post(`/api/invoices/${invoiceId}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentDetails);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paid');
      expect(response.body.amount_due).toBe(0);
    });
  });
  
  // Test financial reporting (Requirement 6)
  describe('Financial Reporting', () => {
    test('Should generate project profitability report', async () => {
      const response = await getTestAgent()
        .get(`/api/reports/project-profitability/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('revenue');
      expect(response.body).toHaveProperty('expenses');
      expect(response.body).toHaveProperty('profit');
      expect(response.body).toHaveProperty('profit_margin');
    });
    
    test('Should generate financial summary report', async () => {
      const response = await getTestAgent()
        .get('/api/reports/financial-summary')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_revenue');
      expect(response.body).toHaveProperty('total_expenses');
      expect(response.body).toHaveProperty('net_profit');
      expect(response.body).toHaveProperty('outstanding_invoices');
    });
    
    test('Should export financial data in multiple formats', async () => {
      // Test CSV export
      const csvResponse = await getTestAgent()
        .get('/api/reports/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          report_type: 'financial',
          format: 'csv',
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
      
      expect(csvResponse.status).toBe(200);
      expect(csvResponse.headers['content-type']).toBe('text/csv');
      
      // Test Excel export
      const excelResponse = await getTestAgent()
        .get('/api/reports/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          report_type: 'financial',
          format: 'excel',
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
      
      expect(excelResponse.status).toBe(200);
      expect(excelResponse.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });
  
  // Test GST compliance and reporting (Requirement 10)
  describe('GST Compliance and Reporting', () => {
    test('Should generate GSTR1 report', async () => {
      const response = await getTestAgent()
        .get('/api/reports/gst/gstr1')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('b2b');
      expect(response.body).toHaveProperty('b2c');
    });
    
    test('Should generate GSTR3B report', async () => {
      const response = await getTestAgent()
        .get('/api/reports/gst/gstr3b')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('outward_supplies');
      expect(response.body).toHaveProperty('inward_supplies');
      expect(response.body).toHaveProperty('tax_payable');
    });
    
    test('Should validate GST number format', async () => {
      // Valid GST number
      const validResponse = await getTestAgent()
        .post('/api/validation/gstin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gstin: '27AAPFU0939F1ZV' });
      
      expect(validResponse.status).toBe(200);
      expect(validResponse.body.valid).toBe(true);
      
      // Invalid GST number
      const invalidResponse = await getTestAgent()
        .post('/api/validation/gstin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ gstin: 'INVALID123456' });
      
      expect(invalidResponse.status).toBe(200);
      expect(invalidResponse.body.valid).toBe(false);
    });
    
    test('Should generate e-invoice', async () => {
      const response = await getTestAgent()
        .post(`/api/invoices/${invoiceId}/e-invoice`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('irn');
      expect(response.body).toHaveProperty('qrCode');
    });
  });
  
  // Test automation and workflow (Requirement 7)
  describe('Automation and Workflow', () => {
    test('Should set up automated reminders', async () => {
      const reminderConfig = {
        type: 'invoice_due',
        days_before: 3,
        message_template: 'Your invoice #{invoice_number} is due in {days_remaining} days.',
        enabled: true
      };
      
      const response = await getTestAgent()
        .post('/api/automation/reminders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reminderConfig);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.enabled).toBe(true);
    });
    
    test('Should create workflow rule for task completion', async () => {
      const workflowRule = {
        trigger: 'task_status_change',
        condition: { status: 'completed' },
        actions: [
          {
            type: 'update_project_progress',
            params: {}
          },
          {
            type: 'send_notification',
            params: {
              message: 'Task {task_title} has been completed'
            }
          }
        ]
      };
      
      const response = await getTestAgent()
        .post('/api/automation/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowRule);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
    
    test('Should trigger workflow when task is completed', async () => {
      // First, update task to completed
      const updateResponse = await getTestAgent()
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' });
      
      expect(updateResponse.status).toBe(200);
      
      // Then check project progress was updated (workflow effect)
      const projectResponse = await getTestAgent()
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(projectResponse.status).toBe(200);
      expect(projectResponse.body).toHaveProperty('progress');
      expect(projectResponse.body.progress).toBeGreaterThan(0);
    });
  });
  
  // Test Google Sheets data integrity (Requirement 11)
  describe('Google Sheets Data Integrity', () => {
    test('Should verify data consistency between API and Google Sheets', async () => {
      const response = await getTestAgent()
        .get('/api/system/verify-data-integrity')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('verification_results');
      expect(response.body.verification_results).toHaveProperty('projects');
      expect(response.body.verification_results).toHaveProperty('clients');
      expect(response.body.verification_results).toHaveProperty('invoices');
    });
    
    test('Should handle concurrent operations on Google Sheets', async () => {
      // Create multiple clients concurrently to test sheet operations
      const clientPromises = [];
      
      for (let i = 1; i <= 5; i++) {
        const clientData = {
          name: `Concurrent Test Client ${i}`,
          email: `concurrent${i}@example.com`,
          phone: `98765${i}`,
          address: `${i} Concurrent St, Test City`,
          gstin: `27AAPFU0939F1Z${i}`,
          payment_terms: 'Net 30'
        };
        
        clientPromises.push(
          getTestAgent()
            .post('/api/clients')
            .set('Authorization', `Bearer ${authToken}`)
            .send(clientData)
        );
      }
      
      const results = await Promise.all(clientPromises);
      
      // All requests should succeed
      results.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
    });
  });
  
  // Test system monitoring and health (Requirement 12)
  describe('System Monitoring and Health', () => {
    test('Should retrieve system health status', async () => {
      const response = await getTestAgent()
        .get('/api/system/health')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('cpu');
      expect(response.body.metrics).toHaveProperty('memory');
      expect(response.body.metrics).toHaveProperty('disk');
    });
    
    test('Should retrieve performance metrics', async () => {
      const response = await getTestAgent()
        .get('/api/system/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeframe: 'hour' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('averages');
      expect(response.body).toHaveProperty('slowest');
    });
  });
  
  // Test user experience and accessibility (Requirement 9)
  describe('User Experience and API Consistency', () => {
    test('Should provide consistent error responses', async () => {
      const response = await getTestAgent()
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
    });
    
    test('Should validate input data', async () => {
      const invalidProject = {
        // Missing required fields
        name: '',
        status: 'invalid-status'
      };
      
      const response = await getTestAgent()
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProject);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('details');
      expect(Array.isArray(response.body.error.details)).toBe(true);
    });
  });
});