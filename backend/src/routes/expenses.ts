import express, { Request, Response } from 'express';
import { createGoogleSheetsService } from '../services/googleSheets';
import { Expense, ExpenseSchema } from '../models/Expense';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Initialize Google Sheets service
const sheetsService = createGoogleSheetsService();
if (!sheetsService) {
  throw new Error('Failed to initialize Google Sheets service');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/receipts');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const filetypes = /jpeg|jpg|png|gif|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error('Only image and PDF files are allowed'));
  }
});

// Validation schemas
const createExpenseSchema = ExpenseSchema.omit({ id: true, created_at: true, updated_at: true });

const updateExpenseSchema = ExpenseSchema.partial().omit({ id: true, created_at: true, updated_at: true });

const getExpensesQuerySchema = z.object({
  project_id: z.string().optional(),
  category: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  min_amount: z.string().optional(),
  max_amount: z.string().optional()
});

/**
 * @route GET /api/expenses
 * @desc Get all expenses with optional filtering
 * @access Private
 */
router.get(
  '/',
  authMiddleware,
  validationMiddleware(getExpensesQuerySchema),
  async (req: Request, res: Response) => {
    try {
      // Get all expenses
      const allExpenses = await sheetsService.read('Expenses');
      let expenses = allExpenses.map(row => Expense.fromSheetRow(row));
      
      // Apply filters if provided
      if (req.query.project_id) {
        expenses = expenses.filter(expense => expense.project_id === req.query.project_id);
      }
      
      if (req.query.category) {
        expenses = expenses.filter(expense => expense.category === req.query.category);
      }
      
      if (req.query.start_date) {
        const startDate = new Date(req.query.start_date as string);
        expenses = expenses.filter(expense => expense.date >= startDate);
      }
      
      if (req.query.end_date) {
        const endDate = new Date(req.query.end_date as string);
        expenses = expenses.filter(expense => expense.date <= endDate);
      }
      
      if (req.query.min_amount) {
        const minAmount = parseFloat(req.query.min_amount as string);
        expenses = expenses.filter(expense => expense.amount >= minAmount);
      }
      
      if (req.query.max_amount) {
        const maxAmount = parseFloat(req.query.max_amount as string);
        expenses = expenses.filter(expense => expense.amount <= maxAmount);
      }
      
      res.json({
        success: true,
        count: expenses.length,
        data: expenses
      });
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch expenses'
      });
    }
  }
);

/**
 * @route GET /api/expenses/:id
 * @desc Get a single expense by ID
 * @access Private
 */
router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get expense by ID
      const expenseData = await sheetsService.read('Expenses', id);
      
      if (!expenseData || expenseData.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Expense with ID ${id} not found`
        });
      }
      
      const expense = Expense.fromSheetRow(expenseData[0]);
      
      res.json({
        success: true,
        data: expense
      });
    } catch (error: any) {
      console.error(`Error fetching expense ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch expense'
      });
    }
  }
);

/**
 * @route POST /api/expenses
 * @desc Create a new expense
 * @access Private
 */
router.post(
  '/',
  authMiddleware,
  upload.single('receipt'),
  validationMiddleware(createExpenseSchema),
  async (req: Request, res: Response) => {
    try {
      // Parse request body
      const expenseData = req.body;
      
      // Convert string date to Date object
      if (expenseData.date && typeof expenseData.date === 'string') {
        expenseData.date = new Date(expenseData.date);
      }
      
      // Convert amount to number
      if (expenseData.amount && typeof expenseData.amount === 'string') {
        expenseData.amount = parseFloat(expenseData.amount);
      }
      
      // Add receipt URL if file was uploaded
      if (req.file) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        expenseData.receipt_url = `${baseUrl}/uploads/receipts/${req.file.filename}`;
      }
      
      // Create expense object
      const expense = new Expense(expenseData);
      
      // Validate expense
      const validationResult = expense.validate();
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          errors: validationResult.errors
        });
      }
      
      // Save to Google Sheets
      const id = await sheetsService.create('Expenses', expense.toSheetRow());
      
      // Update expense with generated ID
      expense.id = id;
      
      res.status(201).json({
        success: true,
        data: expense
      });
    } catch (error: any) {
      console.error('Error creating expense:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create expense'
      });
    }
  }
);

