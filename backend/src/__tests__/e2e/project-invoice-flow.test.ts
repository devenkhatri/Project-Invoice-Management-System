import { setupTestServer, teardownTestServer, getTestAgent, getAuthToken } from './setup';

describe('Project to Invoice Flow E2E Test', () => {
  // Test user credentials
  const testUser = {
    email: 'test@example.com',
    password: 'password123'
  };
  
  // Test data
  let authToken: string;
  let clientId: string;
  let projectId: string;
  let taskId: string;
  let timeEntryId: string;
  let invoiceId: string;
  
  // Setup and teardown
  beforeAll(async () => {
    await setupTestServer();
    authToken = await getAuthToken(testUser.email, testUser.password);
  });
  
  afterAll(async () => {
    await teardownTestServer();
  });
  
  // Test client creation
  test('Should create a new client', async () => {
    const testClient = {
      name: 'Test Client',
      email: 'client@example.com',
      phone: '1234567890',
      address: '123 Test St, Test City',
      gstin: 'TESTGST1234567890',
      payment_terms: 'Net 30'
    };
    
    const response = await getTestAgent()
      .post('/api/clients')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testClient);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    clientId = response.body.id;
  });
  
  // Test project creation
  test('Should create a new project for the client', async () => {
    const testProject = {
      name: 'Test Project',
      client_id: clientId,
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      budget: 5000,
      description: 'Test project description'
    };
    
    const response = await getTestAgent()
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testProject);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    projectId = response.body.id;
  });
  
  // Test task creation
  test('Should create a task for the project', async () => {
    const testTask = {
      project_id: projectId,
      title: 'Test Task',
      description: 'Test task description',
      status: 'todo',
      priority: 'medium',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_hours: 10
    };
    
    const response = await getTestAgent()
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(testTask);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    taskId = response.body.id;
  });
  
  // Test time entry creation
  test('Should log time for the task', async () => {
    const testTimeEntry = {
      task_id: taskId,
      project_id: projectId,
      hours: 5,
      description: 'Work on test task',
      date: new Date().toISOString()
    };
    
    const response = await getTestAgent()
      .post('/api/time-entries')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testTimeEntry);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    timeEntryId = response.body.id;
  });
  
  // Test invoice generation from project
  test('Should generate an invoice from the project', async () => {
    const invoiceRequest = {
      project_id: projectId,
      due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const response = await getTestAgent()
      .post('/api/invoices/generate-from-project')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invoiceRequest);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('invoice_number');
    invoiceId = response.body.id;
  });
  
  // Test invoice PDF generation
  test('Should generate a PDF for the invoice', async () => {
    const response = await getTestAgent()
      .get(`/api/invoices/${invoiceId}/pdf`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });
  
  // Test invoice payment recording
  test('Should record a payment for the invoice', async () => {
    const paymentDetails = {
      amount: 5000,
      payment_date: new Date().toISOString(),
      payment_method: 'bank_transfer',
      transaction_id: 'TEST123456'
    };
    
    const response = await getTestAgent()
      .post(`/api/invoices/${invoiceId}/payment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(paymentDetails);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('paid');
  });
  
  // Test project completion
  test('Should mark the project as completed', async () => {
    const updateData = {
      status: 'completed'
    };
    
    const response = await getTestAgent()
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updateData);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('completed');
  });
});