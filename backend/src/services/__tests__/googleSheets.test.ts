import { GoogleSheetsService, SheetsConfig, QueryFilter } from '../googleSheets';
import { google } from 'googleapis';

// Mock the googleapis module
jest.mock('googleapis');
jest.mock('google-auth-library');

const mockSheets = {
  spreadsheets: {
    get: jest.fn(),
    batchUpdate: jest.fn(),
    values: {
      get: jest.fn(),
      update: jest.fn(),
      append: jest.fn(),
    },
  },
};

const mockAuth = {
  authorize: jest.fn(),
};

(google.sheets as jest.Mock).mockReturnValue(mockSheets);

describe('GoogleSheetsService', () => {
  let service: GoogleSheetsService;
  const mockConfig: SheetsConfig = {
    spreadsheetId: 'test-spreadsheet-id',
    serviceAccountEmail: 'test@example.com',
    privateKey: 'test-private-key',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GoogleSheetsService(mockConfig);
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: { properties: { title: 'Test Sheet' } },
      });

      const result = await service.testConnection();
      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.get).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
      });
    });

    it('should return false when connection fails', async () => {
      mockSheets.spreadsheets.get.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      // Mock getHeaders
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
      });
    });

    it('should create a new record with generated ID', async () => {
      const testData = { name: 'John Doe', email: 'john@example.com' };
      
      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const id = await service.create('Users', testData);

      expect(typeof id).toBe('string');
      expect(id).toHaveLength(36); // UUID length
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'Users!A:A',
        valueInputOption: 'RAW',
        requestBody: {
          values: [expect.arrayContaining([id, 'John Doe', 'john@example.com'])],
        },
      });
    });

    it('should create a new record with provided ID', async () => {
      const testData = { id: 'custom-id', name: 'Jane Doe', email: 'jane@example.com' };
      
      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const id = await service.create('Users', testData);

      expect(id).toBe('custom-id');
    });

    it('should throw error when creation fails', async () => {
      mockSheets.spreadsheets.values.append.mockRejectedValue(new Error('Creation failed'));

      await expect(service.create('Users', { name: 'Test' })).rejects.toThrow('Creation failed');
    });
  });

  describe('read', () => {
    const mockData = [
      ['id', 'name', 'email'],
      ['1', 'John Doe', 'john@example.com'],
      ['2', 'Jane Doe', 'jane@example.com'],
    ];

    it('should read all records when no ID provided', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });

      const result = await service.read('Users');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'John Doe', email: 'john@example.com' });
      expect(result[1]).toEqual({ id: '2', name: 'Jane Doe', email: 'jane@example.com' });
    });

    it('should read specific record when ID provided', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });

      const result = await service.read('Users', '1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'John Doe', email: 'john@example.com' });
    });

    it('should return empty array when sheet is empty', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [] },
      });

      const result = await service.read('Users');

      expect(result).toEqual([]);
    });

    it('should throw error when read fails', async () => {
      mockSheets.spreadsheets.values.get.mockRejectedValue(new Error('Read failed'));

      await expect(service.read('Users')).rejects.toThrow('Read failed');
    });
  });

  describe('update', () => {
    it('should update an existing record', async () => {
      const updateData = { name: 'John Smith' };
      
      // Mock all the calls in sequence
      mockSheets.spreadsheets.values.get
        // First call: getHeaders in update method
        .mockResolvedValueOnce({
          data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
        })
        // Second call: read in findRowIndexById
        .mockResolvedValueOnce({
          data: {
            values: [
              ['id', 'name', 'email', 'created_at', 'updated_at'],
              ['1', 'John Doe', 'john@example.com', '2023-01-01', '2023-01-01'],
            ],
          },
        })
        // Third call: getHeaders in update method (second time)
        .mockResolvedValueOnce({
          data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
        })
        // Fourth call: read for existing data
        .mockResolvedValueOnce({
          data: {
            values: [
              ['id', 'name', 'email', 'created_at', 'updated_at'],
              ['1', 'John Doe', 'john@example.com', '2023-01-01', '2023-01-01'],
            ],
          },
        });

      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const result = await service.update('Users', '1', updateData);

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'Users!A2:E2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [expect.arrayContaining(['1', 'John Smith', 'john@example.com'])],
        },
      });
    });

    it('should throw error when record not found', async () => {
      // Mock getHeaders
      mockSheets.spreadsheets.values.get
        .mockResolvedValueOnce({
          data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
        })
        // Mock empty read result for findRowIndexById
        .mockResolvedValueOnce({
          data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
        });

      await expect(service.update('Users', 'nonexistent', { name: 'Test' }))
        .rejects.toThrow('Record with id nonexistent not found in Users');
    });
  });

  describe('delete', () => {
    it('should delete an existing record', async () => {
      // Mock read to find the record for findRowIndexById
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ['id', 'name', 'email'],
            ['1', 'John Doe', 'john@example.com'],
          ],
        },
      });

      // Mock getSpreadsheetInfo
      mockSheets.spreadsheets.get.mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: 'Users', sheetId: 123 } },
          ],
        },
      });

      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});

      const result = await service.delete('Users', '1');

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 123,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 2,
              },
            },
          }],
        },
      });
    });

    it('should throw error when record not found', async () => {
      // Mock empty read result for findRowIndexById
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['id', 'name', 'email']] },
      });

      await expect(service.delete('Users', 'nonexistent'))
        .rejects.toThrow('Record with id nonexistent not found in Users');
    });
  });

  describe('batchCreate', () => {
    beforeEach(() => {
      // Mock getHeaders
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
      });
    });

    it('should create multiple records', async () => {
      const testData = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Doe', email: 'jane@example.com' },
      ];
      
      mockSheets.spreadsheets.values.append.mockResolvedValue({});

      const ids = await service.batchCreate('Users', testData);

      expect(ids).toHaveLength(2);
      expect(ids.every(id => typeof id === 'string' && id.length === 36)).toBe(true);
      expect(mockSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: 'Users!A:A',
        valueInputOption: 'RAW',
        requestBody: {
          values: expect.arrayContaining([
            expect.arrayContaining([expect.any(String), 'John Doe', 'john@example.com']),
            expect.arrayContaining([expect.any(String), 'Jane Doe', 'jane@example.com']),
          ]),
        },
      });
    });
  });

  describe('batchUpdate', () => {
    beforeEach(() => {
      // Mock getHeaders for each update
      mockSheets.spreadsheets.values.get.mockImplementation((params) => {
        if (params.range.includes('1:1')) {
          return Promise.resolve({
            data: { values: [['id', 'name', 'email', 'created_at', 'updated_at']] },
          });
        }
        // Mock read for existing data
        return Promise.resolve({
          data: {
            values: [
              ['id', 'name', 'email', 'created_at', 'updated_at'],
              ['1', 'John Doe', 'john@example.com', '2023-01-01', '2023-01-01'],
            ],
          },
        });
      });
    });

    it('should update multiple records', async () => {
      const updates = [
        { id: '1', name: 'John Smith' },
      ];
      
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const result = await service.batchUpdate('Users', updates);

      expect(result).toBe(true);
    });

    it('should throw error when ID is missing', async () => {
      const updates = [{ name: 'John Smith' }];

      await expect(service.batchUpdate('Users', updates))
        .rejects.toThrow('ID is required for batch update');
    });
  });

  describe('query', () => {
    const mockData = [
      ['id', 'name', 'age', 'status'],
      ['1', 'John Doe', '25', 'active'],
      ['2', 'Jane Doe', '30', 'inactive'],
      ['3', 'Bob Smith', '35', 'active'],
    ];

    beforeEach(() => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });
    });

    it('should filter records with eq operator', async () => {
      const filters: QueryFilter[] = [
        { field: 'status', operator: 'eq', value: 'active' },
      ];

      const result = await service.query('Users', filters);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe');
      expect(result[1].name).toBe('Bob Smith');
    });

    it('should filter records with gt operator', async () => {
      const filters: QueryFilter[] = [
        { field: 'age', operator: 'gt', value: '25' },
      ];

      const result = await service.query('Users', filters);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Jane Doe');
      expect(result[1].name).toBe('Bob Smith');
    });

    it('should filter records with contains operator', async () => {
      const filters: QueryFilter[] = [
        { field: 'name', operator: 'contains', value: 'doe' },
      ];

      const result = await service.query('Users', filters);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe');
      expect(result[1].name).toBe('Jane Doe');
    });

    it('should filter records with multiple filters', async () => {
      const filters: QueryFilter[] = [
        { field: 'status', operator: 'eq', value: 'active' },
        { field: 'age', operator: 'gt', value: '25' },
      ];

      const result = await service.query('Users', filters);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob Smith');
    });

    it('should filter records with in operator', async () => {
      const filters: QueryFilter[] = [
        { field: 'name', operator: 'in', value: ['John Doe', 'Bob Smith'] },
      ];

      const result = await service.query('Users', filters);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('John Doe');
      expect(result[1].name).toBe('Bob Smith');
    });
  });

  describe('aggregate', () => {
    const mockData = [
      ['id', 'name', 'amount', 'quantity'],
      ['1', 'Item 1', '100', '5'],
      ['2', 'Item 2', '200', '3'],
      ['3', 'Item 3', '150', '7'],
    ];

    beforeEach(() => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: mockData },
      });
    });

    it('should calculate sum', async () => {
      const result = await service.aggregate('Items', 'sum', 'amount');
      expect(result).toBe(450);
    });

    it('should calculate average', async () => {
      const result = await service.aggregate('Items', 'avg', 'amount');
      expect(result).toBe(150);
    });

    it('should calculate count', async () => {
      const result = await service.aggregate('Items', 'count', 'amount');
      expect(result).toBe(3);
    });

    it('should calculate min', async () => {
      const result = await service.aggregate('Items', 'min', 'amount');
      expect(result).toBe(100);
    });

    it('should calculate max', async () => {
      const result = await service.aggregate('Items', 'max', 'amount');
      expect(result).toBe(200);
    });

    it('should throw error for unsupported operation', async () => {
      await expect(service.aggregate('Items', 'median', 'amount'))
        .rejects.toThrow('Unsupported aggregation operation: median');
    });

    it('should handle empty data', async () => {
      mockSheets.spreadsheets.values.get.mockResolvedValue({
        data: { values: [['id', 'name', 'amount']] },
      });

      const result = await service.aggregate('Items', 'sum', 'amount');
      expect(result).toBe(0);
    });
  });

  describe('createSheet', () => {
    it('should create a new sheet with headers', async () => {
      const sheetName = 'TestSheet';
      const headers = ['id', 'name', 'email'];

      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const result = await service.createSheet(sheetName, headers);

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          }],
        },
      });
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledWith({
        spreadsheetId: mockConfig.spreadsheetId,
        range: `${sheetName}!A1:C1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
    });

    it('should return false when sheet creation fails', async () => {
      mockSheets.spreadsheets.batchUpdate.mockRejectedValue(new Error('Creation failed'));

      const result = await service.createSheet('TestSheet', ['id', 'name']);

      expect(result).toBe(false);
    });
  });

  describe('initializeProjectSheets', () => {
    it('should initialize all project sheets', async () => {
      mockSheets.spreadsheets.batchUpdate.mockResolvedValue({});
      mockSheets.spreadsheets.values.update.mockResolvedValue({});

      const result = await service.initializeProjectSheets();

      expect(result).toBe(true);
      expect(mockSheets.spreadsheets.batchUpdate).toHaveBeenCalledTimes(6); // 6 sheets
      expect(mockSheets.spreadsheets.values.update).toHaveBeenCalledTimes(6);
    });

    it('should return false when initialization fails', async () => {
      // Reset all mocks first
      jest.clearAllMocks();
      
      // Make the first batchUpdate call fail
      mockSheets.spreadsheets.batchUpdate.mockRejectedValueOnce(new Error('Initialization failed'));

      const result = await service.initializeProjectSheets();

      expect(result).toBe(false);
    });
  });
});