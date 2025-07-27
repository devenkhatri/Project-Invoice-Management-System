import express, { Request, Response } from 'express';
import { SheetsService } from '../services/sheets.service';
import { Invoice } from '../models/Invoice';
import { Client } from '../models/Client';
import { Project } from '../models/Project';
import { TimeEntry } from '../models/TimeEntry';
import { validateInvoice } from '../validation/schemas';
import { authenticateToken } from '../middleware/auth';
import { validationResult } from 'express-validator';
import { AutomationService } from '../services/automation';

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};
import { InvoiceStatus, PaymentStatus, QueryOptions } from '../types';
import { body, query, param } from 'express-validator';
import { generateInvoicePDF, sendInvoiceEmail } from '../services/invoice.service';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Validation schemas for invoice operations
const createInvoiceValidation = [
  body('client_id').isString().notEmpty().withMessage('Client ID is required'),
  body('project_id').optional().isString(),
  body('line_items').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('line_items.*.description').isString().notEmpty().withMessage('Line item description is required'),
  body('line_items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be positive'),
  body('line_items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('line_items.*.tax_rate').isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('line_items.*.hsn_sac_code').optional().isString(),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('issue_date').isISO8601().withMessage('Issue date must be a valid date'),
  body('due_date').isISO8601().withMessage('Due date must be a valid date'),
  body('payment_terms').optional().isString(),
  body('notes').optional().isString(),
  body('terms_conditions').optional().isString(),
  body('is_recurring').optional().isBoolean(),
  body('recurring_frequency').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly']),
  body('discount_percentage').optional().isFloat({ min: 0, max: 100 }),
  body('discount_amount').optional().isFloat({ min: 0 })
];

const updateInvoiceValidation = [
  param('id').isString().notEmpty().withMessage('Invoice ID is required'),
  body('client_id').optional().isString(),
  body('project_id').optional().isString(),
  body('line_items').optional().isArray(),
  body('status').optional().isIn(Object.values(InvoiceStatus)),
  body('payment_status').optional().isIn(Object.values(PaymentStatus)),
  body('notes').optional().isString(),
  body('terms_conditions').optional().isString(),
  body('discount_percentage').optional().isFloat({ min: 0, max: 100 }),
  body('discount_amount').optional().isFloat({ min: 0 })
];

const queryInvoicesValidation = [
  query('status').optional().isIn(Object.values(InvoiceStatus)),
  query('client_id').optional().isString(),
  query('project_id').optional().isString(),
  query('payment_status').optional().isIn(Object.values(PaymentStatus)),
  query('from_date').optional().isISO8601(),
  query('to_date').optional().isISO8601(),
  query('currency').optional().isString(),
  query('is_recurring').optional().isBoolean(),
  query('overdue_only').optional().isBoolean(),
  query('sort_by').optional().isIn(['issue_date', 'due_date', 'total_amount', 'created_at']),
  query('sort_order').optional().isIn(['asc', 'desc']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
];

// GET /api/invoices - List invoices with filtering
router.get('/', queryInvoicesValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    
    // Build query options from request parameters
    const queryOptions: QueryOptions = {
      filters: [],
      sortBy: req.query.sort_by as string || 'created_at',
      sortOrder: req.query.sort_order as 'asc' | 'desc' || 'desc',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    // Add filters based on query parameters
    if (req.query.status) {
      queryOptions.filters!.push({
        column: 'status',
        operator: 'eq',
        value: req.query.status
      });
    }

    if (req.query.client_id) {
      queryOptions.filters!.push({
        column: 'client_id',
        operator: 'eq',
        value: req.query.client_id
      });
    }

    if (req.query.project_id) {
      queryOptions.filters!.push({
        column: 'project_id',
        operator: 'eq',
        value: req.query.project_id
      });
    }

    if (req.query.payment_status) {
      queryOptions.filters!.push({
        column: 'payment_status',
        operator: 'eq',
        value: req.query.payment_status
      });
    }

    if (req.query.currency) {
      queryOptions.filters!.push({
        column: 'currency',
        operator: 'eq',
        value: req.query.currency
      });
    }

    if (req.query.is_recurring !== undefined) {
      queryOptions.filters!.push({
        column: 'is_recurring',
        operator: 'eq',
        value: req.query.is_recurring === 'true'
      });
    }

    // Get invoices from sheets
    const invoiceData = await sheetsService.query('Invoices', queryOptions);
    
    // Convert to Invoice objects and apply additional filters
    let invoices = invoiceData.map(data => {
      try {
        return createInvoiceFromData(data);
      } catch (error) {
        console.error('Error creating invoice object:', error);
        return null;
      }
    }).filter(invoice => invoice !== null) as Invoice[];

    // Apply date range filters
    if (req.query.from_date) {
      const fromDate = new Date(req.query.from_date as string);
      invoices = invoices.filter(invoice => new Date(invoice.issue_date) >= fromDate);
    }

    if (req.query.to_date) {
      const toDate = new Date(req.query.to_date as string);
      invoices = invoices.filter(invoice => new Date(invoice.issue_date) <= toDate);
    }

    // Filter overdue invoices if requested
    if (req.query.overdue_only === 'true') {
      invoices = invoices.filter(invoice => invoice.isOverdue());
    }

    // Get client information for each invoice
    const clientIds = [...new Set(invoices.map(inv => inv.client_id))];
    const clientsData = await Promise.all(
      clientIds.map(id => sheetsService.read('Clients', id))
    );
    
    const clientsMap = new Map();
    clientsData.forEach(clientArray => {
      if (clientArray.length > 0) {
        const client = new Client(clientArray[0]);
        clientsMap.set(client.id, client);
      }
    });

    // Enrich invoices with client information
    const enrichedInvoices = invoices.map(invoice => ({
      ...invoice.toJSON(),
      client: clientsMap.get(invoice.client_id) || null,
      days_until_due: invoice.getDaysUntilDue(),
      days_overdue: invoice.getDaysOverdue(),
      remaining_amount: invoice.getRemainingAmount(),
      is_overdue: invoice.isOverdue()
    }));

    res.json({
      success: true,
      data: enrichedInvoices,
      pagination: {
        total: enrichedInvoices.length,
        limit: queryOptions.limit,
        offset: queryOptions.offset
      }
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/invoices/:id - Get single invoice with details
router.get('/:id', param('id').isString().notEmpty(), validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get invoice data
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Get client information
    const clientData = await sheetsService.read('Clients', invoice.client_id);
    const client = clientData.length > 0 ? new Client(clientData[0]) : null;

    // Get project information if available
    let project = null;
    if (invoice.project_id) {
      const projectData = await sheetsService.read('Projects', invoice.project_id);
      if (projectData.length > 0) {
        project = new Project(projectData[0]);
      }
    }

    // Get payment history (this would be from a separate payments table in a real implementation)
    // For now, we'll simulate payment history based on the invoice data
    const paymentHistory = [];
    if (invoice.paid_amount > 0) {
      paymentHistory.push({
        id: `payment_${invoice.id}`,
        amount: invoice.paid_amount,
        date: invoice.payment_date,
        method: invoice.payment_method || 'Unknown',
        status: 'completed'
      });
    }

    res.json({
      success: true,
      data: {
        ...invoice.toJSON(),
        client,
        project,
        payment_history: paymentHistory,
        days_until_due: invoice.getDaysUntilDue(),
        days_overdue: invoice.getDaysOverdue(),
        remaining_amount: invoice.getRemainingAmount(),
        is_overdue: invoice.isOverdue(),
        can_apply_late_fee: invoice.isOverdue() && invoice.getRemainingAmount() > 0
      }
    });

  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', createInvoiceValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();

    // Validate client exists
    const clientData = await sheetsService.read('Clients', req.body.client_id);
    if (clientData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
    }

    const client = new Client(clientData[0]);

    // Validate project exists if provided
    let project = null;
    if (req.body.project_id) {
      const projectData = await sheetsService.read('Projects', req.body.project_id);
      if (projectData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project not found'
        });
      }
      project = new Project(projectData[0]);
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(sheetsService);

    // Prepare invoice data
    const invoiceData = {
      ...req.body,
      invoice_number: invoiceNumber,
      currency: req.body.currency || client.default_currency || 'INR',
      payment_terms: req.body.payment_terms || client.payment_terms || 'Net 30',
      status: InvoiceStatus.DRAFT,
      payment_status: PaymentStatus.PENDING,
      paid_amount: 0
    };

    // Process line items
    invoiceData.line_items = req.body.line_items.map((item: any, index: number) => ({
      ...item,
      id: `li_${Date.now()}_${index}`,
      total_price: item.quantity * item.unit_price,
      tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
    }));

    // Create invoice object to calculate amounts
    const invoice = new Invoice(invoiceData);
    
    // Calculate tax breakdown and totals
    invoice.recalculateAmounts(client);

    // Save to sheets
    const invoiceId = await sheetsService.create('Invoices', {
      ...invoice.toJSON(),
      // Flatten complex objects for sheets storage
      line_items: JSON.stringify(invoice.line_items),
      tax_breakdown: JSON.stringify(invoice.tax_breakdown)
    });

    // Return created invoice with full details
    const createdInvoice = { ...invoice.toJSON(), id: invoiceId };

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        ...createdInvoice,
        client,
        project
      }
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});// P
// POST /api/invoices/from-project/:projectId - Create invoice from project data
router.post('/from-project/:projectId', 
  param('projectId').isString().notEmpty(),
  body('include_time_entries').optional().isBoolean(),
  body('include_expenses').optional().isBoolean(),
  body('hourly_rate').optional().isFloat({ min: 0 }),
  validateRequest, 
  async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const projectId = req.params.projectId;

    // Get project data
    const projectData = await sheetsService.read('Projects', projectId);
    if (projectData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const project = new Project(projectData[0]);

    // Get client data
    const clientData = await sheetsService.read('Clients', project.client_id);
    if (clientData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found for project'
      });
    }

    const client = new Client(clientData[0]);

    // Get time entries for the project
    const timeEntriesData = await sheetsService.query('Time_Entries', {
      filters: [
        { column: 'project_id', operator: 'eq', value: projectId },
        { column: 'is_billable', operator: 'eq', value: true }
      ]
    });

    const lineItems = [];

    // Add time entries as line items if requested
    if (req.body.include_time_entries !== false && timeEntriesData.length > 0) {
      const hourlyRate = req.body.hourly_rate || project.hourly_rate || 50; // Default rate
      const totalHours = timeEntriesData.reduce((sum, entry) => sum + parseFloat(entry.hours || 0), 0);
      
      if (totalHours > 0) {
        lineItems.push({
          description: `Development work for ${project.name}`,
          quantity: totalHours,
          unit_price: hourlyRate,
          tax_rate: 18, // Default GST rate
          hsn_sac_code: '998314' // Software development services
        });
      }
    }

    // Add expenses as line items if requested
    if (req.body.include_expenses !== false) {
      const expensesData = await sheetsService.query('Expenses', {
        filters: [
          { column: 'project_id', operator: 'eq', value: projectId },
          { column: 'is_billable', operator: 'eq', value: true }
        ]
      });

      expensesData.forEach(expense => {
        lineItems.push({
          description: `Expense: ${expense.description}`,
          quantity: 1,
          unit_price: parseFloat(expense.amount || 0),
          tax_rate: expense.tax_rate || 0,
          hsn_sac_code: expense.hsn_sac_code || ''
        });
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No billable items found for this project'
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(sheetsService);

    // Create invoice data
    const invoiceData = {
      invoice_number: invoiceNumber,
      client_id: client.id,
      project_id: projectId,
      line_items: lineItems,
      currency: client.default_currency || 'INR',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: calculateDueDate(client.payment_terms),
      payment_terms: client.payment_terms,
      notes: `Invoice for project: ${project.name}`,
      status: InvoiceStatus.DRAFT,
      payment_status: PaymentStatus.PENDING,
      paid_amount: 0,
      is_recurring: false
    };

    // Process line items with IDs
    const processedLineItems = lineItems.map((item, index) => ({
      ...item,
      id: `li_${Date.now()}_${index}`,
      total_price: item.quantity * item.unit_price,
      tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
    }));

    // Create invoice data with processed line items
    const completeInvoiceData = {
      ...invoiceData,
      line_items: processedLineItems
    };

    // Create invoice object and calculate amounts
    const invoice = new Invoice(completeInvoiceData);
    invoice.recalculateAmounts(client);

    // Save to sheets
    const invoiceId = await sheetsService.create('Invoices', {
      ...invoice.toJSON(),
      line_items: JSON.stringify(invoice.line_items),
      tax_breakdown: JSON.stringify(invoice.tax_breakdown)
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created from project data',
      data: {
        ...invoice.toJSON(),
        id: invoiceId,
        client,
        project
      }
    });

  } catch (error) {
    console.error('Error creating invoice from project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice from project',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', updateInvoiceValidation, validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get existing invoice
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const existingInvoice = createInvoiceFromData(invoiceData[0]);

    // Check if invoice can be updated (not paid or cancelled)
    if (existingInvoice.status === InvoiceStatus.PAID || existingInvoice.status === InvoiceStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid or cancelled invoices'
      });
    }

    // Validate client if being updated
    if (req.body.client_id && req.body.client_id !== existingInvoice.client_id) {
      const clientData = await sheetsService.read('Clients', req.body.client_id);
      if (clientData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Prepare update data
    const updateData = { ...req.body };

    // Process line items if provided
    if (req.body.line_items) {
      updateData.line_items = req.body.line_items.map((item: any, index: number) => ({
        ...item,
        id: item.id || `li_${Date.now()}_${index}`,
        total_price: item.quantity * item.unit_price,
        tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
      }));
    }

    // Create updated invoice object
    const updatedInvoiceData = {
      ...existingInvoice.toJSON(),
      ...updateData
    };

    const updatedInvoice = createInvoiceFromData(updatedInvoiceData);

    // Recalculate amounts if line items or client changed
    if (req.body.line_items || req.body.client_id) {
      const clientId = req.body.client_id || existingInvoice.client_id;
      const clientData = await sheetsService.read('Clients', clientId);
      if (clientData.length > 0) {
        const client = new Client(clientData[0]);
        updatedInvoice.recalculateAmounts(client);
      }
    }

    // Update in sheets
    const success = await sheetsService.update('Invoices', invoiceId, {
      ...updatedInvoice.toJSON(),
      line_items: JSON.stringify(updatedInvoice.line_items),
      tax_breakdown: JSON.stringify(updatedInvoice.tax_breakdown)
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update invoice'
      });
    }

    // Trigger automation workflows for status changes
    if (req.body.status && req.body.status !== existingInvoice.status) {
      try {
        const automationService = AutomationService.getInstance();
        
        if (req.body.status === InvoiceStatus.OVERDUE) {
          await automationService.onInvoiceOverdue(invoiceId);
        }
      } catch (error) {
        console.error('Failed to trigger invoice automation:', error);
        // Don't fail the request if automation fails
      }
    }

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: updatedInvoice.toJSON()
    });

  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/invoices/:id - Void/cancel invoice
router.delete('/:id', param('id').isString().notEmpty(), validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get existing invoice
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Check if invoice can be cancelled
    if (invoice.status === InvoiceStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a paid invoice'
      });
    }

    // Cancel the invoice
    invoice.cancel();

    // Update in sheets
    const success = await sheetsService.update('Invoices', invoiceId, {
      status: invoice.status,
      updated_at: invoice.updated_at
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel invoice'
      });
    }

    res.json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice.toJSON()
    });

  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/invoices/:id/send - Send invoice via email
