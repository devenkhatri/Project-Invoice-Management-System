import { Expense } from '../Expense';
import { ExpenseCategory } from '../types';

describe('Expense Model', () => {
  const validExpenseData = {
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    category: ExpenseCategory.EQUIPMENT,
    amount: 2500.50,
    description: 'New laptop for development',
    date: new Date('2024-01-15'),
    receipt_url: 'https://example.com/receipt.pdf'
  };

  describe('Constructor', () => {
    it('should create an expense with valid data', () => {
      const expense = new Expense(validExpenseData);
      
      expect(expense.project_id).toBe(validExpenseData.project_id);
      expect(expense.category).toBe(validExpenseData.category);
      expect(expense.amount).toBe(validExpenseData.amount);
      expect(expense.description).toBe(validExpenseData.description);
      expect(expense.id).toBeDefined();
      expect(expense.id).toMatch(/^exp_/);
    });

    it('should set default values correctly', () => {
      const expense = new Expense({
        project_id: validExpenseData.project_id,
        description: 'Test expense'
      });
      
      expect(expense.category).toBe(ExpenseCategory.OTHER);
      expect(expense.amount).toBe(0);
      expect(expense.receipt_url).toBe('');
    });
  });

  describe('Validation', () => {
    it('should validate a valid expense', () => {
      const expense = new Expense(validExpenseData);
      const result = expense.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for empty project_id', () => {
      const expense = new Expense({ ...validExpenseData, project_id: '' });
      const result = expense.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'project_id',
          message: 'Project ID is required'
        })
      );
    });

    it('should fail validation for zero amount', () => {
      const expense = new Expense({ ...validExpenseData, amount: 0 });
      const result = expense.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'amount',
          message: 'Amount must be greater than 0'
        })
      );
    });

    it('should fail validation for empty description', () => {
      const expense = new Expense({ ...validExpenseData, description: '' });
      const result = expense.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'description',
          message: 'Description is required'
        })
      );
    });

    it('should fail validation for invalid receipt URL', () => {
      const expense = new Expense({ ...validExpenseData, receipt_url: 'invalid-url' });
      const result = expense.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'receipt_url',
          message: 'Invalid input'
        })
      );
    });

    it('should pass validation with empty receipt URL (optional field)', () => {
      const expense = new Expense({ ...validExpenseData, receipt_url: '' });
      const result = expense.validate();
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Business Logic Methods', () => {
    let expense: Expense;

    beforeEach(() => {
      expense = new Expense(validExpenseData);
    });

    it('should correctly identify if expense has receipt', () => {
      expect(expense.hasReceipt()).toBe(true);
      
      expense.receipt_url = '';
      expect(expense.hasReceipt()).toBe(false);
    });

    it('should correctly identify if expense is today', () => {
      const today = new Date();
      expense.date = today;
      expect(expense.isToday()).toBe(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expense.date = yesterday;
      expect(expense.isToday()).toBe(false);
    });

    it('should correctly identify if expense is this month', () => {
      const today = new Date();
      expense.date = today;
      expect(expense.isThisMonth()).toBe(true);

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      expense.date = lastMonth;
      expect(expense.isThisMonth()).toBe(false);
    });

    it('should correctly identify if expense is this year', () => {
      const today = new Date();
      expense.date = today;
      expect(expense.isThisYear()).toBe(true);

      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      expense.date = lastYear;
      expect(expense.isThisYear()).toBe(false);
    });

    it('should format amount correctly', () => {
      expense.amount = 2500.50;
      const formatted = expense.getFormattedAmount();
      expect(formatted).toMatch(/₹.*2,500\.50/);
    });

    it('should get category display name correctly', () => {
      expense.category = ExpenseCategory.EQUIPMENT;
      expect(expense.getCategoryDisplayName()).toBe('Equipment');
      
      expense.category = ExpenseCategory.SOFTWARE;
      expect(expense.getCategoryDisplayName()).toBe('Software');
    });

    it('should update amount correctly', () => {
      expense.updateAmount(3000);
      expect(expense.amount).toBe(3000);
    });

    it('should throw error for zero or negative amount when updating', () => {
      expect(() => expense.updateAmount(0)).toThrow('Amount must be greater than 0');
      expect(() => expense.updateAmount(-100)).toThrow('Amount must be greater than 0');
    });

    it('should update category correctly', () => {
      expense.updateCategory(ExpenseCategory.TRAVEL);
      expect(expense.category).toBe(ExpenseCategory.TRAVEL);
    });

    it('should update description correctly', () => {
      const newDescription = 'Updated expense description';
      expense.updateDescription(newDescription);
      expect(expense.description).toBe(newDescription);
    });

    it('should throw error for empty description when updating', () => {
      expect(() => expense.updateDescription('')).toThrow('Description cannot be empty');
      expect(() => expense.updateDescription('   ')).toThrow('Description cannot be empty');
    });

    it('should update receipt URL correctly', () => {
      const newUrl = 'https://example.com/new-receipt.pdf';
      expense.updateReceiptUrl(newUrl);
      expect(expense.receipt_url).toBe(newUrl);
    });

    it('should update date correctly', () => {
      const newDate = new Date('2024-02-15');
      expense.updateDate(newDate);
      expect(expense.date).toEqual(newDate);
    });

    it('should check if expense is within date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      expense.date = new Date('2024-01-15');
      
      expect(expense.isWithinDateRange(startDate, endDate)).toBe(true);

      expense.date = new Date('2024-02-15');
      expect(expense.isWithinDateRange(startDate, endDate)).toBe(false);
    });

    it('should correctly identify tax deductible expenses', () => {
      expense.category = ExpenseCategory.EQUIPMENT;
      expect(expense.isTaxDeductible()).toBe(true);
      
      expense.category = ExpenseCategory.MARKETING;
      expect(expense.isTaxDeductible()).toBe(false);
      
      expense.category = ExpenseCategory.SOFTWARE;
      expect(expense.isTaxDeductible()).toBe(true);
    });
  });

  describe('Static Methods', () => {
    const expenses = [
      new Expense({ ...validExpenseData, amount: 1000, category: ExpenseCategory.EQUIPMENT }),
      new Expense({ ...validExpenseData, amount: 500, category: ExpenseCategory.TRAVEL }),
      new Expense({ ...validExpenseData, amount: 750, category: ExpenseCategory.EQUIPMENT })
    ];

    it('should calculate total expenses correctly', () => {
      const total = Expense.calculateTotal(expenses);
      expect(total).toBe(2250);
    });

    it('should group expenses by category correctly', () => {
      const grouped = Expense.groupByCategory(expenses);
      
      expect(grouped.size).toBe(2);
      expect(grouped.get(ExpenseCategory.EQUIPMENT)).toHaveLength(2);
      expect(grouped.get(ExpenseCategory.TRAVEL)).toHaveLength(1);
    });

    it('should filter expenses by date range correctly', () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-20');
      
      expenses[0].date = new Date('2024-01-15');
      expenses[1].date = new Date('2024-01-25'); // Outside range
      expenses[2].date = new Date('2024-01-12');
      
      const filtered = Expense.filterByDateRange(expenses, startDate, endDate);
      expect(filtered).toHaveLength(2);
    });

    it('should filter expenses by category correctly', () => {
      const filtered = Expense.filterByCategory(expenses, ExpenseCategory.EQUIPMENT);
      expect(filtered).toHaveLength(2);
    });

    it('should get tax deductible expenses correctly', () => {
      const taxDeductible = Expense.getTaxDeductible(expenses);
      expect(taxDeductible).toHaveLength(3); // EQUIPMENT and TRAVEL are both deductible
    });
  });

  describe('Sheet Operations', () => {
    it('should convert to sheet row correctly', () => {
      const expense = new Expense(validExpenseData);
      const row = expense.toSheetRow();
      
      expect(row.project_id).toBe(expense.project_id);
      expect(row.category).toBe(expense.category);
      expect(row.amount).toBe(expense.amount);
      expect(row.description).toBe(expense.description);
      expect(typeof row.date).toBe('string');
    });

    it('should create from sheet row correctly', () => {
      const sheetRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: '123e4567-e89b-12d3-a456-426614174001',
        category: 'software',
        amount: '1500.75',
        description: 'Sheet expense',
        date: '2024-01-15T00:00:00.000Z',
        receipt_url: 'https://example.com/receipt.pdf',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };
      
      const expense = Expense.fromSheetRow(sheetRow);
      
      expect(expense.id).toBe(sheetRow.id);
      expect(expense.project_id).toBe(sheetRow.project_id);
      expect(expense.amount).toBe(1500.75);
      expect(expense.category).toBe(ExpenseCategory.SOFTWARE);
      expect(expense.date).toBeInstanceOf(Date);
    });
  });
});