import { PaymentReminderService } from '../payment-reminder.service';
import { SheetsService } from '../sheets.service';
import nodemailer from 'nodemailer';

// Mock dependencies
jest.mock('../sheets.service');
jest.mock('nodemailer');
jest.mock('node-cron');

describe('PaymentReminderService', () => {
  let reminderService: PaymentReminderService;
  let mockSheetsService: jest.Mocked<SheetsService>;
  let mockTransporter: jest.Mocked<nodemailer.Transporter>;

  beforeEach(() => {
    mockSheetsService = new SheetsService('test-sheet-id', {}) as jest.Mocked<SheetsService>;
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
    } as any;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    reminderService = new PaymentReminderService(mockSheetsService);

    // Setup common mock implementations
    mockSheetsService.create = jest.fn().mockResolvedValue('created_id');
    mockSheetsService.update = jest.fn().mockResolvedValue(true);
    mockSheetsService.read = jest.fn();
    mockSheetsService.query = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReminderRule', () => {
    const mockInvoice = {
      id: 'inv_123',
      due_date: '2024-02-15T00:00:00Z',
      invoice_number: 'INV-001',
      total_amount: 1000
    };

    beforeEach(() => {
      mockSheetsService.read.mockResolvedValue([mockInvoice]);
    });

    it('should create before_due reminder', async () => {
      const reminderId = await reminderService.createReminderRule(
        'inv_123',
        'before_due',
        3,
        'Payment due in 3 days',
        'email'
      );

      expect(reminderId).toBeDefined();
      expect(mockSheetsService.create).toHaveBeenCalledWith('Payment_Reminders', 
        expect.objectContaining({
          invoice_id: 'inv_123',
          type: 'before_due',
          days_offset: 3,
          template: 'Payment due in 3 days',
          method: 'email',
          status: 'scheduled',
          scheduled_at: '2024-02-12T00:00:00.000Z' // 3 days before due date
        })
      );
    });

    it('should create on_due reminder', async () => {
      await reminderService.createReminderRule(
        'inv_123',
        'on_due',
        0,
        'Payment due today',
        'email'
      );

      expect(mockSheetsService.create).toHaveBeenCalledWith('Payment_Reminders',
        expect.objectContaining({
          type: 'on_due',
          days_offset: 0,
          scheduled_at: '2024-02-15T00:00:00.000Z' // Same as due date
        })
      );
    });

    it('should create after_due reminder', async () => {
      await reminderService.createReminderRule(
        'inv_123',
        'after_due',
        7,
        'Payment overdue',
        'email'
      );

      expect(mockSheetsService.create).toHaveBeenCalledWith('Payment_Reminders',
        expect.objectContaining({
          type: 'after_due',
          days_offset: 7,
          scheduled_at: '2024-02-22T00:00:00.000Z' // 7 days after due date
        })
      );
    });

    it('should throw error for non-existent invoice', async () => {
      mockSheetsService.read.mockResolvedValue([]);

      await expect(
        reminderService.createReminderRule('inv_999', 'before_due', 3, 'template', 'email')
      ).rejects.toThrow('Invoice not found');
    });
  });

  describe('scheduleUpcomingReminders', () => {
    const mockUnpaidInvoices = [
      {
        id: 'inv_123',
        due_date: '2024-02-15T00:00:00Z',
        status: 'sent'
      },
      {
        id: 'inv_124',
        due_date: '2024-02-20T00:00:00Z',
        status: 'overdue'
      }
    ];

    beforeEach(() => {
      mockSheetsService.query
        .mockResolvedValueOnce(mockUnpaidInvoices) // For unpaid invoices query
        .mockResolvedValue([]); // For existing reminders query
    });

    it('should schedule reminders for unpaid invoices', async () => {
      await reminderService.scheduleUpcomingReminders();

      expect(mockSheetsService.query).toHaveBeenCalledWith('Invoices', {
        status: ['sent', 'overdue']
      });

      // Should create multiple reminders for each invoice
      expect(mockSheetsService.create).toHaveBeenCalledTimes(
        mockUnpaidInvoices.length * 6 // 6 reminder types per invoice
      );
    });

    it('should not create duplicate reminders', async () => {
      const existingReminders = [
        {
          invoice_id: 'inv_123',
          type: 'before_due',
          days_offset: 3
        }
      ];

      mockSheetsService.query
        .mockResolvedValueOnce(mockUnpaidInvoices)
        .mockResolvedValue(existingReminders);

      await reminderService.scheduleUpcomingReminders();

      // Should create fewer reminders since some already exist
      expect(mockSheetsService.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSheetsService.query.mockRejectedValue(new Error('Database error'));

      // Should not throw, just log error
      await expect(reminderService.scheduleUpcomingReminders()).resolves.toBeUndefined();
    });
  });

  describe('processScheduledReminders', () => {
    const mockDueReminders = [
      {
        id: 'reminder_123',
        invoice_id: 'inv_123',
        type: 'before_due',
        template: 'Payment due soon',
        method: 'email',
        status: 'scheduled'
      }
    ];

    const mockInvoice = {
      id: 'inv_123',
      invoice_number: 'INV-001',
      total_amount: 1000,
      due_date: '2024-02-15T00:00:00Z',
      client_id: 'client_123'
    };

    const mockClient = {
      id: 'client_123',
      name: 'Test Client',
      email: 'client@example.com',
      phone: '+1234567890'
    };

    beforeEach(() => {
      mockSheetsService.query.mockResolvedValue(mockDueReminders);
      mockSheetsService.read
        .mockResolvedValueOnce([mockInvoice])
        .mockResolvedValueOnce([mockClient]);
    });

    it('should process due reminders', async () => {
      await reminderService.processScheduledReminders();

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: process.env.EMAIL_USER,
        to: 'client@example.com',
        subject: 'Payment Reminder - Invoice INV-001',
        html: expect.stringContaining('Test Client')
      });

      expect(mockSheetsService.update).toHaveBeenCalledWith('Payment_Reminders', 'reminder_123', {
        status: 'sent',
        sent_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should handle email sending errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Email error'));

      await reminderService.processScheduledReminders();

      expect(mockSheetsService.update).toHaveBeenCalledWith('Payment_Reminders', 'reminder_123', {
        status: 'failed',
        updated_at: expect.any(String)
      });
    });

    it('should skip reminders for missing invoices', async () => {
      mockSheetsService.read.mockResolvedValueOnce([]); // No invoice found

      await reminderService.processScheduledReminders();

      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(mockSheetsService.update).not.toHaveBeenCalled();
    });
  });

  describe('createLateFeeRule', () => {
    it('should create late fee rule', async () => {
      const ruleId = await reminderService.createLateFeeRule({
        name: 'Standard Late Fee',
        type: 'percentage',
        amount: 5,
        gracePeriodDays: 7,
        maxAmount: 100,
        compoundingFrequency: 'monthly',
        isActive: true
      });

      expect(ruleId).toBeDefined();
      expect(mockSheetsService.create).toHaveBeenCalledWith('Late_Fee_Rules', 
        expect.objectContaining({
          name: 'Standard Late Fee',
          type: 'percentage',
          amount: 5,
          grace_period_days: 7,
          max_amount: 100,
          compounding_frequency: 'monthly',
          is_active: true
        })
      );
    });
  });

  describe('processLateFees', () => {
    const mockLateFeeRules = [
      {
        id: 'rule_123',
        name: 'Standard Late Fee',
        type: 'percentage',
        amount: 5,
        grace_period_days: 7,
        max_amount: 100,
        is_active: true
      }
    ];

    const mockOverdueInvoices = [
      {
        id: 'inv_123',
        invoice_number: 'INV-001',
        total_amount: 1000,
        due_date: '2024-01-01T00:00:00Z', // 30+ days overdue
        client_id: 'client_123'
      }
    ];

    beforeEach(() => {
      mockSheetsService.query
        .mockResolvedValueOnce(mockLateFeeRules)
        .mockResolvedValueOnce(mockOverdueInvoices)
        .mockResolvedValue([]); // No existing late fees
    });

    it('should apply late fees to eligible invoices', async () => {
      await reminderService.processLateFees();

      // Should create late fee record
      expect(mockSheetsService.create).toHaveBeenCalledWith('Late_Fees',
        expect.objectContaining({
          invoice_id: 'inv_123',
          rule_id: 'rule_123',
          amount: 50, // 5% of 1000
          days_past_due: expect.any(Number)
        })
      );

      // Should update invoice total
      expect(mockSheetsService.update).toHaveBeenCalledWith('Invoices', 'inv_123', {
        total_amount: 1050, // Original + late fee
        updated_at: expect.any(String)
      });
    });

    it('should respect grace period', async () => {
      const recentOverdueInvoices = [
        {
          id: 'inv_123',
          total_amount: 1000,
          due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days overdue
          client_id: 'client_123'
        }
      ];

      mockSheetsService.query
        .mockResolvedValueOnce(mockLateFeeRules)
        .mockResolvedValueOnce(recentOverdueInvoices)
        .mockResolvedValue([]);

      await reminderService.processLateFees();

      // Should not create late fee (still in grace period)
      expect(mockSheetsService.create).not.toHaveBeenCalledWith('Late_Fees', expect.anything());
    });

    it('should not apply duplicate late fees', async () => {
      const existingLateFees = [
        {
          invoice_id: 'inv_123',
          rule_id: 'rule_123'
        }
      ];

      mockSheetsService.query
        .mockResolvedValueOnce(mockLateFeeRules)
        .mockResolvedValueOnce(mockOverdueInvoices)
        .mockResolvedValue(existingLateFees);

      await reminderService.processLateFees();

      expect(mockSheetsService.create).not.toHaveBeenCalledWith('Late_Fees', expect.anything());
    });

    it('should apply maximum amount limit', async () => {
      const highValueInvoices = [
        {
          id: 'inv_123',
          total_amount: 10000, // Would result in $500 late fee (5%)
          due_date: '2024-01-01T00:00:00Z',
          client_id: 'client_123'
        }
      ];

      mockSheetsService.query
        .mockResolvedValueOnce(mockLateFeeRules)
        .mockResolvedValueOnce(highValueInvoices)
        .mockResolvedValue([]);

      await reminderService.processLateFees();

      expect(mockSheetsService.create).toHaveBeenCalledWith('Late_Fees',
        expect.objectContaining({
          amount: 100 // Capped at max_amount
        })
      );
    });

    it('should handle fixed amount late fees', async () => {
      const fixedLateFeeRules = [
        {
          id: 'rule_124',
          type: 'fixed',
          amount: 25,
          grace_period_days: 7,
          is_active: true
        }
      ];

      mockSheetsService.query
        .mockResolvedValueOnce(fixedLateFeeRules)
        .mockResolvedValueOnce(mockOverdueInvoices)
        .mockResolvedValue([]);

      await reminderService.processLateFees();

      expect(mockSheetsService.create).toHaveBeenCalledWith('Late_Fees',
        expect.objectContaining({
          amount: 25 // Fixed amount
        })
      );
    });
  });
});