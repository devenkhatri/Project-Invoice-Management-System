import { Expense } from '../Expense';
import { ExpenseCategory } from '../../types';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';

describe('Expense Model', () => {
  const validExpenseData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    project_id: '550e8400-e29b-41d4-a716-446655440001',
    category: ExpenseCategory.SOFTWARE,
    amount: 5000,
    currency: 'INR',
    description: 'Software license purchase',
    date: '2024-01-15',
    is_billable: false,
    reimbursable: false,
    approval_status: 'pending' as const
  };

  describe('Constructor', () => {
    it('should create an expense with valid data', () => {
      const expense = new Expense(validExpenseData);
      expect(expense.amount).toBe(5000);
      expect(expense.category).toBe(ExpenseCategory.SOFTWARE);
      expect(expense.description).toBe('Software license purchase');
      expect(expense.created_at).toBeDefined();
      expect(expense.updated_at).toBeDefined();
    });

    it('should throw error with invalid data', () => {
      expect(() => {
        new Expense({ ...validExpenseData, amount: -100 });
      }).toThrow('Invalid expense data');
    });
  });

  describe('Business Logic Methods', () => {
    let expense: Expense;

    beforeEach(() => {
      expense = new Expense(validExpenseData);
    });

    describe('calculateTotalAmount', () => {
      it('should calculate total amount with tax', () => {
        expense.tax_amount = 900;
        expect(expense.calculateTotalAmount()).toBe(5900);
      });

      it('should return amount when no tax', () => {
        expect(expense.calculateTotalAmount()).toBe(5000);
      });
    });

    describe('calculateTaxAmount', () => {
      it('should calculate tax amount from rate', () => {
        expense.tax_rate = 18;
        expect(expense.calculateTaxAmount()).toBe(900);
      });

      it('should return 0 when no tax rate', () => {
        expect(expense.calculateTaxAmount()).toBe(0);
      });
    });

    describe('updateTaxAmount', () => {
      it('should update tax amount and timestamp', async () => {
        expense.tax_rate = 18;
        const originalUpdatedAt = expense.updated_at;
        
        await new Promise(resolve => setTimeout(resolve, 1));
        expense.updateTaxAmount();
        
        expect(expense.tax_amount).toBe(900);
        expect(expense.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('Approval Methods', () => {
      it('should approve expense', () => {
        expense.approve('John Doe');
        
        expect(expense.approval_status).toBe('approved');
        expect(expense.approved_by).toBe('John Doe');
        expect(expense.approved_at).toBeDefined();
      });

      it('should reject expense', () => {
        expense.reject();
        
        expect(expense.approval_status).toBe('rejected');
        expect(expense.approved_by).toBeUndefined();
        expect(expense.approved_at).toBeUndefined();
      });

      it('should check approval status', () => {
        expect(expense.isPending()).toBe(true);
        expect(expense.isApproved()).toBe(false);
        expect(expense.isRejected()).toBe(false);
        
        expense.approve('John Doe');
        expect(expense.isApproved()).toBe(true);
        expect(expense.isPending()).toBe(false);
        
        expense.reject();
        expect(expense.isRejected()).toBe(true);
        expect(expense.isApproved()).toBe(false);
      });
    });

    describe('Billing Methods', () => {
      it('should mark as billed', () => {
        expense.is_billable = true;
        const invoiceId = '550e8400-e29b-41d4-a716-446655440010';
        
        expense.markAsBilled(invoiceId);
        
        expect(expense.invoice_id).toBe(invoiceId);
        expect(expense.isBilled()).toBe(true);
      });

      it('should throw error when marking non-billable expense as billed', () => {
        expense.is_billable = false;
        
        expect(() => {
          expense.markAsBilled('invoice_123');
        }).toThrow('Cannot bill non-billable expense');
      });

      it('should check if billed', () => {
        expect(expense.isBilled()).toBe(false);
        
        expense.invoice_id = '550e8400-e29b-41d4-a716-446655440010';
        expect(expense.isBilled()).toBe(true);
      });

      it('should toggle billable status', async () => {
        expect(expense.is_billable).toBe(false);
        const originalUpdatedAt = expense.updated_at;
        
        await new Promise(resolve => setTimeout(resolve, 1));
        expense.toggleBillable();
        
        expect(expense.is_billable).toBe(true);
        expect(expense.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('Category Methods', () => {
      it('should get category display name', () => {
        expense.category = ExpenseCategory.SOFTWARE;
        expect(expense.getCategoryDisplayName()).toBe('Software & Subscriptions');
        
        expense.category = ExpenseCategory.TRAVEL;
        expect(expense.getCategoryDisplayName()).toBe('Travel & Transportation');
        
        expense.category = ExpenseCategory.EQUIPMENT;
        expect(expense.getCategoryDisplayName()).toBe('Equipment & Hardware');
      });

      it('should check if deductible', () => {
        expense.category = ExpenseCategory.SOFTWARE;
        expect(expense.isDeductible()).toBe(true);
        
        expense.category = ExpenseCategory.MARKETING;
        expect(expense.isDeductible()).toBe(false);
        
        expense.category = ExpenseCategory.EQUIPMENT;
        expect(expense.isDeductible()).toBe(true);
      });
    });

    describe('Date Methods', () => {
      it('should check if expense is today', () => {
        const today = new Date().toISOString().split('T')[0];
        expense.date = today;
        expect(expense.isToday()).toBe(true);
        
        expense.date = '2020-01-01';
        expect(expense.isToday()).toBe(false);
      });

      it('should check if expense is this week', () => {
        const today = new Date();
        const thisWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));
        expense.date = thisWeek.toISOString().split('T')[0];
        expect(expense.isThisWeek()).toBe(true);
      });

      it('should check if expense is this month', () => {
        const today = new Date();
        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 15);
        expense.date = thisMonth.toISOString().split('T')[0];
        expect(expense.isThisMonth()).toBe(true);
      });
    });

    describe('Receipt Methods', () => {
      it('should check if has receipt', () => {
        expect(expense.hasReceipt()).toBe(false);
        
        expense.receipt_url = 'https://example.com/receipt.pdf';
        expect(expense.hasReceipt()).toBe(true);
      });

      it('should update receipt', async () => {
        const originalUpdatedAt = expense.updated_at;
        const receiptUrl = 'https://example.com/receipt.pdf';
        
        await new Promise(resolve => setTimeout(resolve, 1));
        expense.updateReceipt(receiptUrl);
        
        expect(expense.receipt_url).toBe(receiptUrl);
        expect(expense.updated_at).not.toBe(originalUpdatedAt);
      });

      it('should remove receipt', async () => {
        expense.receipt_url = 'https://example.com/receipt.pdf';
        
        // Update the expense first to get a different timestamp
        await new Promise(resolve => setTimeout(resolve, 1));
        expense.updateTaxAmount(); // This will update the timestamp
        const originalUpdatedAt = expense.updated_at;
        
        await new Promise(resolve => setTimeout(resolve, 1));
        expense.removeReceipt();
        
        expect(expense.receipt_url).toBeUndefined();
        expect(expense.updated_at).not.toBe(originalUpdatedAt);
      });
    });

    describe('Formatting Methods', () => {
      it('should format amount', () => {
        const formatted = expense.getFormattedAmount();
        expect(formatted).toContain('5,000');
        expect(formatted).toContain('₹');
      });

      it('should format total amount', () => {
        expense.tax_amount = 900;
        const formatted = expense.getFormattedTotalAmount();
        expect(formatted).toContain('5,900');
        expect(formatted).toContain('₹');
      });

      it('should format date', () => {
        const formattedDate = expense.getFormattedDate();
        expect(formattedDate).toBeDefined();
        expect(typeof formattedDate).toBe('string');
      });
    });
  });

  describe('Static Summary Methods', () => {
    const sampleExpenses = [
      new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440010', amount: 1000, tax_amount: 180 }),
      new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440011', amount: 2000, tax_amount: 360, is_billable: true }),
      new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440012', amount: 1500, tax_amount: 270, reimbursable: true, approval_status: 'approved' })
    ];

    it('should calculate total amount', () => {
      const total = Expense.calculateTotalAmount(sampleExpenses);
      expect(total).toBe(5310); // (1000+180) + (2000+360) + (1500+270)
    });

    it('should calculate total by category', () => {
      const totals = Expense.calculateTotalByCategory(sampleExpenses);
      expect(totals[ExpenseCategory.SOFTWARE]).toBe(5310);
      expect(totals[ExpenseCategory.TRAVEL]).toBe(0);
    });

    it('should calculate billable amount', () => {
      const billableAmount = Expense.calculateBillableAmount(sampleExpenses);
      expect(billableAmount).toBe(2360); // Only the second expense is billable
    });

    it('should calculate reimbursable amount', () => {
      const reimbursableAmount = Expense.calculateReimbursableAmount(sampleExpenses);
      expect(reimbursableAmount).toBe(1770); // Only the third expense is reimbursable and approved
    });

    it('should group by category', () => {
      const grouped = Expense.groupByCategory(sampleExpenses);
      expect(grouped[ExpenseCategory.SOFTWARE]).toHaveLength(3);
      expect(grouped[ExpenseCategory.TRAVEL]).toHaveLength(0);
    });

    it('should group by project', () => {
      const expenses = [
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440010', project_id: '550e8400-e29b-41d4-a716-446655440020' }),
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440011', project_id: '550e8400-e29b-41d4-a716-446655440020' }),
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440012', project_id: '550e8400-e29b-41d4-a716-446655440021' })
      ];
      
      const grouped = Expense.groupByProject(expenses);
      expect(grouped['550e8400-e29b-41d4-a716-446655440020']).toHaveLength(2);
      expect(grouped['550e8400-e29b-41d4-a716-446655440021']).toHaveLength(1);
    });

    it('should group by month', () => {
      const expenses = [
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440010', date: '2024-01-15' }),
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440011', date: '2024-01-20' }),
        new Expense({ ...validExpenseData, id: '550e8400-e29b-41d4-a716-446655440012', date: '2024-02-10' })
      ];
      
      const grouped = Expense.groupByMonth(expenses);
      expect(grouped['2024-01']).toHaveLength(2);
      expect(grouped['2024-02']).toHaveLength(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const expense = new Expense(validExpenseData);
      const json = expense.toJSON();
      
      expect(json.amount).toBe(5000);
      expect(json.category).toBe(ExpenseCategory.SOFTWARE);
      expect(json.description).toBe('Software license purchase');
    });

    it('should deserialize from JSON correctly', () => {
      const expense = Expense.fromJSON(validExpenseData);
      
      expect(expense).toBeInstanceOf(Expense);
      expect(expense.amount).toBe(5000);
      expect(expense.category).toBe(ExpenseCategory.SOFTWARE);
    });
  });

  describe('Validation', () => {
    it('should validate correct data', () => {
      const validation = Expense.validate(validExpenseData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const validation = Expense.validate({ ...validExpenseData, amount: -100 });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});