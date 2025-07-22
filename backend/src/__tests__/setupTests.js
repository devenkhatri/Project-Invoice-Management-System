// Global setup for all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GOOGLE_SHEETS_TEST_DOC_ID = 'test_doc_id';

// Global test timeout (30 seconds)
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Only show console output if TEST_DEBUG is set
if (!process.env.TEST_DEBUG) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Restore console methods after all tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global beforeEach and afterEach hooks
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

// Mock Google Sheets API for unit tests
jest.mock('googleapis', () => {
  return {
    google: {
      auth: {
        JWT: jest.fn().mockImplementation(() => ({
          authorize: jest.fn().mockResolvedValue({}),
        })),
      },
      sheets: jest.fn().mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: jest.fn().mockResolvedValue({ data: { values: [] } }),
            append: jest.fn().mockResolvedValue({ data: { updates: { updatedRows: 1 } } }),
            update: jest.fn().mockResolvedValue({ data: { updatedRows: 1 } }),
            batchGet: jest.fn().mockResolvedValue({ data: { valueRanges: [] } }),
            batchUpdate: jest.fn().mockResolvedValue({ data: { responses: [] } }),
          },
          create: jest.fn().mockResolvedValue({ data: { spreadsheetId: 'test_sheet_id' } }),
          get: jest.fn().mockResolvedValue({ data: { sheets: [] } }),
          batchUpdate: jest.fn().mockResolvedValue({ data: { replies: [] } }),
        },
      })),
    },
  };
});