router.post('/:id/send', 
  param('id').isString().notEmpty(),
  body('email').optional().isEmail(),
  body('subject').optional().isString(),
  body('message').optional().isString(),
  validateRequest, 
  async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get invoice data
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Get client data
    const clientData = await sheetsService.read('Clients', invoice.client_id);
    if (clientData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
    }

    const client = new Client(clientData[0]);

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, client);

    // Send email
    const emailResult = await sendInvoiceEmail({
      invoice,
      client,
      pdfBuffer,
      recipientEmail: req.body.email || client.email,
      subject: req.body.subject,
      message: req.body.message
    });

    if (emailResult.success) {
      // Update invoice status to sent
      invoice.markAsSent();
      await sheetsService.update('Invoices', invoiceId, {
        status: invoice.status,
        updated_at: invoice.updated_at
      });
    }

    res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Invoice sent successfully' : 'Failed to send invoice',
      data: {
        invoice: invoice.toJSON(),
        email_sent: emailResult.success,
        email_error: emailResult.error
      }
    });

  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/invoices/:id/pdf - Generate and download invoice PDF
router.get('/:id/pdf', param('id').isString().notEmpty(), validateRequest, async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get invoice data
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Get client data
    const clientData = await sheetsService.read('Clients', invoice.client_id);
    if (clientData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client not found'
      });
    }

    const client = new Client(clientData[0]);

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, client);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/invoices/:id/payment - Record payment
router.post('/:id/payment',
  param('id').isString().notEmpty(),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'),
  body('payment_date').isISO8601().withMessage('Payment date must be valid'),
  body('payment_method').optional().isString(),
  body('transaction_id').optional().isString(),
  body('notes').optional().isString(),
  validateRequest,
  async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get invoice data
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Validate payment amount
    const paymentAmount = parseFloat(req.body.amount);
    const remainingAmount = invoice.getRemainingAmount();

    if (paymentAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingAmount})`
      });
    }

    // Record payment
    invoice.recordPayment(
      paymentAmount,
      req.body.payment_date,
      req.body.payment_method
    );

    // Update invoice in sheets
    const success = await sheetsService.update('Invoices', invoiceId, {
      paid_amount: invoice.paid_amount,
      payment_status: invoice.payment_status,
      payment_date: invoice.payment_date,
      payment_method: invoice.payment_method,
      status: invoice.status,
      updated_at: invoice.updated_at
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to record payment'
      });
    }

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        invoice: invoice.toJSON(),
        payment: {
          amount: paymentAmount,
          date: req.body.payment_date,
          method: req.body.payment_method,
          transaction_id: req.body.transaction_id,
          notes: req.body.notes
        },
        remaining_amount: invoice.getRemainingAmount(),
        is_fully_paid: invoice.isFullyPaid()
      }
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/invoices/:id/late-fee - Apply late fee
router.post('/:id/late-fee',
  param('id').isString().notEmpty(),
  body('late_fee_rate').optional().isFloat({ min: 0, max: 100 }),
  body('max_late_fee').optional().isFloat({ min: 0 }),
  validateRequest,
  async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();
    const invoiceId = req.params.id;

    // Get invoice data
    const invoiceData = await sheetsService.read('Invoices', invoiceId);
    if (invoiceData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = createInvoiceFromData(invoiceData[0]);

    // Check if invoice is overdue
    if (!invoice.isOverdue()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply late fee to non-overdue invoice'
      });
    }

    // Apply late fee
    const lateFeeRate = req.body.late_fee_rate || 1.5; // Default 1.5% per day
    const maxLateFee = req.body.max_late_fee;
    
    const previousLateFee = invoice.late_fee_applied || 0;
    invoice.applyLateFee(lateFeeRate, maxLateFee);
    const newLateFee = (invoice.late_fee_applied || 0) - previousLateFee;

    // Update invoice in sheets
    const success = await sheetsService.update('Invoices', invoiceId, {
      late_fee_applied: invoice.late_fee_applied,
      total_amount: invoice.total_amount,
      updated_at: invoice.updated_at
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to apply late fee'
      });
    }

    res.json({
      success: true,
      message: 'Late fee applied successfully',
      data: {
        invoice: invoice.toJSON(),
        late_fee_applied: newLateFee,
        total_late_fees: invoice.late_fee_applied,
        days_overdue: invoice.getDaysOverdue()
      }
    });

  } catch (error) {
    console.error('Error applying late fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply late fee',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/invoices/analytics/summary - Get invoice analytics
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const sheetsService = SheetsService.getInstance();

    // Get all invoices
    const invoicesData = await sheetsService.read('Invoices');
    const invoices = invoicesData.map(data => createInvoiceFromData(data));

    // Calculate analytics
    const analytics = {
      total_invoices: invoices.length,
      total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
      total_paid: invoices.reduce((sum, inv) => sum + inv.paid_amount, 0),
      total_outstanding: invoices.reduce((sum, inv) => sum + inv.getRemainingAmount(), 0),
      
      by_status: {
        draft: invoices.filter(inv => inv.status === InvoiceStatus.DRAFT).length,
        sent: invoices.filter(inv => inv.status === InvoiceStatus.SENT).length,
        paid: invoices.filter(inv => inv.status === InvoiceStatus.PAID).length,
        overdue: invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE).length,
        cancelled: invoices.filter(inv => inv.status === InvoiceStatus.CANCELLED).length
      },
      
      by_payment_status: {
        pending: invoices.filter(inv => inv.payment_status === PaymentStatus.PENDING).length,
        partial: invoices.filter(inv => inv.payment_status === PaymentStatus.PARTIAL).length,
        paid: invoices.filter(inv => inv.payment_status === PaymentStatus.PAID).length
      },
      
      overdue_invoices: invoices.filter(inv => inv.isOverdue()).length,
      overdue_amount: invoices.filter(inv => inv.isOverdue()).reduce((sum, inv) => sum + inv.getRemainingAmount(), 0),
      
      average_invoice_amount: invoices.length > 0 ? invoices.reduce((sum, inv) => sum + inv.total_amount, 0) / invoices.length : 0,
      average_payment_time: calculateAveragePaymentTime(invoices),
      
      recurring_invoices: invoices.filter(inv => inv.is_recurring).length,
      
      monthly_revenue: calculateMonthlyRevenue(invoices),
      top_clients: await calculateTopClients(sheetsService, invoices)
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error generating invoice analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to process invoice data from sheets
function processInvoiceData(data: any): any {
  return {
    ...data,
    line_items: typeof data.line_items === 'string' ? JSON.parse(data.line_items) : data.line_items || [],
    tax_breakdown: typeof data.tax_breakdown === 'string' ? JSON.parse(data.tax_breakdown) : data.tax_breakdown || {
      cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0, igst_rate: 0, igst_amount: 0, total_tax_amount: 0
    }
  };
}

// Helper function to create Invoice from sheets data
function createInvoiceFromData(data: any): Invoice {
  return new Invoice(processInvoiceData(data));
}

// Utility functions
async function generateInvoiceNumber(sheetsService: SheetsService): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;
  
  // Get existing invoices to determine next number
  const invoices = await sheetsService.query('Invoices', {
    filters: [
      { column: 'invoice_number', operator: 'contains', value: prefix }
    ]
  });
  
  const nextNumber = invoices.length + 1;
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

function calculateDueDate(paymentTerms: string): string {
  const match = paymentTerms.match(/(\d+)/);
  const days = match ? parseInt(match[1]) : 30;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  
  return dueDate.toISOString().split('T')[0];
}

function calculateAveragePaymentTime(invoices: Invoice[]): number {
  const paidInvoices = invoices.filter(inv => inv.isFullyPaid() && inv.payment_date);
  
  if (paidInvoices.length === 0) return 0;
  
  const totalDays = paidInvoices.reduce((sum, inv) => {
    const issueDate = new Date(inv.issue_date);
    const paymentDate = new Date(inv.payment_date!);
    const diffTime = paymentDate.getTime() - issueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);
  
  return Math.round(totalDays / paidInvoices.length);
}

function calculateMonthlyRevenue(invoices: Invoice[]): any[] {
  const monthlyData: { [key: string]: number } = {};
  
  invoices.forEach(invoice => {
    if (invoice.payment_status === PaymentStatus.PAID) {
      const month = invoice.payment_date ? invoice.payment_date.substring(0, 7) : invoice.issue_date.substring(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + invoice.paid_amount;
    }
  });
  
  return Object.entries(monthlyData)
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function calculateTopClients(sheetsService: SheetsService, invoices: Invoice[]): Promise<any[]> {
  const clientRevenue: { [key: string]: number } = {};
  
  invoices.forEach(invoice => {
    clientRevenue[invoice.client_id] = (clientRevenue[invoice.client_id] || 0) + invoice.paid_amount;
  });
  
  const topClientIds = Object.entries(clientRevenue)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([clientId]) => clientId);
  
  const topClients = [];
  for (const clientId of topClientIds) {
    const clientData = await sheetsService.read('Clients', clientId);
    if (clientData.length > 0) {
      const client = new Client(clientData[0]);
      topClients.push({
        client_id: clientId,
        client_name: client.name,
        total_revenue: clientRevenue[clientId],
        invoice_count: invoices.filter(inv => inv.client_id === clientId).length
      });
    }
  }
  
  return topClients;
}

export default router;