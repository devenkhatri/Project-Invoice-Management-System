import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { GoogleSheetsService } from '../services/googleSheets';
import { Invoice, InvoiceStatus, Project, Client, TimeEntry } from '../models';
import { generateInvoicePDF } from '../services/invoicePDF';
import { scheduleRecurringInvoice } from '../services/recurringInvoices';
import { generateGSTInvoicePDF } from '@/services/invoicePDF';
import { InvoiceItem } from '@/models/Invoice';

const router = Router();

// Initialize sheets service (will be injected in main app)
let sheetsService: GoogleSheetsService;

export const initializeInvoiceRoutes = (sheets: GoogleSheetsService) => {
  sheetsService = sheets;
  return router;
};

// Get all invoices with filtering and pagination
router.get('/', 
  authenticateToken,
  query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue']),
  query('client_id').optional().isString(),
  query('project_id').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status, client_id, project_id, page = 1, limit = 20 } = req.query;
      
      // Get all invoices from Google Sheets
      const invoiceRows = await sheetsService.read('Invoices');
      let invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));

      // Apply filters
      if (status) {
        invoices = invoices.filter(invoice => invoice.status === status);
      }
      if (client_id) {
        invoices = invoices.filter(invoice => invoice.client_id === client_id);
      }
      if (project_id) {
        invoices = invoices.filter(invoice => invoice.project_id === project_id);
      }

      // Sort by created_at descending
      invoices.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Apply pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedInvoices = invoices.slice(startIndex, endIndex);

      res.json({
        invoices: paginatedInvoices,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: invoices.length,
          totalPages: Math.ceil(invoices.length / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  }
);

// Get single invoice by ID
router.get('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      res.json(invoice);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({ error: 'Failed to fetch invoice' });
    }
  }
);

// Create new invoice
router.post('/',
  authenticateToken,
  body('client_id').isString().notEmpty(),
  body('project_id').isString().notEmpty(),
  body('amount').isNumeric().custom(value => value >= 0),
  body('tax_rate').optional().isNumeric().custom(value => value >= 0 && value <= 100),
  body('due_date').optional().isISO8601(),
  body('invoice_number').optional().isString(),
  body('items').optional().isArray(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { client_id, project_id, amount, tax_rate = 18, due_date, invoice_number, items } = req.body;

      // Verify client and project exist
      const clientRows = await sheetsService.read('Clients', client_id);
      const projectRows = await sheetsService.read('Projects', project_id);
      
      if (clientRows.length === 0) {
        res.status(400).json({ error: 'Client not found' });
        return;
      }
      if (projectRows.length === 0) {
        res.status(400).json({ error: 'Project not found' });
        return;
      }

      // Create invoice
      const invoiceData = {
        client_id,
        project_id,
        amount: parseFloat(amount),
        invoice_number,
        due_date: due_date ? new Date(due_date) : undefined
      };

      const invoice = new Invoice(invoiceData);
      invoice.calculateGST(tax_rate);

      // Validate invoice
      const validation = invoice.validate();
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.errors 
        });
        return;
      }

      // Save to Google Sheets
      const invoiceId = await sheetsService.create('Invoices', invoice.toSheetRow());
      invoice.id = invoiceId;

      res.status(201).json(invoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }
);

