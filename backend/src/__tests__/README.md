# Comprehensive Testing Documentation

This document provides an overview of the testing strategy and implementation for the Project Invoice Management System.

## Testing Categories

### 1. Unit Tests

Unit tests verify individual components and functions in isolation. They are located alongside the code they test in `__tests__` directories.

**Running Unit Tests:**
```bash
npm test
```

**Example Unit Test Locations:**
- `src/models/__tests__/` - Data model tests
- `src/services/__tests__/` - Service layer tests
- `src/middleware/__tests__/` - Middleware tests

### 2. End-to-End Tests

End-to-end tests verify complete user journeys through the system, testing multiple components working together.

**Running E2E Tests:**
```bash
npm test -- --testPathPattern=e2e
```

**Key E2E Test Files:**
- `src/__tests__/e2e/project-invoice-flow.test.ts` - Tests the complete project to invoice workflow
- `src/__tests__/e2e/system-integration.test.ts` - Comprehensive system integration tests validating all requirements

### 3. Performance Tests

Performance tests measure the system's response time, throughput, and resource usage under various conditions.

**Running Performance Tests:**
```bash
npm test -- --testPathPattern=performance
```

**Key Performance Test Files:**
- `src/__tests__/performance/sheets-performance.test.ts` - Tests Google Sheets operations performance

### 4. Load Tests

Load tests evaluate the system's behavior under concurrent user load and high transaction volumes.

**Running Load Tests:**
```bash
npm test -- --testPathPattern=load
```

**Key Load Test Files:**
- `src/__tests__/load/concurrent-users.test.ts` - Tests system performance with concurrent users

### 5. Accessibility Tests (Frontend)

Accessibility tests ensure the application is usable by people with disabilities.

**Running Accessibility Tests:**
```bash
cd ../frontend && npm test -- --testPathPattern=accessibility
```

**Key Accessibility Test Files:**
- Frontend component tests using the accessibility testing utilities

## Test Coverage

We aim for a minimum of 80% code coverage across the codebase. Coverage reports are generated during test runs.

**Generating Coverage Report:**
```bash
npm test -- --coverage
```

The coverage report will be available in the `coverage` directory.

## Error Monitoring and System Health

The system includes comprehensive error monitoring and system health tracking:

1. **Error Logging:** All errors are logged to daily log files in the `logs` directory
2. **Request Timing:** All API requests are timed and slow requests are logged
3. **Critical Error Alerts:** Critical errors trigger immediate notifications via email and Slack
4. **System Metrics:** CPU, memory, and disk usage are collected at regular intervals
5. **Performance Tracking:** API response times and operation durations are monitored

**Error Monitoring Configuration:**
- Error logs are stored in `logs/error-log-YYYY-MM-DD.json`
- System metrics are stored in `logs/metrics/system-metrics-YYYY-MM-DD.json`
- Performance metrics are stored in `logs/metrics/performance-metrics-YYYY-MM-DD.json`
- Error severity levels: low, medium, high, critical
- Request timing thresholds (configurable):
  - API operations: 1000ms
  - Google Sheets operations: 2000ms
  - Database operations: 500ms

## Test Data Management

Test data is managed through the following approaches:

1. **Test Environment:** A separate Google Sheets document is used for testing
2. **Data Seeding:** Test data can be seeded using `npm run sheets:init:sample`
3. **Test Cleanup:** All tests clean up after themselves to prevent data pollution

## Continuous Integration

Tests are automatically run in the CI pipeline on every pull request and merge to main branches.

**CI Test Workflow:**
1. Lint code
2. Run unit tests
3. Run integration tests
4. Generate and upload coverage report
5. Run performance tests (on scheduled basis)

## E2E Testing Setup

The E2E tests use a dedicated test server setup in `src/__tests__/e2e/setup.ts` that provides:

1. **Isolated Test Environment:** Each test suite runs with its own Express server instance
2. **Dynamic Port Assignment:** Uses random available ports to avoid conflicts
3. **Authentication Helpers:** Simplifies getting auth tokens for protected endpoints
4. **Clean Teardown:** Properly closes server connections after tests complete

