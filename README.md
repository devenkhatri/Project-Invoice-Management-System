# Project Invoice Management System

A comprehensive project and invoice management system for solopreneurs, built with React, Node.js, and Google Sheets as the backend database. 

## Features

- **Project Management**: Complete project and task management with time tracking
- **Invoice Management**: Automated invoice generation with GST compliance
- **Client Management**: Comprehensive client database with secure portal access
- **Payment Processing**: Integrated payment gateways (Stripe, PayPal, Razorpay)
- **Financial Dashboard**: Real-time metrics, charts, and reporting
- **Analytics & Reporting**: Revenue tracking, expense analysis, and project profitability
- **Google Sheets Backend**: Reliable data storage with direct access to your data
- **Progressive Web App**: Enhanced offline support with connectivity monitoring
- **Mobile Responsive**: Optimized for all device types with touch-friendly interfaces

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Google Cloud Platform account
- Google Sheets API credentials

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with:
   - Google Sheets ID
   - Google Service Account credentials
   - JWT secrets
   - Other API keys as needed

5. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm start
   ```

### Google Sheets Setup

1. Create a new Google Sheets document
2. Note the spreadsheet ID from the URL
3. Create a Google Cloud Platform project
4. Enable the Google Sheets API
5. Create a service account and download the JSON key
6. Share your Google Sheets document with the service account email
7. Configure the environment variables with your credentials

### Initial Setup

1. Start both backend and frontend servers
2. Visit http://localhost:3000
3. Check that the backend connection is successful
4. Click "Initialize Google Sheets" to create the required sheets

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── models/         # Data models and types
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── middleware/     # Authentication and validation
│   │   ├── scripts/        # Google Sheets setup and utilities
│   │   └── index.ts        # Main server file
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── auth/       # Authentication components
│   │   │   ├── clients/    # Client management components
│   │   │   ├── dashboard/  # Dashboard and analytics components
│   │   │   ├── invoices/   # Invoice management components
│   │   │   ├── projects/   # Project management components
│   │   │   └── common/     # Shared components
│   │   ├── services/       # API client and services
│   │   ├── pages/          # Page components
│   │   ├── types/          # TypeScript type definitions
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   └── tsconfig.json
└── .kiro/specs/           # Project specifications and documentation
```

## Progressive Web App (PWA) Features

The application includes comprehensive PWA capabilities for enhanced user experience:

### Offline Support
- **Connectivity Monitoring**: Real-time detection of online/offline status
- **Enhanced Detection**: Multiple methods including service worker integration
- **Visual Feedback**: Automatic notifications for connectivity changes
- **Graceful Degradation**: Limited functionality available when offline

### Service Worker Integration
- **Background Sync**: Automatic data synchronization when connection is restored
- **Caching Strategy**: Intelligent caching of critical resources
- **Offline Notifications**: Service worker-based connectivity monitoring

### Installation
- **Install Prompts**: Native app-like installation on supported devices
- **App Manifest**: Proper PWA manifest for home screen installation
- **Responsive Design**: Optimized for mobile, tablet, and desktop usage

## Development

- Backend runs on http://localhost:3001
- Frontend runs on http://localhost:3000
- API endpoints are available at http://localhost:3001/api
- Health check: http://localhost:3001/health
- PWA features available in production builds

## Testing

The project includes a comprehensive testing suite:

### Backend Testing

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test interactions between components
- **E2E Tests**: Test complete user flows from end to end
- **Performance Tests**: Measure system performance under load
- **System Integration Tests**: Validate all requirements and system functionality

To run backend tests:

```bash
cd backend
npm test                                # Run all tests
npm test -- --testPathPattern=e2e       # Run only E2E tests
npm test -- --testPathPattern=unit      # Run only unit tests
npm test -- --coverage                  # Generate coverage report
npm run test:system                     # Run comprehensive system integration tests
npm run test:requirements               # Validate requirements implementation
npm run test:data-integrity             # Verify Google Sheets data integrity
npm run test:gst-compliance             # Test GST compliance features
```

### System Integration Testing

The system includes a comprehensive integration test suite (`system-integration.test.ts`) that validates all major requirements:

1. **Authentication & Security**: JWT token handling, refresh tokens, 2FA setup
2. **Client Management**: Client CRUD operations with GST information
3. **Project Management**: Projects, tasks, time tracking, and status updates
4. **Document Management**: File uploads, sharing, and project associations
5. **Expense Tracking**: Recording and retrieving project expenses
6. **Invoice Management**: Generation, GST calculations, PDF export, and client communication
7. **Payment Processing**: Payment links, partial payments, and invoice status updates
8. **Financial Reporting**: Profitability reports, summaries, and data exports
9. **GST Compliance**: GSTR1/GSTR3B reports, GST validation, and e-invoicing
10. **Automation & Workflow**: Reminders, workflow rules, and triggered actions
11. **Data Integrity**: Verification between API and Google Sheets, concurrent operations
12. **System Monitoring**: Health status and performance metrics