// Create invoice from project time entries
router.post('/from-project/:projectId',
  authenticateToken,
  param('projectId').isString().notEmpty(),
  body('hourly_rate').isNumeric().custom(value => value > 0),
  body('tax_rate').optional().isNumeric().custom(value => value >= 0 && value <= 100),
  body('due_date').optional().isISO8601(),
  body('include_expenses').optional().isBoolean(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { hourly_rate, tax_rate = 18, due_date, include_expenses = false } = req.body;

      // Get project details
      const projectRows = await sheetsService.read('Projects', projectId);
      if (projectRows.length === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const project = Project.fromSheetRow(projectRows[0]);

      // Get time entries for the project
      const timeEntryRows = await sheetsService.query('Time_Entries', { project_id: projectId });
      const timeEntries = timeEntryRows.map(row => TimeEntry.fromSheetRow(row));
      
      // Calculate total hours
      const totalHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
      let totalAmount = totalHours * parseFloat(hourly_rate);

      // Include expenses if requested
      if (include_expenses) {
        const expenseRows = await sheetsService.query('Expenses', { project_id: projectId });
        const totalExpenses = expenseRows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
        totalAmount += totalExpenses;
      }

      // Create invoice
      const invoiceData = {
        client_id: project.client_id,
        project_id: projectId,
        amount: totalAmount,
        due_date: due_date ? new Date(due_date) : undefined
      };

      const invoice = new Invoice(invoiceData);
      invoice.calculateGST(tax_rate);

      // Save to Google Sheets
      const invoiceId = await sheetsService.create('Invoices', invoice.toSheetRow());
      invoice.id = invoiceId;

      res.status(201).json({
        invoice,
        details: {
          total_hours: totalHours,
          hourly_rate: parseFloat(hourly_rate),
          expenses_included: include_expenses
        }
      });
    } catch (error) {
      console.error('Error creating invoice from project:', error);
      res.status(500).json({ error: 'Failed to create invoice from project' });
    }
  }
);

// Update invoice
router.put('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('amount').optional().isNumeric().custom(value => value >= 0),
  body('tax_rate').optional().isNumeric().custom(value => value >= 0 && value <= 100),
  body('due_date').optional().isISO8601(),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue']),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Apply updates
      if (updates.amount !== undefined) {
        invoice.updateAmount(parseFloat(updates.amount), updates.tax_rate || invoice.getTaxRate());
      }
      if (updates.due_date) {
        invoice.updateDueDate(new Date(updates.due_date));
      }
      if (updates.status) {
        invoice.status = updates.status as InvoiceStatus;
        invoice.updated_at = new Date();
      }

      // Validate updated invoice
      const validation = invoice.validate();
      if (!validation.isValid) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.errors 
        });
        return;
      }

      // Update in Google Sheets
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      res.json(invoice);
    } catch (error) {
      console.error('Error updating invoice:', error);
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }
);

// Mark invoice as sent
router.post('/:id/send',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      invoice.markAsSent();

      // Update in Google Sheets
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      res.json({ message: 'Invoice marked as sent', invoice });
    } catch (error) {
      console.error('Error marking invoice as sent:', error);
      res.status(500).json({ error: 'Failed to mark invoice as sent' });
    }
  }
);

// Mark invoice as paid
router.post('/:id/pay',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('payment_date').optional().isISO8601(),
  body('payment_method').optional().isString(),
  body('transaction_id').optional().isString(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { payment_date, payment_method, transaction_id } = req.body;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      invoice.markAsPaid();

      // Update in Google Sheets
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      res.json({ 
        message: 'Invoice marked as paid', 
        invoice,
        payment_details: {
          payment_date: payment_date || new Date().toISOString(),
          payment_method,
          transaction_id
        }
      });
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      res.status(500).json({ error: 'Failed to mark invoice as paid' });
    }
  }
);

// Generate payment link for invoice
router.post('/:id/payment-link',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('gateway').isIn(['razorpay', 'stripe', 'paypal']).withMessage('Invalid payment gateway'),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { gateway } = req.body;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Don't generate payment link for paid invoices
      if (invoice.isPaid()) {
        res.status(400).json({ error: 'Cannot generate payment link for paid invoices' });
        return;
      }

      // Get client details
      const clientRows = await sheetsService.read('Clients', invoice.client_id);
      if (clientRows.length === 0) {
        res.status(400).json({ error: 'Client not found' });
        return;
      }
      
      const client = Client.fromSheetRow(clientRows[0]);

      // In a real implementation, we would integrate with the payment gateway API
      // For now, we'll generate a mock payment link
      
      // Generate a unique payment reference
      const paymentRef = `PAY-${Date.now().toString(36).toUpperCase()}`;
      
      // Create mock payment links for different gateways
      let paymentLink = '';
      
      switch (gateway) {
        case 'razorpay':
          paymentLink = `https://rzp.io/i/${paymentRef}`;
          break;
        case 'stripe':
          paymentLink = `https://stripe.com/pay/${paymentRef}`;
          break;
        case 'paypal':
          paymentLink = `https://paypal.me/yourcompany/${invoice.total_amount}?ref=${paymentRef}`;
          break;
        default:
          paymentLink = `https://yourcompany.com/pay/${id}?ref=${paymentRef}`;
      }
      
      // Update invoice with payment link
      invoice.setPaymentLink(paymentLink);
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      res.json({
        message: 'Payment link generated successfully',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.total_amount,
        currency: invoice.currency,
        client_name: client.name,
        payment_link: paymentLink,
        gateway,
        reference: paymentRef,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      });
    } catch (error) {
      console.error('Error generating payment link:', error);
      res.status(500).json({ error: 'Failed to generate payment link' });
    }
  }
);