**Key Setup Functions:**
- `setupTestServer()`: Initializes and starts the test server
- `teardownTestServer()`: Properly closes the server after tests
- `getTestAgent()`: Returns a configured Supertest instance
- `getAuthToken()`: Helper to authenticate and get a JWT token

**Example Usage:**
```typescript
import { setupTestServer, teardownTestServer, getTestAgent, getAuthToken } from './setup';

describe('API Test Suite', () => {
  beforeAll(async () => {
    await setupTestServer();
    // Optional: Get authentication token
    const authToken = await getAuthToken('user@example.com', 'password');
  });
  
  afterAll(async () => {
    await teardownTestServer();
  });
  
  test('Should access API endpoint', async () => {
    const response = await getTestAgent().get('/api/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Test Best Practices

1. **Isolation:** Tests should be independent and not rely on the state from other tests
2. **Deterministic:** Tests should produce the same results on every run
3. **Fast:** Unit tests should execute quickly to provide rapid feedback
4. **Comprehensive:** Tests should cover happy paths, edge cases, and error scenarios
5. **Maintainable:** Tests should be easy to understand and maintain

## Google Sheets Testing Considerations

When testing with Google Sheets as a backend:

1. **Rate Limiting:** Be aware of Google Sheets API rate limits
2. **Batch Operations:** Use batch operations when possible to reduce API calls
3. **Test Data Isolation:** Use separate sheets or ranges for test data
4. **Mock Responses:** Consider mocking Google Sheets API responses for unit tests

## Accessibility Testing Guidelines

Ensure all frontend components meet WCAG 2.1 AA standards:

1. **Color Contrast:** Text must have sufficient contrast against backgrounds
2. **Keyboard Navigation:** All functionality must be accessible via keyboard
3. **Screen Reader Support:** All content must be accessible to screen readers
4. **Form Labels:** All form controls must have associated labels
5. **ARIA Attributes:** Use ARIA attributes correctly when needed

## Performance Benchmarks

The system should meet the following performance benchmarks:

1. **API Response Time:** < 500ms for 95% of requests
2. **Google Sheets Operations:** < 2s for single operations, < 20ms per record for batch operations
3. **Concurrent Users:** Support at least 50 concurrent users with < 5s response time
4. **Page Load Time:** < 3s for initial page load, < 1s for subsequent interactions

## System Integration Testing

The `system-integration.test.ts` file provides comprehensive validation of all system requirements in a single test suite. This test file is designed to validate the entire system's functionality and ensure all components work together correctly.

### Key Features Tested

1. **Authentication & Security**
   - User authentication with JWT tokens
   - Token refresh mechanism
   - Two-factor authentication setup
   - Protected route access control

2. **Client Management**
   - Client creation with GST information
   - Client data retrieval and updates
   - Client communication tracking

3. **Project Management**
   - Project creation and configuration
   - Task management with priorities
   - Time tracking on tasks
   - Project progress monitoring

4. **Document Management**
   - File uploads and association with projects
   - File retrieval and listing
   - File sharing with clients

5. **Expense Tracking**
   - Expense recording for projects
   - Expense categorization and retrieval

6. **Invoice Management**
   - Invoice generation from project data
   - GST calculations in invoices
   - PDF generation for invoices
   - Invoice delivery to clients

7. **Payment Processing**
   - Payment link generation
   - Partial payment recording
   - Invoice status updates based on payments

8. **Financial Reporting**
   - Project profitability reporting
   - Financial summary reports
   - Data export in multiple formats

9. **GST Compliance**
   - GSTR1 and GSTR3B report generation
   - GST number validation
   - E-invoice generation

10. **Automation & Workflow**
    - Automated reminder configuration
    - Workflow rule creation
    - Workflow triggering based on events

11. **Data Integrity**
    - Verification between API and Google Sheets
    - Concurrent operation handling

12. **System Monitoring**
    - System health status reporting
    - Performance metrics collection

### Running the System Integration Tests

```bash
npm test -- --testPathPattern=system-integration
```

This comprehensive test suite ensures that all system requirements are properly implemented and working together as expected.