import request from 'supertest';
import express from 'express';
import expenseRoutes from '../expenses';
import { SheetsService } from '../../services/sheets.service';
import { Expense } from '../../models/Expense';
import { ExpenseCategory } from '../../types';

// Mock the SheetsService
jest.mock('../../services/sheets.service');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user1', email: 'test@example.com', role: 'admin' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/expenses', expenseRoutes);

const mockSheetsService = {
  getInstance: jest.fn(),
  create: jest.fn(),
  read: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn()
};

(SheetsService.getInstance as jest.Mock).mockReturnValue(mockSheetsService);

describe('Expense Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/expenses', () => {
    const validExpenseData = {
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100.50,
      currency: 'INR',
      description: 'Office supplies',
      date: '2024-01-15',
      is_billable: false,
      reimbursable: true
    };

    it('should create a new expense successfully', async () => {
      const expenseId = 'expense1';
      const createdExpense = { id: expenseId, ...validExpenseData };

      mockSheetsService.create.mockResolvedValue(expenseId);
      mockSheetsService.read.mockResolvedValue([createdExpense]);

      const response = await request(app)
        .post('/api/expenses')
        .send(validExpenseData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Expense created successfully');
      expect(response.body.expense).toEqual(createdExpense);
      expect(mockSheetsService.create).toHaveBeenCalledWith('Expenses', expect.any(Object));
    });

    it('should return 400 for invalid expense data', async () => {
      const invalidData = {
        ...validExpenseData,
        amount: -50 // Invalid negative amount
      };

      const response = await request(app)
        .post('/api/expenses')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        amount: 100,
        description: 'Test expense'
        // Missing project_id, category, date
      };

      const response = await request(app)
        .post('/api/expenses')
        .send(incompleteData);

      expect(response.status).toBe(400);
    });

    it('should calculate tax amount when tax rate is provided', async () => {
      const expenseWithTax = {
        ...validExpenseData,
        tax_rate: 18
      };

      const expenseId = 'expense1';
      mockSheetsService.create.mockResolvedValue(expenseId);
      mockSheetsService.read.mockResolvedValue([{ id: expenseId, ...expenseWithTax }]);

      const response = await request(app)
        .post('/api/expenses')
        .send(expenseWithTax);

      expect(response.status).toBe(201);
      expect(mockSheetsService.create).toHaveBeenCalledWith(
        'Expenses',
        expect.objectContaining({
          tax_rate: 18,
          tax_amount: expect.any(Number)
        })
      );
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.create.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .post('/api/expenses')
        .send(validExpenseData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create expense');
    });
  });

  describe('GET /api/expenses', () => {
    const mockExpenses = [
      {
        id: 'expense1',
        project_id: 'project1',
        category: ExpenseCategory.OFFICE,
        amount: 100,
        currency: 'INR',
        description: 'Office supplies',
        date: '2024-01-15',
        is_billable: false,
        reimbursable: true,
        approval_status: 'approved'
      },
      {
        id: 'expense2',
        project_id: 'project2',
        category: ExpenseCategory.TRAVEL,
        amount: 500,
        currency: 'INR',
        description: 'Travel expenses',
        date: '2024-01-16',
        is_billable: true,
        reimbursable: false,
        approval_status: 'pending'
      }
    ];

    it('should return all expenses with summary', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses');

      expect(response.status).toBe(200);
      expect(response.body.expenses).toEqual(mockExpenses);
      expect(response.body.summary).toHaveProperty('total_count', 2);
      expect(response.body.summary).toHaveProperty('total_amount');
      expect(response.body.summary).toHaveProperty('by_category');
      expect(response.body.pagination).toHaveProperty('total', 2);
    });

    it('should filter expenses by project_id', async () => {
      const filteredExpenses = [mockExpenses[0]];
      mockSheetsService.query.mockResolvedValue(filteredExpenses);

      const response = await request(app)
        .get('/api/expenses')
        .query({ project_id: 'project1' });

      expect(response.status).toBe(200);
      expect(response.body.expenses).toEqual(filteredExpenses);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Expenses', 
        expect.objectContaining({ project_id: 'project1' })
      );
    });

    it('should filter expenses by category', async () => {
      const filteredExpenses = [mockExpenses[1]];
      mockSheetsService.query.mockResolvedValue(filteredExpenses);

      const response = await request(app)
        .get('/api/expenses')
        .query({ category: ExpenseCategory.TRAVEL });

      expect(response.status).toBe(200);
      expect(response.body.expenses).toEqual(filteredExpenses);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Expenses',
        expect.objectContaining({ category: ExpenseCategory.TRAVEL })
      );
    });

    it('should filter expenses by date range', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses')
        .query({ 
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Expenses',
        expect.objectContaining({
          date: { '>=': '2024-01-01', '<=': '2024-01-31' }
        })
      );
    });

    it('should apply pagination', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses')
        .query({ limit: 1, offset: 1 });

      expect(response.status).toBe(200);
      expect(response.body.expenses).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(1);
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.query.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .get('/api/expenses');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch expenses');
    });
  });

  describe('GET /api/expenses/:id', () => {
    const mockExpense = {
      id: 'expense1',
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100,
      description: 'Office supplies',
      date: '2024-01-15'
    };

    it('should return a single expense', async () => {
      mockSheetsService.read.mockResolvedValue([mockExpense]);

      const response = await request(app)
        .get('/api/expenses/expense1');

      expect(response.status).toBe(200);
      expect(response.body.expense).toMatchObject(mockExpense);
      expect(mockSheetsService.read).toHaveBeenCalledWith('Expenses', 'expense1');
    });

    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/expenses/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Expense not found');
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .get('/api/expenses/expense1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch expense');
    });
  });

  describe('PUT /api/expenses/:id', () => {
    const existingExpense = {
      id: 'expense1',
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100,
      description: 'Office supplies',
      date: '2024-01-15',
      approval_status: 'pending'
    };

    const updateData = {
      amount: 150,
      description: 'Updated office supplies'
    };

    it('should update an expense successfully', async () => {
      const updatedExpense = { ...existingExpense, ...updateData };
      
      mockSheetsService.read
        .mockResolvedValueOnce([existingExpense])
        .mockResolvedValueOnce([updatedExpense]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/expenses/expense1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Expense updated successfully');
      expect(response.body.expense).toMatchObject(updatedExpense);
      expect(mockSheetsService.update).toHaveBeenCalledWith('Expenses', 'expense1', expect.any(Object));
    });

    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/expenses/nonexistent')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Expense not found');
    });

    it('should return 400 for invalid update data', async () => {
      mockSheetsService.read.mockResolvedValue([existingExpense]);

      const invalidUpdate = {
        amount: -50 // Invalid negative amount
      };

      const response = await request(app)
        .put('/api/expenses/expense1')
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.read.mockResolvedValue([existingExpense]);
      mockSheetsService.update.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .put('/api/expenses/expense1')
        .send(updateData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update expense');
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    const mockExpense = {
      id: 'expense1',
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100,
      description: 'Office supplies',
      date: '2024-01-15',
      invoice_id: null // Not billed
    };

    it('should delete an expense successfully', async () => {
      mockSheetsService.read.mockResolvedValue([mockExpense]);
      mockSheetsService.delete.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/expenses/expense1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Expense deleted successfully');
      expect(mockSheetsService.delete).toHaveBeenCalledWith('Expenses', 'expense1');
    });

    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .delete('/api/expenses/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Expense not found');
    });

    it('should prevent deletion of billed expenses', async () => {
      const billedExpense = { ...mockExpense, invoice_id: 'invoice1' };
      mockSheetsService.read.mockResolvedValue([billedExpense]);

      const response = await request(app)
        .delete('/api/expenses/expense1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete expense that has been billed');
      expect(mockSheetsService.delete).not.toHaveBeenCalled();
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.read.mockResolvedValue([mockExpense]);
      mockSheetsService.delete.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .delete('/api/expenses/expense1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete expense');
    });
  });

  describe('POST /api/expenses/:id/approve', () => {
    const mockExpense = {
      id: 'expense1',
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100,
      description: 'Office supplies',
      date: '2024-01-15',
      approval_status: 'pending'
    };

    it('should approve an expense successfully', async () => {
      mockSheetsService.read.mockResolvedValue([mockExpense]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/expenses/expense1/approve')
        .send({ approved_by: 'manager1' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Expense approved successfully');
      expect(mockSheetsService.update).toHaveBeenCalledWith('Expenses', 'expense1', 
        expect.objectContaining({
          approval_status: 'approved',
          approved_by: 'manager1'
        })
      );
    });

    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/expenses/nonexistent/approve')
        .send({ approved_by: 'manager1' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Expense not found');
    });

    it('should return 400 for missing approved_by', async () => {
      const response = await request(app)
        .post('/api/expenses/expense1/approve')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/expenses/:id/reject', () => {
    const mockExpense = {
      id: 'expense1',
      project_id: 'project1',
      category: ExpenseCategory.OFFICE,
      amount: 100,
      description: 'Office supplies',
      date: '2024-01-15',
      approval_status: 'pending'
    };

    it('should reject an expense successfully', async () => {
      mockSheetsService.read.mockResolvedValue([mockExpense]);
      mockSheetsService.update.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/expenses/expense1/reject');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Expense rejected successfully');
      expect(mockSheetsService.update).toHaveBeenCalledWith('Expenses', 'expense1',
        expect.objectContaining({
          approval_status: 'rejected'
        })
      );
    });

    it('should return 404 for non-existent expense', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/expenses/nonexistent/reject');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Expense not found');
    });
  });

  describe('GET /api/expenses/categories/summary', () => {
    const mockExpenses = [
      {
        id: 'expense1',
        project_id: 'project1',
        category: ExpenseCategory.OFFICE,
        amount: 100,
        currency: 'INR',
        description: 'Office supplies',
        date: '2024-01-15',
        is_billable: false,
        tax_rate: 18,
        tax_amount: 18,
        reimbursable: true,
        approval_status: 'approved'
      },
      {
        id: 'expense2',
        project_id: 'project1',
        category: ExpenseCategory.TRAVEL,
        amount: 500,
        currency: 'INR',
        description: 'Travel expenses',
        date: '2024-01-16',
        is_billable: true,
        reimbursable: false,
        approval_status: 'approved'
      }
    ];

    it('should return expense summary by category', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses/categories/summary');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_amount');
      expect(response.body).toHaveProperty('by_category');
      expect(response.body).toHaveProperty('by_project');
      expect(response.body).toHaveProperty('deductible_amount');
    });

    it('should filter summary by date range', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses/categories/summary')
        .query({
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Expenses',
        expect.objectContaining({
          date: { '>=': '2024-01-01', '<=': '2024-01-31' }
        })
      );
    });

    it('should filter summary by project', async () => {
      mockSheetsService.query.mockResolvedValue(mockExpenses);

      const response = await request(app)
        .get('/api/expenses/categories/summary')
        .query({ project_id: 'project1' });

      expect(response.status).toBe(200);
      expect(mockSheetsService.query).toHaveBeenCalledWith('Expenses',
        expect.objectContaining({ project_id: 'project1' })
      );
    });

    it('should handle sheets service errors', async () => {
      mockSheetsService.query.mockRejectedValue(new Error('Sheets API error'));

      const response = await request(app)
        .get('/api/expenses/categories/summary');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch expense summary');
    });
  });
});