// Generate PDF for invoice
router.get('/:id/pdf',
  authenticateToken,
  param('id').isString().notEmpty(),
  query('gst').optional().isBoolean(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const gstCompliant = req.query.gst === 'true';

      // Get invoice details
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Get client and project details
      const clientRows = await sheetsService.read('Clients', invoice.client_id);
      const projectRows = await sheetsService.read('Projects', invoice.project_id);

      if (clientRows.length === 0 || projectRows.length === 0) {
        res.status(400).json({ error: 'Missing client or project data' });
        return;
      }

      const client = Client.fromSheetRow(clientRows[0]);
      const project = Project.fromSheetRow(projectRows[0]);

      // Get invoice items if available
      const itemRows = await sheetsService.query('Invoice_Items', { invoice_id: id });
      if (itemRows.length > 0) {
        invoice.items = itemRows.map(row => InvoiceItem.fromSheetRow(row));
      }

      // Generate PDF based on requested format
      const pdfBuffer = gstCompliant 
        ? await generateGSTInvoicePDF(invoice, client, project)
        : await generateInvoicePDF(invoice, client, project);

      const filename = gstCompliant 
        ? `gst-invoice-${invoice.invoice_number}.pdf`
        : `invoice-${invoice.invoice_number}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
  }
);

// Set up recurring invoice
router.post('/:id/recurring',
  authenticateToken,
  param('id').isString().notEmpty(),
  body('frequency').isIn(['weekly', 'monthly', 'quarterly', 'yearly']),
  body('next_date').isISO8601(),
  body('end_date').optional().isISO8601(),
  body('max_occurrences').optional().isInt({ min: 1 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { frequency, next_date, end_date, max_occurrences } = req.body;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Update invoice to mark it as recurring
      invoice.setupRecurring(frequency, new Date(next_date), end_date ? new Date(end_date) : undefined, max_occurrences);
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      // Schedule recurring invoice
      const recurringConfig = {
        template_invoice_id: id,
        frequency,
        next_date: new Date(next_date),
        end_date: end_date ? new Date(end_date) : undefined,
        max_occurrences
      };

      await scheduleRecurringInvoice(recurringConfig);

      res.json({ 
        message: 'Recurring invoice scheduled successfully',
        config: recurringConfig
      });
    } catch (error) {
      console.error('Error setting up recurring invoice:', error);
      res.status(500).json({ error: 'Failed to set up recurring invoice' });
    }
  }
);

// Cancel recurring invoice
router.post('/:id/cancel-recurring',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Get existing invoice
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Check if invoice is recurring
      if (!invoice.is_recurring) {
        res.status(400).json({ error: 'Invoice is not set up for recurring' });
        return;
      }

      // Update invoice to cancel recurring
      invoice.cancelRecurring();
      await sheetsService.update('Invoices', id, invoice.toSheetRow());

      // In a real implementation, we would also cancel the scheduled job
      // For now, we'll just return success

      res.json({ 
        message: 'Recurring invoice cancelled successfully',
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          is_recurring: invoice.is_recurring
        }
      });
    } catch (error) {
      console.error('Error cancelling recurring invoice:', error);
      res.status(500).json({ error: 'Failed to cancel recurring invoice' });
    }
  }
);

// Check if invoice is eligible for e-invoicing under Indian GST rules
router.get('/:id/e-invoice-eligibility',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Get invoice details
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Get client details to check GSTIN
      const clientRows = await sheetsService.read('Clients', invoice.client_id);
      if (clientRows.length === 0) {
        res.status(400).json({ error: 'Client not found' });
        return;
      }

      const client = Client.fromSheetRow(clientRows[0]);

      // Check eligibility criteria
      // 1. Invoice amount >= ₹50,000
      // 2. Client has GSTIN (B2B transaction)
      // 3. Not a draft invoice
      const isEligible = 
        invoice.total_amount >= 50000 && 
        !!client.gstin && 
        invoice.status !== InvoiceStatus.DRAFT;

      // Additional criteria that would be checked in a real implementation:
      // - Supplier turnover > ₹20 crores (as per current rules)
      // - Invoice type is not exempt from e-invoicing

      res.json({
        eligible: isEligible,
        reasons: {
          amountCriteria: invoice.total_amount >= 50000,
          b2bTransaction: !!client.gstin,
          finalizedInvoice: invoice.status !== InvoiceStatus.DRAFT
        },
        requirements: {
          minAmount: 50000,
          needsGSTIN: true,
          cannotBeDraft: true
        }
      });
    } catch (error) {
      console.error('Error checking e-invoice eligibility:', error);
      res.status(500).json({ error: 'Failed to check e-invoice eligibility' });
    }
  }
);

// Delete invoice
router.delete('/:id',
  authenticateToken,
  param('id').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if invoice exists
      const invoiceRows = await sheetsService.read('Invoices', id);
      if (invoiceRows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);

      // Don't allow deletion of paid invoices
      if (invoice.isPaid()) {
        return res.status(400).json({ error: 'Cannot delete paid invoices' });
      }

      // Delete from Google Sheets
      await sheetsService.delete('Invoices', id);

      // Also delete any associated invoice items
      try {
        const itemRows = await sheetsService.query('Invoice_Items', { invoice_id: id });
        for (const item of itemRows) {
          await sheetsService.delete('Invoice_Items', item.id);
        }
      } catch (error) {
        console.error('Error deleting invoice items:', error);
        // Continue with response even if item deletion fails
      }

      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({ error: 'Failed to delete invoice' });
    }
  }
);

// Check for overdue invoices and send reminders
router.post('/check-overdue',
  authenticateToken,
  body('send_reminders').optional().isBoolean(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const sendReminders = req.body.send_reminders === true;
      
      // Get all invoices
      const invoiceRows = await sheetsService.read('Invoices');
      const invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));
      
      // Find overdue invoices
      const today = new Date();
      const overdueInvoices = invoices.filter(invoice => 
        invoice.status === InvoiceStatus.SENT && 
        invoice.due_date < today
      );
      
      // Update status to overdue
      const updatedInvoices = [];
      for (const invoice of overdueInvoices) {
        invoice.markAsOverdue();
        await sheetsService.update('Invoices', invoice.id, invoice.toSheetRow());
        updatedInvoices.push({
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          client_id: invoice.client_id,
          amount: invoice.total_amount,
          due_date: invoice.due_date.toISOString(),
          days_overdue: invoice.getDaysOverdue()
        });
      }
      
      // Send reminders if requested
      const remindersSent = [];
      if (sendReminders && updatedInvoices.length > 0) {
        // In a real implementation, we would send emails here
        // For now, we'll just return the list of invoices that would receive reminders
        
        for (const invoice of updatedInvoices) {
          // Get client details
          const clientRows = await sheetsService.read('Clients', invoice.client_id);
          if (clientRows.length > 0) {
            const client = Client.fromSheetRow(clientRows[0]);
            remindersSent.push({
              invoice_number: invoice.invoice_number,
              client_name: client.name,
              client_email: client.email,
              amount: invoice.amount,
              days_overdue: invoice.days_overdue
            });
          }
        }
      }
      
      res.json({
        checked_at: new Date().toISOString(),
        total_invoices: invoices.length,
        overdue_invoices: updatedInvoices.length,
        updated_invoices: updatedInvoices,
        reminders_sent: sendReminders ? remindersSent.length : 0,
        reminders: sendReminders ? remindersSent : []
      });
    } catch (error) {
      console.error('Error checking overdue invoices:', error);
      res.status(500).json({ error: 'Failed to check overdue invoices' });
    }
  }
);

// Generate GST report for invoices in a date range
router.get('/reports/gst',
  authenticateToken,
  query('start_date').isISO8601(),
  query('end_date').isISO8601(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { start_date, end_date } = req.query;
      const startDate = new Date(start_date as string);
      const endDate = new Date(end_date as string);

      // Get all invoices
      const invoiceRows = await sheetsService.read('Invoices');
      let invoices = invoiceRows.map(row => Invoice.fromSheetRow(row));

      // Filter by date range
      invoices = invoices.filter(invoice => {
        const invoiceDate = invoice.created_at;
        return invoiceDate >= startDate && invoiceDate <= endDate;
      });

      // Get client details for each invoice
      const clientIds = [...new Set(invoices.map(invoice => invoice.client_id))];
      const clientsMap: Record<string, any> = {};
      
      for (const clientId of clientIds) {
        const clientRows = await sheetsService.read('Clients', clientId);
        if (clientRows.length > 0) {
          clientsMap[clientId] = Client.fromSheetRow(clientRows[0]);
        }
      }

      // Calculate GST summary
      const gstSummary = {
        totalInvoiceAmount: 0,
        totalTaxableValue: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        b2bInvoices: 0,
        b2cInvoices: 0,
        invoicesByRate: {} as Record<string, { count: number, taxableValue: number, tax: number }>
      };

      const invoiceDetails = invoices.map(invoice => {
        const client = clientsMap[invoice.client_id];
        const isB2B = client && !!client.gstin;
        const taxRate = invoice.getTaxRate();
        
        // Assume all are intra-state for simplicity
        // In a real implementation, would check client state vs company state
        const isInterState = false;
        
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        
        if (isInterState) {
          igst = invoice.tax_amount;
        } else {
          cgst = invoice.tax_amount / 2;
          sgst = invoice.tax_amount / 2;
        }
        
        // Update summary
        gstSummary.totalInvoiceAmount += invoice.total_amount;
        gstSummary.totalTaxableValue += invoice.amount;
        gstSummary.totalCGST += cgst;
        gstSummary.totalSGST += sgst;
        gstSummary.totalIGST += igst;
        
        if (isB2B) {
          gstSummary.b2bInvoices++;
        } else {
          gstSummary.b2cInvoices++;
        }
        
        // Group by tax rate
        const rateKey = taxRate.toString();
        if (!gstSummary.invoicesByRate[rateKey]) {
          gstSummary.invoicesByRate[rateKey] = { count: 0, taxableValue: 0, tax: 0 };
        }
        gstSummary.invoicesByRate[rateKey].count++;
        gstSummary.invoicesByRate[rateKey].taxableValue += invoice.amount;
        gstSummary.invoicesByRate[rateKey].tax += invoice.tax_amount;
        
        return {
          invoiceNumber: invoice.invoice_number,
          date: invoice.created_at.toISOString().split('T')[0],
          clientName: client ? client.name : 'Unknown',
          gstin: client ? client.gstin || 'Not Registered' : 'Unknown',
          invoiceType: isB2B ? 'B2B' : 'B2C',
          taxableValue: invoice.amount,
          cgst,
          sgst,
          igst,
          total: invoice.total_amount,
          status: invoice.status
        };
      });

      res.json({
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        summary: gstSummary,
        invoices: invoiceDetails
      });
    } catch (error) {
      console.error('Error generating GST report:', error);
      res.status(500).json({ error: 'Failed to generate GST report' });
    }
  }
);

export default router;