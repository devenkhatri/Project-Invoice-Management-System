import { setupTestServer, teardownTestServer, getTestAgent, getAuthToken } from '../e2e/setup';

describe('Concurrent User Load Tests', () => {
  // Test user credentials
  const testUsers = [
    { email: 'user1@example.com', password: 'password123' },
    { email: 'user2@example.com', password: 'password123' },
    { email: 'user3@example.com', password: 'password123' },
    { email: 'user4@example.com', password: 'password123' },
    { email: 'user5@example.com', password: 'password123' }
  ];
  
  // Setup and teardown
  beforeAll(async () => {
    await setupTestServer();
  });
  
  afterAll(async () => {
    await teardownTestServer();
  });
  
  // Helper function to simulate user activity
  const simulateUserActivity = async (userIndex: number) => {
    const user = testUsers[userIndex];
    const authToken = await getAuthToken(user.email, user.password);
    const agent = getTestAgent();
    
    // Simulate a sequence of API calls
    const results = [];
    
    // 1. Get projects
    const projectsResponse = await agent
      .get('/api/projects')
      .set('Authorization', `Bearer ${authToken}`);
    results.push({
      operation: 'Get Projects',
      status: projectsResponse.status,
      time: projectsResponse.headers['x-response-time']
    });
    
    // 2. Get clients
    const clientsResponse = await agent
      .get('/api/clients')
      .set('Authorization', `Bearer ${authToken}`);
    results.push({
      operation: 'Get Clients',
      status: clientsResponse.status,
      time: clientsResponse.headers['x-response-time']
    });
    
    // 3. Get invoices
    const invoicesResponse = await agent
      .get('/api/invoices')
      .set('Authorization', `Bearer ${authToken}`);
    results.push({
      operation: 'Get Invoices',
      status: invoicesResponse.status,
      time: invoicesResponse.headers['x-response-time']
    });
    
    // 4. Get dashboard data
    const dashboardResponse = await agent
      .get('/api/reports/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    results.push({
      operation: 'Get Dashboard',
      status: dashboardResponse.status,
      time: dashboardResponse.headers['x-response-time']
    });
    
    return results;
  };
  
  // Test concurrent user access
  test('Should handle 5 concurrent users accessing the system', async () => {
    // Simulate 5 users accessing the system concurrently
    const userPromises = testUsers.map((_, index) => simulateUserActivity(index));
    const allResults = await Promise.all(userPromises);
    
    // Flatten results for analysis
    const flatResults = allResults.flat();
    
    // Calculate average response times
    const operationTypes = [...new Set(flatResults.map(r => r.operation))];
    const averageTimes: Record<string, number> = {};
    
    operationTypes.forEach(op => {
      const opResults = flatResults.filter(r => r.operation === op);
      const totalTime = opResults.reduce((sum, r) => sum + (parseInt(r.time) || 0), 0);
      averageTimes[op] = totalTime / opResults.length;
    });
    
    // Log results
    console.log('Average response times for concurrent users:');
    Object.entries(averageTimes).forEach(([op, time]) => {
      console.log(`${op}: ${time}ms`);
    });
    
    // Verify all requests were successful
    const allSuccessful = flatResults.every(r => r.status >= 200 && r.status < 300);
    expect(allSuccessful).toBe(true);
    
    // Verify response times are within acceptable limits
    Object.values(averageTimes).forEach(time => {
      expect(time).toBeLessThan(5000); // All operations should complete in under 5 seconds
    });
  });
  
  // Test system under heavy read load
  test('Should handle heavy read operations', async () => {
    const user = testUsers[0];
    const authToken = await getAuthToken(user.email, user.password);
    const agent = getTestAgent();
    
    // Perform 50 consecutive read operations
    const startTime = Date.now();
    const operations = 50;
    
    for (let i = 0; i < operations; i++) {
      const response = await agent
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / operations;
    
    console.log(`Completed ${operations} read operations in ${totalTime}ms (${avgTime}ms per operation)`);
    expect(avgTime).toBeLessThan(200); // Each read should average under 200ms
  });
  
  // Test system under heavy write load
  test('Should handle heavy write operations', async () => {
    const user = testUsers[0];
    const authToken = await getAuthToken(user.email, user.password);
    const agent = getTestAgent();
    
    // Get a client ID for creating projects
    const clientsResponse = await agent
      .get('/api/clients')
      .set('Authorization', `Bearer ${authToken}`);
    
    const clientId = clientsResponse.body[0]?.id;
    expect(clientId).toBeTruthy();
    
    // Perform 20 consecutive write operations
    const startTime = Date.now();
    const operations = 20;
    const createdProjectIds = [];
    
    for (let i = 0; i < operations; i++) {
      const testProject = {
        name: `Load Test Project ${i}`,
        client_id: clientId,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        budget: 1000 + i,
        description: `Load test project ${i} description`
      };
      
      const response = await agent
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testProject);
      
      expect(response.status).toBe(201);
      createdProjectIds.push(response.body.id);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / operations;
    
    console.log(`Completed ${operations} write operations in ${totalTime}ms (${avgTime}ms per operation)`);
    expect(avgTime).toBeLessThan(500); // Each write should average under 500ms
    
    // Clean up created projects
    for (const projectId of createdProjectIds) {
      await agent
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
  });
});