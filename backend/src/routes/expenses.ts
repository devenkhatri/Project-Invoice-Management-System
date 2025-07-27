import express from 'express';
import { SheetsService } from '../services/sheets.service';
import { Expense } from '../models/Expense';
import { validateExpense } from '../validation/schemas';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { ExpenseCategory } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for expense creation/update
const expenseValidation = [
  body('project_id').isString().notEmpty().withMessage('Project ID is required'),
  body('category').isIn(Object.values(ExpenseCategory)).withMessage('Invalid expense category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('description').isString().notEmpty().withMessage('Description is required'),
  body('date').isISO8601().withMessage('Date must be in ISO format'),
  body('receipt_url').optional().isURL().withMessage('Receipt URL must be valid'),
  body('vendor').optional().isString(),
  body('is_billable').optional().isBoolean(),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('reimbursable').optional().isBoolean(),
];

// Query validation for filtering
const queryValidation = [
  query('project_id').optional().isString(),
  query('category').optional().isIn(Object.values(ExpenseCategory)),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('is_billable').optional().isBoolean(),
  query('approval_status').optional().isIn(['pending', 'approved', 'rejected']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
];

// POST /api/expenses - Create new expense
router.post('/', expenseValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    
    // Validate expense data
    const validation = validateExpense(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Create expense instance
    const expense = new Expense(validation.data);
    
    // Calculate tax amount if tax rate is provided
    if (expense.tax_rate) {
      expense.updateTaxAmount();
    }

    // Save to Google Sheets
    const expenseId = await sheetsService.create('Expenses', expense.toJSON());
    
    // Fetch the created expense
    const createdExpenses = await sheetsService.read('Expenses', expenseId);
    const createdExpense = createdExpenses[0];

    res.status(201).json({
      message: 'Expense created successfully',
      expense: createdExpense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      error: 'Failed to create expense',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/expenses - List expenses with filtering
router.get('/', queryValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const {
      project_id,
      category,
      start_date,
      end_date,
      is_billable,
      approval_status,
      limit = 50,
      offset = 0
    } = req.query;

    // Build query filters
    const filters: any = {};
    
    if (project_id) filters.project_id = project_id;
    if (category) filters.category = category;
    if (is_billable !== undefined) filters.is_billable = is_billable === 'true';
    if (approval_status) filters.approval_status = approval_status;
    
    // Date range filtering
    if (start_date || end_date) {
      filters.date = {};
      if (start_date) filters.date['>='] = start_date;
      if (end_date) filters.date['<='] = end_date;
    }

    // Query expenses
    let expenses = await sheetsService.query('Expenses', filters);
    
    // Apply pagination
    const total = expenses.length;
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    expenses = expenses.slice(startIndex, endIndex);

    // Convert to Expense instances for business logic
    const expenseInstances = expenses.map(data => new Expense(data));

    // Calculate summary statistics
    const summary = {
      total_count: total,
      total_amount: Expense.calculateTotalAmount(expenseInstances),
      billable_amount: Expense.calculateBillableAmount(expenseInstances),
      reimbursable_amount: Expense.calculateReimbursableAmount(expenseInstances),
      by_category: Expense.calculateTotalByCategory(expenseInstances),
      by_approval_status: {
        pending: expenseInstances.filter(e => e.isPending()).length,
        approved: expenseInstances.filter(e => e.isApproved()).length,
        rejected: expenseInstances.filter(e => e.isRejected()).length
      }
    };

    res.json({
      expenses: expenses,
      summary,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total,
        has_more: endIndex < total
      }
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      error: 'Failed to fetch expenses',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', param('id').isString(), validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { id } = req.params;

    const expenses = await sheetsService.read('Expenses', id);
    
    if (expenses.length === 0) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    const expense = new Expense(expenses[0]);

    res.json({
      expense: expense.toJSON()
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      error: 'Failed to fetch expense',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', 
  param('id').isString(),
  expenseValidation,
  validateRequest,
  async (req, res) => {
    try {
      const sheetsService = SheetsService.getInstance();
      const { id } = req.params;

      // Check if expense exists
      const existingExpenses = await sheetsService.read('Expenses', id);
      if (existingExpenses.length === 0) {
        return res.status(404).json({
          error: 'Expense not found'
        });
      }

      // Validate updated data
      const validation = validateExpense({
        ...existingExpenses[0],
        ...req.body
      });
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Create updated expense instance
      const updatedExpense = new Expense(validation.data);
      
      // Recalculate tax if tax rate changed
      if (updatedExpense.tax_rate) {
        updatedExpense.updateTaxAmount();
      }

      // Update in Google Sheets
      const success = await sheetsService.update('Expenses', id, updatedExpense.toJSON());
      
      if (!success) {
        return res.status(404).json({
          error: 'Expense not found'
        });
      }

      // Fetch updated expense
      const updatedExpenses = await sheetsService.read('Expenses', id);
      
      res.json({
        message: 'Expense updated successfully',
        expense: updatedExpenses[0]
      });
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({
        error: 'Failed to update expense',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', param('id').isString(), validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { id } = req.params;

    // Check if expense exists and is not billed
    const existingExpenses = await sheetsService.read('Expenses', id);
    if (existingExpenses.length === 0) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    const expense = new Expense(existingExpenses[0]);
    
    // Prevent deletion of billed expenses
    if (expense.isBilled()) {
      return res.status(400).json({
        error: 'Cannot delete expense that has been billed',
        message: 'This expense is associated with an invoice and cannot be deleted'
      });
    }

    // Delete from Google Sheets
    const success = await sheetsService.delete('Expenses', id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    res.json({
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      error: 'Failed to delete expense',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/expenses/:id/approve - Approve expense
router.post('/:id/approve', 
  param('id').isString(),
  body('approved_by').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const sheetsService = SheetsService.getInstance();
      const { id } = req.params;
      const { approved_by } = req.body;

      // Get existing expense
      const existingExpenses = await sheetsService.read('Expenses', id);
      if (existingExpenses.length === 0) {
        return res.status(404).json({
          error: 'Expense not found'
        });
      }

      const expense = new Expense(existingExpenses[0]);
      
      // Approve the expense
      expense.approve(approved_by);

      // Update in Google Sheets
      const success = await sheetsService.update('Expenses', id, expense.toJSON());
      
      if (!success) {
        return res.status(404).json({
          error: 'Expense not found'
        });
      }

      res.json({
        message: 'Expense approved successfully',
        expense: expense.toJSON()
      });
    } catch (error) {
      console.error('Error approving expense:', error);
      res.status(500).json({
        error: 'Failed to approve expense',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// POST /api/expenses/:id/reject - Reject expense
router.post('/:id/reject', param('id').isString(), validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { id } = req.params;

    // Get existing expense
    const existingExpenses = await sheetsService.read('Expenses', id);
    if (existingExpenses.length === 0) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    const expense = new Expense(existingExpenses[0]);
    
    // Reject the expense
    expense.reject();

    // Update in Google Sheets
    const success = await sheetsService.update('Expenses', id, expense.toJSON());
    
    if (!success) {
      return res.status(404).json({
        error: 'Expense not found'
      });
    }

    res.json({
      message: 'Expense rejected successfully',
      expense: expense.toJSON()
    });
  } catch (error) {
    console.error('Error rejecting expense:', error);
    res.status(500).json({
      error: 'Failed to reject expense',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/expenses/categories/summary - Get expense summary by category
router.get('/categories/summary', queryValidation, validateRequest, async (req, res) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const { start_date, end_date, project_id } = req.query;

    // Build query filters
    const filters: any = {};
    if (project_id) filters.project_id = project_id;
    if (start_date || end_date) {
      filters.date = {};
      if (start_date) filters.date['>='] = start_date;
      if (end_date) filters.date['<='] = end_date;
    }

    const expenses = await sheetsService.query('Expenses', filters);
    const expenseInstances = expenses.map(data => new Expense(data));

    const summary = {
      total_amount: Expense.calculateTotalAmount(expenseInstances),
      by_category: Expense.calculateTotalByCategory(expenseInstances),
      by_project: Expense.groupByProject(expenseInstances),
      deductible_amount: expenseInstances
        .filter(e => e.isDeductible())
        .reduce((sum, e) => sum + e.calculateTotalAmount(), 0)
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({
      error: 'Failed to fetch expense summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;