/**
 * @route PUT /api/expenses/:id
 * @desc Update an expense
 * @access Private
 */
router.put(
  '/:id',
  authMiddleware,
  upload.single('receipt'),
  validationMiddleware(updateExpenseSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get existing expense
      const expenseData = await sheetsService.read('Expenses', id);
      
      if (!expenseData || expenseData.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Expense with ID ${id} not found`
        });
      }
      
      const existingExpense = Expense.fromSheetRow(expenseData[0]);
      
      // Update expense data
      const updateData = req.body;
      
      // Convert string date to Date object
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      
      // Convert amount to number
      if (updateData.amount && typeof updateData.amount === 'string') {
        updateData.amount = parseFloat(updateData.amount);
      }
      
      // Add receipt URL if file was uploaded
      if (req.file) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        updateData.receipt_url = `${baseUrl}/uploads/receipts/${req.file.filename}`;
      }
      
      // Create updated expense object
      const updatedExpense = new Expense({
        ...existingExpense,
        ...updateData,
        id,
        updated_at: new Date()
      });
      
      // Validate expense
      const validationResult = updatedExpense.validate();
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          errors: validationResult.errors
        });
      }
      
      // Save to Google Sheets
      await sheetsService.update('Expenses', id, updatedExpense.toSheetRow());
      
      res.json({
        success: true,
        data: updatedExpense
      });
    } catch (error: any) {
      console.error(`Error updating expense ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update expense'
      });
    }
  }
);

/**
 * @route DELETE /api/expenses/:id
 * @desc Delete an expense
 * @access Private
 */
router.delete(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if expense exists
      const expenseData = await sheetsService.read('Expenses', id);
      
      if (!expenseData || expenseData.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Expense with ID ${id} not found`
        });
      }
      
      // Delete from Google Sheets
      await sheetsService.delete('Expenses', id);
      
      res.json({
        success: true,
        message: `Expense with ID ${id} deleted successfully`
      });
    } catch (error: any) {
      console.error(`Error deleting expense ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete expense'
      });
    }
  }
);

/**
 * @route GET /api/expenses/project/:projectId
 * @desc Get all expenses for a specific project
 * @access Private
 */
router.get(
  '/project/:projectId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      // Get all expenses
      const allExpenses = await sheetsService.read('Expenses');
      
      // Filter by project ID
      const projectExpenses = allExpenses
        .map(row => Expense.fromSheetRow(row))
        .filter(expense => expense.project_id === projectId);
      
      res.json({
        success: true,
        count: projectExpenses.length,
        data: projectExpenses
      });
    } catch (error: any) {
      console.error(`Error fetching expenses for project ${req.params.projectId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch project expenses'
      });
    }
  }
);

/**
 * @route GET /api/expenses/summary
 * @desc Get expense summary (total by category)
 * @access Private
 */
router.get(
  '/summary',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Get all expenses
      const allExpenses = await sheetsService.read('Expenses');
      const expenses = allExpenses.map(row => Expense.fromSheetRow(row));
      
      // Group by category
      const categorySummary: Record<string, number> = {};
      
      expenses.forEach(expense => {
        if (!categorySummary[expense.category]) {
          categorySummary[expense.category] = 0;
        }
        categorySummary[expense.category] += expense.amount;
      });
      
      // Calculate total
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      res.json({
        success: true,
        data: {
          total: totalExpenses,
          byCategory: categorySummary
        }
      });
    } catch (error: any) {
      console.error('Error generating expense summary:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate expense summary'
      });
    }
  }
);

export default router;