### System Integration Testing

The system includes comprehensive integration testing to ensure all components work together correctly:

#### Test Coverage

- **End-to-End Workflows**: Complete user journeys from project creation to payment
- **Requirements Validation**: Automated verification of all system requirements
- **Data Integrity**: Validation of Google Sheets data consistency and referential integrity
- **GST Compliance**: Testing of Indian tax regulations and e-invoicing requirements
- **Performance Under Load**: Concurrent user testing and API response time validation

#### Key Integration Test Features

The `system-integration.test.ts` file provides comprehensive validation of all system requirements:

- **Complete API Testing**: Tests all API endpoints and their interactions
- **Sequential Workflow Testing**: Validates entire business processes from start to finish
- **Data Consistency Checks**: Ensures data integrity across the system
- **Concurrent Operation Testing**: Validates system behavior under parallel operations
- **Error Handling Validation**: Verifies proper error responses and validation

#### Test Reports

System tests generate detailed reports in the `backend/reports` directory:
- `system-test-report-YYYY-MM-DD.json`: Comprehensive system test results
- `requirements-validation-YYYY-MM-DD.json`: Requirements implementation status
- `data-integrity-YYYY-MM-DD.json`: Google Sheets data integrity report

#### User Acceptance Testing

A structured UAT process is defined in `backend/docs/user-acceptance-testing.md` with:
- Detailed test scenarios for all major features
- Step-by-step instructions for manual testing
- Issue reporting templates and sign-off procedures

## Documentation

The system includes comprehensive documentation:

- **User Guide**: Complete user documentation in `backend/docs/user-guide.md`
- **API Documentation**: Detailed API endpoints and usage examples
- **Developer Guide**: Setup instructions and development workflows
- **Testing Guide**: Testing procedures and best practices

## API Documentation

### System Monitoring API

The System Monitoring API provides access to system health and performance metrics:

#### Endpoints

- `GET /api/monitoring/health` - Get current system health status
- `GET /api/monitoring/performance` - Get performance statistics
- `GET /api/monitoring/metrics` - Get system metrics history

#### Health Status Response

```typescript
interface HealthResponse {
  status: 'healthy' | 'warning' | 'critical';
  metrics: {
    timestamp: string;
    cpu: {
      usage: number;
      loadAvg: number[];
    };
    memory: {
      total: number;
      free: number;
      used: number;
      usedPercent: number;
    };
    disk: {
      total: number;
      free: number;
      used: number;
      usedPercent: number;
    };
    uptime: number;
    processMemory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}
```

#### Performance Statistics

```typescript
interface PerformanceStats {
  averages: Record<string, number>; // Average duration by operation
  slowest: Array<{
    timestamp: string;
    apiEndpoint?: string;
    operation?: string;
    duration: number;
    status?: number;
    userAgent?: string;
  }>;
}
```

### GST Reporting API

The GST Reporting API provides comprehensive tax compliance features for Indian businesses:

#### Endpoints

- `GET /api/gst/reports/gstr1` - Generate GSTR1 report (outward supplies)
- `GET /api/gst/reports/gstr3b` - Generate GSTR3B report (monthly summary)
- `POST /api/gst/export` - Export GST reports in various formats

#### Report Filters

```typescript
interface GSTReportFilters {
  startDate: string;
  endDate: string;
  gstType?: 'intra' | 'inter' | 'all'; // Intra-state or Inter-state
  clientId?: string;
  invoiceStatus?: string[];
}
```

#### Export Options

```typescript
interface GSTExportRequest {
  reportType: 'gstr1' | 'gstr2' | 'gstr3b' | 'gstr9';
  format: 'json' | 'csv' | 'pdf' | 'excel';
  filters: GSTReportFilters;
}
```

#### GSTR1 Report Structure

```typescript
interface GSTR1ReportData {
  b2b: B2BInvoice[]; // B2B invoices
  b2c: B2CInvoice[]; // B2C invoices (large)
  b2cs: B2CSInvoice[]; // B2C small invoices (aggregated)
  hsn: HSNSummary[]; // HSN summary
}
```

### File Management API

The file management API provides comprehensive file storage and organization capabilities:

#### Endpoints

