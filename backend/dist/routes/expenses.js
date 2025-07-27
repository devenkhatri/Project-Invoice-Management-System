"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sheets_service_1 = require("../services/sheets.service");
const Expense_1 = require("../models/Expense");
const schemas_1 = require("../validation/schemas");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const express_validator_1 = require("express-validator");
const types_1 = require("../types");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
const expenseValidation = [
    (0, express_validator_1.body)('project_id').isString().notEmpty().withMessage('Project ID is required'),
    (0, express_validator_1.body)('category').isIn(Object.values(types_1.ExpenseCategory)).withMessage('Invalid expense category'),
    (0, express_validator_1.body)('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    (0, express_validator_1.body)('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    (0, express_validator_1.body)('description').isString().notEmpty().withMessage('Description is required'),
    (0, express_validator_1.body)('date').isISO8601().withMessage('Date must be in ISO format'),
    (0, express_validator_1.body)('receipt_url').optional().isURL().withMessage('Receipt URL must be valid'),
    (0, express_validator_1.body)('vendor').optional().isString(),
    (0, express_validator_1.body)('is_billable').optional().isBoolean(),
    (0, express_validator_1.body)('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
    (0, express_validator_1.body)('reimbursable').optional().isBoolean(),
];
const queryValidation = [
    (0, express_validator_1.query)('project_id').optional().isString(),
    (0, express_validator_1.query)('category').optional().isIn(Object.values(types_1.ExpenseCategory)),
    (0, express_validator_1.query)('start_date').optional().isISO8601(),
    (0, express_validator_1.query)('end_date').optional().isISO8601(),
    (0, express_validator_1.query)('is_billable').optional().isBoolean(),
    (0, express_validator_1.query)('approval_status').optional().isIn(['pending', 'approved', 'rejected']),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }),
];
router.post('/', expenseValidation, validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const validation = (0, schemas_1.validateExpense)(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.errors
            });
        }
        const expense = new Expense_1.Expense(validation.data);
        if (expense.tax_rate) {
            expense.updateTaxAmount();
        }
        const expenseId = await sheetsService.create('Expenses', expense.toJSON());
        const createdExpenses = await sheetsService.read('Expenses', expenseId);
        const createdExpense = createdExpenses[0];
        res.status(201).json({
            message: 'Expense created successfully',
            expense: createdExpense
        });
    }
    catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({
            error: 'Failed to create expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/', queryValidation, validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { project_id, category, start_date, end_date, is_billable, approval_status, limit = 50, offset = 0 } = req.query;
        const filters = {};
        if (project_id)
            filters.project_id = project_id;
        if (category)
            filters.category = category;
        if (is_billable !== undefined)
            filters.is_billable = is_billable === 'true';
        if (approval_status)
            filters.approval_status = approval_status;
        if (start_date || end_date) {
            filters.date = {};
            if (start_date)
                filters.date['>='] = start_date;
            if (end_date)
                filters.date['<='] = end_date;
        }
        let expenses = await sheetsService.query('Expenses', filters);
        const total = expenses.length;
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        expenses = expenses.slice(startIndex, endIndex);
        const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
        const summary = {
            total_count: total,
            total_amount: Expense_1.Expense.calculateTotalAmount(expenseInstances),
            billable_amount: Expense_1.Expense.calculateBillableAmount(expenseInstances),
            reimbursable_amount: Expense_1.Expense.calculateReimbursableAmount(expenseInstances),
            by_category: Expense_1.Expense.calculateTotalByCategory(expenseInstances),
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
                limit: parseInt(limit),
                offset: parseInt(offset),
                total,
                has_more: endIndex < total
            }
        });
    }
    catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({
            error: 'Failed to fetch expenses',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', (0, express_validator_1.param)('id').isString(), validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { id } = req.params;
        const expenses = await sheetsService.read('Expenses', id);
        if (expenses.length === 0) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const expense = new Expense_1.Expense(expenses[0]);
        res.json({
            expense: expense.toJSON()
        });
    }
    catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({
            error: 'Failed to fetch expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', (0, express_validator_1.param)('id').isString(), expenseValidation, validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { id } = req.params;
        const existingExpenses = await sheetsService.read('Expenses', id);
        if (existingExpenses.length === 0) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const validation = (0, schemas_1.validateExpense)({
            ...existingExpenses[0],
            ...req.body
        });
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.errors
            });
        }
        const updatedExpense = new Expense_1.Expense(validation.data);
        if (updatedExpense.tax_rate) {
            updatedExpense.updateTaxAmount();
        }
        const success = await sheetsService.update('Expenses', id, updatedExpense.toJSON());
        if (!success) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const updatedExpenses = await sheetsService.read('Expenses', id);
        res.json({
            message: 'Expense updated successfully',
            expense: updatedExpenses[0]
        });
    }
    catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({
            error: 'Failed to update expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/:id', (0, express_validator_1.param)('id').isString(), validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { id } = req.params;
        const existingExpenses = await sheetsService.read('Expenses', id);
        if (existingExpenses.length === 0) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const expense = new Expense_1.Expense(existingExpenses[0]);
        if (expense.isBilled()) {
            return res.status(400).json({
                error: 'Cannot delete expense that has been billed',
                message: 'This expense is associated with an invoice and cannot be deleted'
            });
        }
        const success = await sheetsService.delete('Expenses', id);
        if (!success) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        res.json({
            message: 'Expense deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({
            error: 'Failed to delete expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/approve', (0, express_validator_1.param)('id').isString(), (0, express_validator_1.body)('approved_by').isString().notEmpty(), validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { id } = req.params;
        const { approved_by } = req.body;
        const existingExpenses = await sheetsService.read('Expenses', id);
        if (existingExpenses.length === 0) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const expense = new Expense_1.Expense(existingExpenses[0]);
        expense.approve(approved_by);
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
    }
    catch (error) {
        console.error('Error approving expense:', error);
        res.status(500).json({
            error: 'Failed to approve expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/reject', (0, express_validator_1.param)('id').isString(), validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { id } = req.params;
        const existingExpenses = await sheetsService.read('Expenses', id);
        if (existingExpenses.length === 0) {
            return res.status(404).json({
                error: 'Expense not found'
            });
        }
        const expense = new Expense_1.Expense(existingExpenses[0]);
        expense.reject();
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
    }
    catch (error) {
        console.error('Error rejecting expense:', error);
        res.status(500).json({
            error: 'Failed to reject expense',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/categories/summary', queryValidation, validation_1.validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const { start_date, end_date, project_id } = req.query;
        const filters = {};
        if (project_id)
            filters.project_id = project_id;
        if (start_date || end_date) {
            filters.date = {};
            if (start_date)
                filters.date['>='] = start_date;
            if (end_date)
                filters.date['<='] = end_date;
        }
        const expenses = await sheetsService.query('Expenses', filters);
        const expenseInstances = expenses.map(data => new Expense_1.Expense(data));
        const summary = {
            total_amount: Expense_1.Expense.calculateTotalAmount(expenseInstances),
            by_category: Expense_1.Expense.calculateTotalByCategory(expenseInstances),
            by_project: Expense_1.Expense.groupByProject(expenseInstances),
            deductible_amount: expenseInstances
                .filter(e => e.isDeductible())
                .reduce((sum, e) => sum + e.calculateTotalAmount(), 0)
        };
        res.json(summary);
    }
    catch (error) {
        console.error('Error fetching expense summary:', error);
        res.status(500).json({
            error: 'Failed to fetch expense summary',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=expenses.js.map