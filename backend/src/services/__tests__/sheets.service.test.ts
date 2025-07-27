import { QueryOptions } from '../../types';

// Mock googleapis before importing SheetsService
jest.mock('googleapis', () => ({
  google: {
    sheets: jest.fn()
  }
}));

// Mock JWT
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({
    authorize: jest.fn()
  }))
}));

import { SheetsService } from '../sheets.service';
import { google } from 'googleapis';

const mockGoogle = google as jest.Mocked<typeof google>;

describe('SheetsService', () => {
  let sheetsService: SheetsService;
  let mockSheets: any;
  let mockServiceAccountKey: any;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Suppress console.error for cleaner test output
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock service account key
    mockServiceAccountKey = {
      client_email: 'test@example.com',
      private_key: 'mock-private-key'
    };

    // Mock sheets API
    mockSheets = {
      spreadsheets: {
        get: jest.fn(),
        batchUpdate: jest.fn(),
        values: {
          get: jest.fn(),
          update: jest.fn(),
          append: jest.fn()
        }
      }
    };

    mockGoogle.sheets.mockReturnValue(mockSheets);

    // Initialize service
    sheetsService = new SheetsService('test-spreadsheet-id', mockServiceAccountKey);
  });

  afterEach(() => {
    // Restore console.error
    consoleSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(mockGoogle.sheets).toHaveBeenCalledWith({
        version: 'v4',
        auth: expect.any(Object)
      });
    });
  });

  describe('initializeSheets', () => {
    it('should create sheets if they do not exist', async () => {
      // Mock spreadsheet response with no existing sheets
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: { sheets: [] }
      });

      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      await sheetsService.initializeSheets();

      // Should create 6 sheets (Projects, Tasks, Clients, Invoices, Time_Entries, Expenses)
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledTimes(6);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledTimes(6);
    });

    it('should not create sheets if they already exist', async () => {
      // Mock spreadsheet response with existing sheets
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: 'Projects' } },
            { properties: { title: 'Tasks' } },
            { properties: { title: 'Clients' } },
            { properties: { title: 'Invoices' } },
            { properties: { title: 'Time_Entries' } },
            { properties: { title: 'Expenses' } }
          ]
        }
      });

      await sheetsService.initializeSheets();

      // Should not create any sheets
      expect(mockSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a new record successfully', async () => {
      const testData = {
        name: 'Test Project',
        client_id: 'client_1',
        status: 'active'
      };

      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const id = await sheetsService.create('Projects', testData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Projects!A:J',
        valueInputOption: 'RAW',
        requestBody: {
          values: [expect.any(Array)]
        }
      });
    });

    it('should throw error for unknown sheet', async () => {
      await expect(sheetsService.create('UnknownSheet', {}))
        .rejects.toThrow('Failed to create record in UnknownSheet');
    });

    it('should handle API errors', async () => {
      mockSheets.spreadsheets.values.append.mockRejectedValue(
        new Error('API Error')
      );

      await expect(sheetsService.create('Projects', {}))
        .rejects.toThrow('Failed to create record in Projects');
    });
  });

  describe('read', () => {
    it('should read all records from a sheet', async () => {
      const mockResponse = {
        data: {
          values: [
            ['id', 'name', 'client_id', 'status'], // Headers
            ['1', 'Project 1', 'client_1', 'active'],
            ['2', 'Project 2', 'client_2', 'completed']
          ]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const records = await sheetsService.read('Projects');

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(expect.objectContaining({
        id: '1',
        name: 'Project 1',
        client_id: 'client_1',
        status: 'active'
      }));
    });

    it('should read a specific record by ID', async () => {
      const mockResponse = {
        data: {
          values: [
            ['id', 'name', 'client_id', 'status'],
            ['1', 'Project 1', 'client_1', 'active'],
            ['2', 'Project 2', 'client_2', 'completed']
          ]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const records = await sheetsService.read('Projects', '1');

      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('1');
    });

    it('should return empty array for sheet with only headers', async () => {
      const mockResponse = {
        data: {
          values: [['id', 'name', 'client_id', 'status']]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockResponse);

      const records = await sheetsService.read('Projects');

      expect(records).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      // Mock read response
      const mockReadResponse = {
        data: {
          values: [
            ['id', 'name', 'status'],
            ['1', 'Old Name', 'active']
          ]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const result = await sheetsService.update('Projects', '1', { name: 'New Name' });

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Projects!A2:J2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [expect.any(Array)]
        }
      });
    });

    it('should return false for non-existent record', async () => {
      const mockReadResponse = {
        data: {
          values: [['id', 'name', 'status']]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);

      const result = await sheetsService.update('Projects', 'non-existent', { name: 'New Name' });

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it.skip('should delete an existing record', async () => {
      // Mock read response
      const mockReadResponse = {
        data: {
          values: [
            ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at'],
            ['1', 'Project 1', 'client_1', 'active', '2024-01-01', '2024-02-01', '1000', 'Test project', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
          ]
        }
      };

      // Mock spreadsheet get response
      const mockSpreadsheetResponse = {
        data: {
          sheets: [
            { properties: { title: 'Projects', sheetId: 0 } }
          ]
        }
      };

      // Set up mocks in the correct order
      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);
      mockSheets.spreadsheets.get.mockResolvedValue(mockSpreadsheetResponse);
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

      const result = await sheetsService.delete('Projects', '1');

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id'
      });
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 2
              }
            }
          }]
        }
      });
    });

    it('should return false for non-existent record', async () => {
      const mockReadResponse = {
        data: {
          values: [['id', 'name', 'status']]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);

      const result = await sheetsService.delete('Projects', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('batchCreate', () => {
    it('should create multiple records', async () => {
      const testData = [
        { name: 'Project 1', status: 'active' },
        { name: 'Project 2', status: 'completed' }
      ];

      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const ids = await sheetsService.batchCreate('Projects', testData);

      expect(ids).toHaveLength(2);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Projects!A:J',
        valueInputOption: 'RAW',
        requestBody: {
          values: expect.any(Array)
        }
      });
    });
  });

  describe('query', () => {
    beforeEach(() => {
      const mockReadResponse = {
        data: {
          values: [
            ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at'],
            ['1', 'Project A', 'client_1', 'active', '2024-01-01', '2024-02-01', '1000', 'Test A', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'],
            ['2', 'Project B', 'client_2', 'completed', '2024-01-01', '2024-02-01', '2000', 'Test B', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'],
            ['3', 'Project C', 'client_3', 'active', '2024-01-01', '2024-02-01', '1500', 'Test C', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
          ]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);
    });

    it('should filter records by status', async () => {
      const options: QueryOptions = {
        filters: [{ column: 'status', operator: 'eq', value: 'active' }]
      };

      const records = await sheetsService.query('Projects', options);

      expect(records).toHaveLength(2);
      expect(records.every(r => r.status === 'active')).toBe(true);
    });

    it('should sort records by name', async () => {
      const options: QueryOptions = {
        sortBy: 'name',
        sortOrder: 'asc'
      };

      const records = await sheetsService.query('Projects', options);

      expect(records[0].name).toBe('Project A');
      expect(records[1].name).toBe('Project B');
      expect(records[2].name).toBe('Project C');
    });

    it('should apply pagination', async () => {
      const options: QueryOptions = {
        offset: 1,
        limit: 1
      };

      const records = await sheetsService.query('Projects', options);

      expect(records).toHaveLength(1);
      expect(records[0].name).toBe('Project B');
    });

    it('should combine filters, sorting, and pagination', async () => {
      const options: QueryOptions = {
        filters: [{ column: 'status', operator: 'eq', value: 'active' }],
        sortBy: 'budget',
        sortOrder: 'desc',
        limit: 1
      };

      const records = await sheetsService.query('Projects', options);

      expect(records).toHaveLength(1);
      expect(records[0].name).toBe('Project C'); // Highest budget among active projects
    });
  });

  describe('aggregate', () => {
    beforeEach(() => {
      const mockReadResponse = {
        data: {
          values: [
            ['id', 'name', 'client_id', 'status', 'start_date', 'end_date', 'budget', 'description', 'created_at', 'updated_at'],
            ['1', 'Project A', 'client_1', 'active', '2024-01-01', '2024-02-01', '1000', 'Test A', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'],
            ['2', 'Project B', 'client_2', 'completed', '2024-01-01', '2024-02-01', '2000', 'Test B', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'],
            ['3', 'Project C', 'client_3', 'active', '2024-01-01', '2024-02-01', '1500', 'Test C', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
          ]
        }
      };

      mockSheets.spreadsheets.values.get.mockResolvedValue(mockReadResponse);
    });

    it('should count records', async () => {
      const count = await sheetsService.aggregate('Projects', 'count');
      expect(count).toBe(3);
    });

    it('should sum field values', async () => {
      const sum = await sheetsService.aggregate('Projects', 'sum', 'budget');
      expect(sum).toBe(4500);
    });

    it('should calculate average', async () => {
      const avg = await sheetsService.aggregate('Projects', 'avg', 'budget');
      expect(avg).toBe(1500);
    });

    it('should find minimum value', async () => {
      const min = await sheetsService.aggregate('Projects', 'min', 'budget');
      expect(min).toBe(1000);
    });

    it('should find maximum value', async () => {
      const max = await sheetsService.aggregate('Projects', 'max', 'budget');
      expect(max).toBe(2000);
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors as retryable', async () => {
      const rateLimitError = { status: 429, code: 'RATE_LIMIT_EXCEEDED' };
      mockSheets.spreadsheets.values.get.mockRejectedValue(rateLimitError);

      try {
        await sheetsService.read('Projects');
      } catch (error: any) {
        expect(error.retryable).toBe(true);
        expect(error.statusCode).toBe(429);
      }
    });

    it('should handle network errors as retryable', async () => {
      const networkError = { code: 'ECONNRESET' };
      mockSheets.spreadsheets.values.get.mockRejectedValue(networkError);

      try {
        await sheetsService.read('Projects');
      } catch (error: any) {
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle authentication errors as non-retryable', async () => {
      const authError = { status: 401, code: 'UNAUTHORIZED' };
      mockSheets.spreadsheets.values.get.mockRejectedValue(authError);

      try {
        await sheetsService.read('Projects');
      } catch (error: any) {
        expect(error.retryable).toBe(false);
        expect(error.statusCode).toBe(401);
      }
    });
  });
});