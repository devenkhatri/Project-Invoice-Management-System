import request from 'supertest';
import express from 'express';
import { createGoogleSheetsService } from '../../services/googleSheets';
import { Expense, ExpenseCategory } from '../../models/Expense';
import expenseRoutes from '../expenses';
import { authMiddleware } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/googleSheets');
jest.mock('../../middleware/auth');
jest.mock('multer', () => {
  return () => ({
    single: () => (req: any, res: any, next: any) => {
      next();
    }
  });
});

describe('Expense Routes', () => {
  let app: express.Application;
  let mockSheetsService: any;
  
  // Mock expense data
  const mockExpenses = [
    {
      id: 'exp_1',
      project_id: 'proj_1',
      category: ExpenseCategory.EQUIPMENT,
      amount: 500,
      description: 'New laptop',
      date: '2025-06-15T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt1.pdf',
      created_at: '2025-06-15T10:00:00.000Z',
      updated_at: '2025-06-15T10:00:00.000Z'
    },
    {
      id: 'exp_2',
      project_id: 'proj_1',
      category: ExpenseCategory.SOFTWARE,
      amount: 100,
      description: 'Software license',
      date: '2025-06-16T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt2.pdf',
      created_at: '2025-06-16T10:00:00.000Z',
      updated_at: '2025-06-16T10:00:00.000Z'
    },
    {
      id: 'exp_3',
      project_id: 'proj_2',
      category: ExpenseCategory.TRAVEL,
      amount: 200,
      description: 'Client meeting travel',
      date: '2025-06-17T00:00:00.000Z',
      receipt_url: 'https://example.com/receipt3.pdf',
      created_at: '2025-06-17T10:00:00.000Z',
      updated_at: '2025-06-17T10:00:00.000Z'
    }
  ];
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through
    (authMiddleware as jest.Mock).mockImplementation((req, res, next) => next());
    
    // Create mock GoogleSheetsService
    mockSheetsService = {
      read: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };
    
    // Mock createGoogleSheetsService to return our mock
    (createGoogleSheetsService as jest.Mock).mockReturnValue(mockSheetsService);
    
    // Setup default mock responses
    mockSheetsService.read.mockImplementation((sheetName: string, id?: string) => {
      if (id) {
        const expense = mockExpenses.find(exp => exp.id === id);
        return Promise.resolve(expense ? [expense] : []);
      }
      return Promise.resolve(mockExpenses);
    });
    
    mockSheetsService.create.mockImplementation(() => Promise.resolve('new_exp_id'));
    mockSheetsService.update.mockImplementation(() => Promise.resolve(true));
    mockSheetsService.delete.mockImplementation(() => Promise.resolve(true));
    
    // Create express app and mount routes
    app = express();
    app.use(express.json());
    app.use('/api/expenses', expenseRoutes);
  });
  
  describe('GET /api/expenses', () => {
    it('should return all expenses', async () => {
      const response = await request(app).get('/api/expenses');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.data).toHaveLength(3);
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses');
    });
    
    it('should filter expenses by project_id', async () => {
      const response = await request(app).get('/api/expenses?project_id=proj_1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].project_id).toBe('proj_1');
      expect(response.body.data[1].project_id).toBe('proj_1');
    });
    
    it('should filter expenses by category', async () => {
      const response = await request(app).get('/api/expenses?category=travel');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('travel');
    });
    
    it('should filter expenses by date range', async () => {
      const response = await request(app).get('/api/expenses?start_date=2025-06-16&end_date=2025-06-17');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('exp_2');
      expect(response.body.data[1].id).toBe('exp_3');
    });
    
    it('should filter expenses by amount range', async () => {
      const response = await request(app).get('/api/expenses?min_amount=200&max_amount=500');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('exp_1');
      expect(response.body.data[1].id).toBe('exp_3');
    });
    
    it('should handle errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/expenses');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('GET /api/expenses/:id', () => {
    it('should return a single expense by ID', async () => {
      const response = await request(app).get('/api/expenses/exp_1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('exp_1');
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses', 'exp_1');
    });
    
    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);
      
      const response = await request(app).get('/api/expenses/non_existent');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
    
    it('should handle errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/expenses/exp_1');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('POST /api/expenses', () => {
    it('should create a new expense', async () => {
      const newExpense = {
        project_id: 'proj_1',
        category: ExpenseCategory.OFFICE,
        amount: 150,
        description: 'Office supplies',
        date: '2025-06-18T00:00:00.000Z'
      };
      
      const response = await request(app)
        .post('/api/expenses')
        .send(newExpense);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project_id).toBe('proj_1');
      expect(response.body.data.category).toBe(ExpenseCategory.OFFICE);
      expect(response.body.data.amount).toBe(150);
      expect(mockSheetsService.create).toHaveBeenCalled();
    });
    
    it('should handle validation errors', async () => {
      const invalidExpense = {
        // Missing required fields
        category: 'invalid_category',
        amount: -50
      };
      
      const response = await request(app)
        .post('/api/expenses')
        .send(invalidExpense);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should handle errors', async () => {
      mockSheetsService.create.mockRejectedValue(new Error('Test error'));
      
      const newExpense = {
        project_id: 'proj_1',
        category: ExpenseCategory.OFFICE,
        amount: 150,
        description: 'Office supplies',
        date: '2025-06-18T00:00:00.000Z'
      };
      
      const response = await request(app)
        .post('/api/expenses')
        .send(newExpense);
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('PUT /api/expenses/:id', () => {
    it('should update an existing expense', async () => {
      const updateData = {
        amount: 600,
        description: 'Updated description'
      };
      
      const response = await request(app)
        .put('/api/expenses/exp_1')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('exp_1');
      expect(response.body.data.amount).toBe(600);
      expect(response.body.data.description).toBe('Updated description');
      expect(mockSheetsService.update).toHaveBeenCalled();
    });
    
    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);
      
      const response = await request(app)
        .put('/api/expenses/non_existent')
        .send({ amount: 600 });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
    
    it('should handle validation errors', async () => {
      const invalidUpdate = {
        amount: -50
      };
      
      const response = await request(app)
        .put('/api/expenses/exp_1')
        .send(invalidUpdate);
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should handle errors', async () => {
      mockSheetsService.update.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app)
        .put('/api/expenses/exp_1')
        .send({ amount: 600 });
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('DELETE /api/expenses/:id', () => {
    it('should delete an expense', async () => {
      const response = await request(app).delete('/api/expenses/exp_1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Expenses', 'exp_1');
    });
    
    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);
      
      const response = await request(app).delete('/api/expenses/non_existent');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
    
    it('should handle errors', async () => {
      mockSheetsService.delete.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).delete('/api/expenses/exp_1');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('GET /api/expenses/project/:projectId', () => {
    it('should return expenses for a specific project', async () => {
      const response = await request(app).get('/api/expenses/project/proj_1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].project_id).toBe('proj_1');
      expect(response.body.data[1].project_id).toBe('proj_1');
    });
    
    it('should return empty array for project with no expenses', async () => {
      const response = await request(app).get('/api/expenses/project/proj_3');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toHaveLength(0);
    });
    
    it('should handle errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/expenses/project/proj_1');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
  
  describe('GET /api/expenses/summary', () => {
    it('should return expense summary by category', async () => {
      const response = await request(app).get('/api/expenses/summary');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(800); // Sum of all expenses
      expect(response.body.data.byCategory).toHaveProperty('equipment', 500);
      expect(response.body.data.byCategory).toHaveProperty('software', 100);
      expect(response.body.data.byCategory).toHaveProperty('travel', 200);
    });
    
    it('should handle errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Test error'));
      
      const response = await request(app).get('/api/expenses/summary');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error');
    });
  });
});