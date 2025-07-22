# Services Documentation

This directory contains the core business logic services for the Project Invoice Management System.

## Available Services

### MonitoringService

The `MonitoringService` provides comprehensive system health monitoring, performance tracking, and error alerting capabilities.

#### Features

- **System Metrics Collection**: Automatically collects CPU, memory, and disk usage metrics
- **Performance Tracking**: Records API response times and operation durations
- **Error Alerting**: Sends notifications for critical errors via email and Slack
- **Metrics Storage**: Stores metrics in JSON files for analysis
- **Health Reporting**: Provides system health status and performance statistics

#### Usage

```typescript
import { monitoringService, performanceMonitoringMiddleware } from '../services/monitoring';

// Record performance metrics for an operation
monitoringService.recordPerformance({
  operation: 'sheets.batchUpdate',
  duration: 1500 // milliseconds
});

// Get system health status
const healthStatus = monitoringService.getSystemHealth();

// Get performance statistics
const stats = await monitoringService.getPerformanceStats('day');

// Use the performance monitoring middleware
app.use(performanceMonitoringMiddleware());
```

#### Configuration

The monitoring service is configured through the `monitoring` section in the configuration:

```javascript
monitoring: {
  errorAlertThreshold: 5, // Number of errors before alerting
  performanceThresholds: {
    apiResponseTime: 1000, // ms
    sheetsOperationTime: 2000, // ms
    databaseOperationTime: 500, // ms
    memoryUsage: 400 // MB
  },
  metricsCollection: {
    interval: 300000, // 5 minutes in milliseconds
    retention: {
      systemMetrics: 288, // Keep 24 hours of system metrics (at 5-minute intervals)
      performanceMetrics: 1000 // Keep last 1000 performance metrics entries
    }
  },
  alertThrottleTime: 3600000, // 1 hour in milliseconds
  contactEmail: 'admin@example.com',
  slackWebhook: 'https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK'
}
```

### ErrorMonitor

The `ErrorMonitor` service provides error logging, tracking, and notification capabilities.

#### Features

- **Error Logging**: Logs errors with different severity levels
- **Error Context**: Captures detailed context information for debugging
- **Request Information**: Records request details for API errors
- **Notification System**: Triggers callbacks for error events

#### Usage

```typescript
import { ErrorMonitor, ErrorSeverity } from '../utils/errorMonitoring';

const errorMonitor = ErrorMonitor.getInstance();

// Log an error
errorMonitor.logError(
  'Failed to process invoice',
  ErrorSeverity.HIGH,
  { invoiceId: 'inv_123' }
);

// Use error handling middleware
app.use(errorMonitor.errorHandler());

// Use request logging middleware
app.use(errorMonitor.requestLogger());
```

### Other Services

- **GoogleSheetsService**: Handles interactions with Google Sheets API
- **AuthService**: Manages authentication and authorization
- **InvoiceService**: Handles invoice generation and management
- **PaymentProcessingService**: Processes payments through various gateways
- **GSTReportingService**: Generates GST compliance reports
- **EInvoicingService**: Handles e-invoicing for GST compliance
- **AdvancedAutomationService**: Manages complex workflow automation