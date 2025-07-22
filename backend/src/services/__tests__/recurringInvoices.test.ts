import {
  scheduleRecurringInvoice,
  getActiveRecurringInvoices,
  cancelRecurringInvoice,
  updateRecurringInvoice,
  checkOverdueInvoices,
  getRecurringInvoiceStats,
  initializeRecurringInvoices,
  scheduleOverdueCheck
} from '../recurringInvoices';
import { GoogleSheetsService } from '../googleSheets';
import { Invoice, InvoiceStatus } from '../../models';

// Mock dependencies
jest.mock('../googleSheets');
jest.mock('node-cron', () => ({
  schedule: jest.fn((expression, callback, options) => {
    // Store the callback for manual execution in tests
    (global as any).cronCallbacks = (global as any).cronCallbacks || [];
    (global as any).cronCallbacks.push({ expression, callback, options });
    return { destroy: jest.fn() };
  })
}));

const MockedGoogleSheetsService = GoogleSheetsService as jest.MockedClass<typeof GoogleSheetsService>;

describe('Recurring Invoices Service', () => {
  let mockSheetsService: jest.Mocked<GoogleSheetsService>;

  const mockTemplateInvoice = {
    id: 'template-invoice-123',
    invoice_number: 'INV-TEMPLATE-001',
    client_id: 'client-123',
    project_id: 'project-123',
    amount: 10000,
    tax_amount: 1800,
    total_amount: 11800,
    status: InvoiceStatus.DRAFT,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear global cron callbacks
    (global as any).cronCallbacks = [];
    
    // Create mock sheets service
    mockSheetsService = {
      read: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: jest.fn(),
      batchCreate: jest.fn(),
      batchUpdate: jest.fn(),
      aggregate: jest.fn()
    } as any;

    MockedGoogleSheetsService.mockImplementation(() => mockSheetsService);
  });

  describe('scheduleRecurringInvoice', () => {
    it('should schedule a monthly recurring invoice', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        max_occurrences: 12
      };

      await scheduleRecurringInvoice(config);

      // Verify that a cron job was scheduled
      expect((global as any).cronCallbacks).toHaveLength(1);
      
      // Verify the configuration is stored
      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices).toHaveLength(1);
      expect(activeInvoices[0].frequency).toBe('monthly');
      expect(activeInvoices[0].max_occurrences).toBe(12);
    });

    it('should schedule a weekly recurring invoice', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'weekly' as const,
        next_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices).toHaveLength(1);
      expect(activeInvoices[0].frequency).toBe('weekly');
      expect(activeInvoices[0].end_date).toBeDefined();
    });

    it('should schedule a quarterly recurring invoice', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'quarterly' as const,
        next_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices).toHaveLength(1);
      expect(activeInvoices[0].frequency).toBe('quarterly');
    });

    it('should schedule a yearly recurring invoice', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'yearly' as const,
        next_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices).toHaveLength(1);
      expect(activeInvoices[0].frequency).toBe('yearly');
    });

    it('should set default values for optional fields', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices[0].current_occurrences).toBe(0);
      expect(activeInvoices[0].is_active).toBe(true);
    });
  });

  describe('Recurring Invoice Creation', () => {
    it('should create a new invoice from template when cron job executes', async () => {
      // Setup template invoice in mock sheets service
      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 1000), // Very soon
        max_occurrences: 12
      };

      await scheduleRecurringInvoice(config);

      // Manually execute the cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      // Verify that a new invoice was created
      expect(mockSheetsService.read).toHaveBeenCalledWith('Invoices', 'template-invoice-123');
      expect(mockSheetsService.create).toHaveBeenCalledWith('Invoices', expect.any(Object));
    });

    it('should handle template invoice not found', async () => {
      mockSheetsService.read.mockResolvedValue([]); // Template not found

      const config = {
        template_invoice_id: 'non-existent-template',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 1000)
      };

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      // Should not create a new invoice
      expect(mockSheetsService.create).not.toHaveBeenCalled();
    });

    it('should increment occurrence count after creating invoice', async () => {
      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 1000),
        max_occurrences: 3
      };

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices[0].current_occurrences).toBe(1);
    });

    it('should stop creating invoices when max occurrences reached', async () => {
      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 1000),
        max_occurrences: 1,
        current_occurrences: 1 // Already at max
      };

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      // Should not create a new invoice
      expect(mockSheetsService.create).not.toHaveBeenCalled();
    });

    it('should stop creating invoices when end date is reached', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 1000),
        end_date: pastDate
      };

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      // Should not create a new invoice
      expect(mockSheetsService.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelRecurringInvoice', () => {
    it('should cancel an active recurring invoice', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);
      
      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices).toHaveLength(1);

      // Get the config ID (this would be returned in a real implementation)
      const configId = Object.keys((global as any).recurringInvoices || {})[0] || 'test-config-id';
      
      const result = cancelRecurringInvoice(configId);
      expect(result).toBe(true);

      const activeInvoicesAfterCancel = getActiveRecurringInvoices();
      expect(activeInvoicesAfterCancel).toHaveLength(0);
    });

    it('should return false for non-existent config', () => {
      const result = cancelRecurringInvoice('non-existent-config');
      expect(result).toBe(false);
    });
  });

  describe('updateRecurringInvoice', () => {
    it('should update recurring invoice configuration', async () => {
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      await scheduleRecurringInvoice(config);

      const configId = Object.keys((global as any).recurringInvoices || {})[0] || 'test-config-id';
      
      const updates = {
        frequency: 'weekly' as const,
        max_occurrences: 10
      };

      const result = updateRecurringInvoice(configId, updates);
      expect(result).toBe(true);

      const activeInvoices = getActiveRecurringInvoices();
      expect(activeInvoices[0].frequency).toBe('weekly');
      expect(activeInvoices[0].max_occurrences).toBe(10);
    });

    it('should return false for non-existent config', () => {
      const result = updateRecurringInvoice('non-existent-config', { frequency: 'weekly' as const });
      expect(result).toBe(false);
    });
  });

  describe('checkOverdueInvoices', () => {
    it('should mark sent invoices as overdue when past due date', async () => {
      const overdueInvoice = {
        ...mockTemplateInvoice,
        id: 'overdue-invoice-123',
        status: InvoiceStatus.SENT,
        due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      };

      const currentInvoice = {
        ...mockTemplateInvoice,
        id: 'current-invoice-123',
        status: InvoiceStatus.SENT,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
      };

      mockSheetsService.read.mockResolvedValue([overdueInvoice, currentInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      await checkOverdueInvoices();

      // Should update only the overdue invoice
      expect(mockSheetsService.update).toHaveBeenCalledTimes(1);
      expect(mockSheetsService.update).toHaveBeenCalledWith(
        'Invoices',
        'overdue-invoice-123',
        expect.objectContaining({
          status: InvoiceStatus.OVERDUE
        })
      );
    });

    it('should not mark paid invoices as overdue', async () => {
      const paidOverdueInvoice = {
        ...mockTemplateInvoice,
        id: 'paid-invoice-123',
        status: InvoiceStatus.PAID,
        due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      };

      mockSheetsService.read.mockResolvedValue([paidOverdueInvoice]);
      mockSheetsService.update.mockResolvedValue(true);

      await checkOverdueInvoices();

      // Should not update any invoices
      expect(mockSheetsService.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSheetsService.read.mockRejectedValue(new Error('Sheets API error'));

      // Should not throw an error
      await expect(checkOverdueInvoices()).resolves.not.toThrow();
    });
  });

  describe('getRecurringInvoiceStats', () => {
    it('should return correct statistics', async () => {
      // Schedule multiple recurring invoices
      const configs = [
        {
          template_invoice_id: 'template-1',
          frequency: 'monthly' as const,
          next_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        {
          template_invoice_id: 'template-2',
          frequency: 'weekly' as const,
          next_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          template_invoice_id: 'template-3',
          frequency: 'monthly' as const,
          next_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          is_active: false
        }
      ];

      for (const config of configs) {
        await scheduleRecurringInvoice(config);
      }

      const stats = getRecurringInvoiceStats();
      
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
      expect(stats.nextDue).toBeInstanceOf(Date);
    });

    it('should return null for nextDue when no active invoices', () => {
      const stats = getRecurringInvoiceStats();
      
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.inactive).toBe(0);
      expect(stats.nextDue).toBeNull();
    });
  });

  describe('initializeRecurringInvoices', () => {
    it('should initialize the recurring invoice system', () => {
      // Should not throw an error
      expect(() => initializeRecurringInvoices()).not.toThrow();
    });
  });

  describe('scheduleOverdueCheck', () => {
    it('should schedule daily overdue check', () => {
      scheduleOverdueCheck();

      // Verify that a cron job was scheduled for daily execution
      const cronCallbacks = (global as any).cronCallbacks || [];
      const overdueCheckJob = cronCallbacks.find((job: any) => 
        job.expression === '0 9 * * *' // Daily at 9 AM
      );
      
      expect(overdueCheckJob).toBeDefined();
      expect(overdueCheckJob.options.timezone).toBe('Asia/Kolkata');
    });
  });

  describe('Date Calculations', () => {
    it('should calculate next monthly date correctly', async () => {
      const startDate = new Date('2024-01-15');
      
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'monthly' as const,
        next_date: startDate
      };

      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      await scheduleRecurringInvoice(config);

      // Execute cron callback to trigger next date calculation
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      const activeInvoices = getActiveRecurringInvoices();
      const nextDate = activeInvoices[0].next_date;
      
      // Next date should be February 15, 2024
      expect(nextDate.getMonth()).toBe(1); // February (0-indexed)
      expect(nextDate.getDate()).toBe(15);
    });

    it('should calculate next weekly date correctly', async () => {
      const startDate = new Date('2024-01-15'); // Monday
      
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'weekly' as const,
        next_date: startDate
      };

      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      const activeInvoices = getActiveRecurringInvoices();
      const nextDate = activeInvoices[0].next_date;
      
      // Next date should be 7 days later
      const expectedDate = new Date(startDate);
      expectedDate.setDate(expectedDate.getDate() + 7);
      
      expect(nextDate.getDate()).toBe(expectedDate.getDate());
    });

    it('should calculate next quarterly date correctly', async () => {
      const startDate = new Date('2024-01-15');
      
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'quarterly' as const,
        next_date: startDate
      };

      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      const activeInvoices = getActiveRecurringInvoices();
      const nextDate = activeInvoices[0].next_date;
      
      // Next date should be April 15, 2024 (3 months later)
      expect(nextDate.getMonth()).toBe(3); // April (0-indexed)
      expect(nextDate.getDate()).toBe(15);
    });

    it('should calculate next yearly date correctly', async () => {
      const startDate = new Date('2024-01-15');
      
      const config = {
        template_invoice_id: 'template-invoice-123',
        frequency: 'yearly' as const,
        next_date: startDate
      };

      mockSheetsService.read.mockResolvedValue([mockTemplateInvoice]);
      mockSheetsService.create.mockResolvedValue('new-invoice-id');

      await scheduleRecurringInvoice(config);

      // Execute cron callback
      const cronCallback = (global as any).cronCallbacks[0];
      await cronCallback.callback();

      const activeInvoices = getActiveRecurringInvoices();
      const nextDate = activeInvoices[0].next_date;
      
      // Next date should be January 15, 2025
      expect(nextDate.getFullYear()).toBe(2025);
      expect(nextDate.getMonth()).toBe(0); // January
      expect(nextDate.getDate()).toBe(15);
    });
  });
});