- `POST /api/files/upload` - Upload a new file
- `GET /api/files/:id` - Get file metadata
- `GET /api/files/download/:id` - Download a file
- `DELETE /api/files/:id` - Delete a file
- `PUT /api/files/:id` - Update file metadata
- `GET /api/files/search` - Search files with advanced filtering
- `POST /api/files/batch/tags` - Batch update file tags
- `POST /api/files/batch/share` - Batch share files with clients

#### File Search Options

```typescript
interface FileSearchRequest {
  projectId?: string;
  clientId?: string;
  query?: string;
  mimeType?: string;
  tags?: string[];
  uploadedBy?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
  fullTextSearch?: boolean;
  isSharedWithClient?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}
```

#### File Record Structure

```typescript
interface FileRecord {
  id: string;
  name: string;
  original_name: string;
  drive_file_id: string;
  mime_type: string;
  size: string;
  project_id?: string;
  client_id?: string;
  uploaded_by: string;
  description?: string;
  tags?: string;
  is_shared_with_client: boolean;
  web_view_link: string;
  web_content_link: string;
  created_at: string;
  updated_at: string;
}
```

### Dashboard API

The dashboard API provides comprehensive financial and project analytics:

#### Endpoints

- `GET /api/financial/dashboard` - Get dashboard metrics
- `GET /api/financial/reports/{reportType}` - Generate financial reports
- `POST /api/financial/export` - Export reports in various formats

#### Dashboard Metrics

```typescript
interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  outstandingInvoices: number;
  overdueInvoices: number;
}
```

#### Report Types

- `profit_loss` - Profit and loss statements
- `expense_summary` - Expense breakdown by category
- `revenue_summary` - Revenue analysis over time
- `project_profitability` - Individual project profitability

#### Export Formats

- PDF - Professional formatted reports
- CSV - Data for spreadsheet analysis
- Excel - Advanced data manipulation

#### Dashboard Data Structure

```typescript
interface DashboardData {
  metrics: DashboardMetrics;
  projectStats: ProjectStats;
  recentActivity: RecentActivity[];
  monthlyRevenue: Array<{ month: string; revenue: number; expenses: number }>;
  expensesByCategory: Array<{ category: string; amount: number; percentage: number }>;
  projectProfitability: Array<{
    projectId: string;
    projectName: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;
}
```

#### Report Filters

```typescript
interface ReportFilters {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  clientId?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
}
```

### Client Portal API

Secure client access to project information:

- `POST /api/client-portal/generate-access` - Generate portal access token
- `POST /api/client-portal/login` - Client portal authentication
- `GET /api/client-portal/dashboard` - Client dashboard data
- `GET /api/client-portal/projects` - Client's projects
- `POST /api/client-portal/communications` - Send messages

## Features Status

### ✅ Completed Features
- Backend API server with TypeScript and Express.js
- React frontend with Material-UI and TypeScript
- Google Sheets API integration and data models
- Authentication and security middleware
- Project and task management
- Client management with portal access
- Invoice generation and management
- Payment processing integration
- Financial dashboard and reporting
- Enhanced connectivity monitoring with offline support
- Progressive Web App (PWA) foundation
- Comprehensive test coverage
- System integration testing and validation
- GST compliance and e-invoicing
- User documentation and help guides

### 🚧 In Progress
- File management and document sharing
  - Enhanced file search capabilities with full-text search
  - Improved file organization and metadata management
- Mobile responsiveness optimization
- Advanced automation workflows

### ✅ Recently Completed
- Comprehensive System Integration Testing
  - End-to-end workflow validation
  - Requirements verification against implementation
  - Data integrity validation across Google Sheets
  - GST compliance testing for Indian regulations
  - User acceptance testing documentation
- User Documentation
  - Complete user guide with feature walkthroughs
  - Administrator documentation
  - API documentation for integrations
- Advanced GST compliance features
  - GSTR1 report generation for outward supplies
  - GSTR3B monthly summary reporting
  - B2B and B2C invoice categorization
  - Inter-state vs intra-state transaction detection
  - HSN code support for product/service categorization
  - Multiple export formats (PDF, CSV, JSON, Excel)
- Comprehensive System Monitoring
  - Real-time performance tracking and metrics collection
  - Automated error detection and alerting
  - System health monitoring (CPU, memory, disk usage)
  - API response time tracking and slow operation detection

### 📋 Planned Features
- QuickBooks/Xero integration
- Complete offline functionality with local storage
- API rate limiting and caching
- Push notifications for important updates

Ready for production deployment with comprehensive project and invoice management capabilities.