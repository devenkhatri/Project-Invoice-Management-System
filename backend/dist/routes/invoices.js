"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sheets_service_1 = require("../services/sheets.service");
const Invoice_1 = require("../models/Invoice");
const Client_1 = require("../models/Client");
const Project_1 = require("../models/Project");
const auth_1 = require("../middleware/auth");
const express_validator_1 = require("express-validator");
const automation_1 = require("../services/automation");
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};
const types_1 = require("../types");
const express_validator_2 = require("express-validator");
const invoice_service_1 = require("../services/invoice.service");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
const createInvoiceValidation = [
    (0, express_validator_2.body)('client_id').isString().notEmpty().withMessage('Client ID is required'),
    (0, express_validator_2.body)('project_id').optional().isString(),
    (0, express_validator_2.body)('line_items').isArray({ min: 1 }).withMessage('At least one line item is required'),
    (0, express_validator_2.body)('line_items.*.description').isString().notEmpty().withMessage('Line item description is required'),
    (0, express_validator_2.body)('line_items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be positive'),
    (0, express_validator_2.body)('line_items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
    (0, express_validator_2.body)('line_items.*.tax_rate').isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
    (0, express_validator_2.body)('line_items.*.hsn_sac_code').optional().isString(),
    (0, express_validator_2.body)('currency').optional().isString().isLength({ min: 3, max: 3 }),
    (0, express_validator_2.body)('issue_date').isISO8601().withMessage('Issue date must be a valid date'),
    (0, express_validator_2.body)('due_date').isISO8601().withMessage('Due date must be a valid date'),
    (0, express_validator_2.body)('payment_terms').optional().isString(),
    (0, express_validator_2.body)('notes').optional().isString(),
    (0, express_validator_2.body)('terms_conditions').optional().isString(),
    (0, express_validator_2.body)('is_recurring').optional().isBoolean(),
    (0, express_validator_2.body)('recurring_frequency').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly']),
    (0, express_validator_2.body)('discount_percentage').optional().isFloat({ min: 0, max: 100 }),
    (0, express_validator_2.body)('discount_amount').optional().isFloat({ min: 0 })
];
const updateInvoiceValidation = [
    (0, express_validator_2.param)('id').isString().notEmpty().withMessage('Invoice ID is required'),
    (0, express_validator_2.body)('client_id').optional().isString(),
    (0, express_validator_2.body)('project_id').optional().isString(),
    (0, express_validator_2.body)('line_items').optional().isArray(),
    (0, express_validator_2.body)('status').optional().isIn(Object.values(types_1.InvoiceStatus)),
    (0, express_validator_2.body)('payment_status').optional().isIn(Object.values(types_1.PaymentStatus)),
    (0, express_validator_2.body)('notes').optional().isString(),
    (0, express_validator_2.body)('terms_conditions').optional().isString(),
    (0, express_validator_2.body)('discount_percentage').optional().isFloat({ min: 0, max: 100 }),
    (0, express_validator_2.body)('discount_amount').optional().isFloat({ min: 0 })
];
const queryInvoicesValidation = [
    (0, express_validator_2.query)('status').optional().isIn(Object.values(types_1.InvoiceStatus)),
    (0, express_validator_2.query)('client_id').optional().isString(),
    (0, express_validator_2.query)('project_id').optional().isString(),
    (0, express_validator_2.query)('payment_status').optional().isIn(Object.values(types_1.PaymentStatus)),
    (0, express_validator_2.query)('from_date').optional().isISO8601(),
    (0, express_validator_2.query)('to_date').optional().isISO8601(),
    (0, express_validator_2.query)('currency').optional().isString(),
    (0, express_validator_2.query)('is_recurring').optional().isBoolean(),
    (0, express_validator_2.query)('overdue_only').optional().isBoolean(),
    (0, express_validator_2.query)('sort_by').optional().isIn(['issue_date', 'due_date', 'total_amount', 'created_at']),
    (0, express_validator_2.query)('sort_order').optional().isIn(['asc', 'desc']),
    (0, express_validator_2.query)('limit').optional().isInt({ min: 1, max: 100 }),
    (0, express_validator_2.query)('offset').optional().isInt({ min: 0 })
];
router.get('/', queryInvoicesValidation, validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const queryOptions = {
            filters: [],
            sortBy: req.query.sort_by || 'created_at',
            sortOrder: req.query.sort_order || 'desc',
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined
        };
        if (req.query.status) {
            queryOptions.filters.push({
                column: 'status',
                operator: 'eq',
                value: req.query.status
            });
        }
        if (req.query.client_id) {
            queryOptions.filters.push({
                column: 'client_id',
                operator: 'eq',
                value: req.query.client_id
            });
        }
        if (req.query.project_id) {
            queryOptions.filters.push({
                column: 'project_id',
                operator: 'eq',
                value: req.query.project_id
            });
        }
        if (req.query.payment_status) {
            queryOptions.filters.push({
                column: 'payment_status',
                operator: 'eq',
                value: req.query.payment_status
            });
        }
        if (req.query.currency) {
            queryOptions.filters.push({
                column: 'currency',
                operator: 'eq',
                value: req.query.currency
            });
        }
        if (req.query.is_recurring !== undefined) {
            queryOptions.filters.push({
                column: 'is_recurring',
                operator: 'eq',
                value: req.query.is_recurring === 'true'
            });
        }
        const invoiceData = await sheetsService.query('Invoices', queryOptions);
        let invoices = invoiceData.map(data => {
            try {
                return createInvoiceFromData(data);
            }
            catch (error) {
                console.error('Error creating invoice object:', error);
                return null;
            }
        }).filter(invoice => invoice !== null);
        if (req.query.from_date) {
            const fromDate = new Date(req.query.from_date);
            invoices = invoices.filter(invoice => new Date(invoice.issue_date) >= fromDate);
        }
        if (req.query.to_date) {
            const toDate = new Date(req.query.to_date);
            invoices = invoices.filter(invoice => new Date(invoice.issue_date) <= toDate);
        }
        if (req.query.overdue_only === 'true') {
            invoices = invoices.filter(invoice => invoice.isOverdue());
        }
        const clientIds = [...new Set(invoices.map(inv => inv.client_id))];
        const clientsData = await Promise.all(clientIds.map(id => sheetsService.read('Clients', id)));
        const clientsMap = new Map();
        clientsData.forEach(clientArray => {
            if (clientArray.length > 0) {
                const client = new Client_1.Client(clientArray[0]);
                clientsMap.set(client.id, client);
            }
        });
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
    }
    catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id', (0, express_validator_2.param)('id').isString().notEmpty(), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        const clientData = await sheetsService.read('Clients', invoice.client_id);
        const client = clientData.length > 0 ? new Client_1.Client(clientData[0]) : null;
        let project = null;
        if (invoice.project_id) {
            const projectData = await sheetsService.read('Projects', invoice.project_id);
            if (projectData.length > 0) {
                project = new Project_1.Project(projectData[0]);
            }
        }
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
    }
    catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/', createInvoiceValidation, validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const clientData = await sheetsService.read('Clients', req.body.client_id);
        if (clientData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Client not found'
            });
        }
        const client = new Client_1.Client(clientData[0]);
        let project = null;
        if (req.body.project_id) {
            const projectData = await sheetsService.read('Projects', req.body.project_id);
            if (projectData.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            project = new Project_1.Project(projectData[0]);
        }
        const invoiceNumber = await generateInvoiceNumber(sheetsService);
        const invoiceData = {
            ...req.body,
            invoice_number: invoiceNumber,
            currency: req.body.currency || client.default_currency || 'INR',
            payment_terms: req.body.payment_terms || client.payment_terms || 'Net 30',
            status: types_1.InvoiceStatus.DRAFT,
            payment_status: types_1.PaymentStatus.PENDING,
            paid_amount: 0
        };
        invoiceData.line_items = req.body.line_items.map((item, index) => ({
            ...item,
            id: `li_${Date.now()}_${index}`,
            total_price: item.quantity * item.unit_price,
            tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
        }));
        const invoice = new Invoice_1.Invoice(invoiceData);
        invoice.recalculateAmounts(client);
        const invoiceId = await sheetsService.create('Invoices', {
            ...invoice.toJSON(),
            line_items: JSON.stringify(invoice.line_items),
            tax_breakdown: JSON.stringify(invoice.tax_breakdown)
        });
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
    }
    catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/from-project/:projectId', (0, express_validator_2.param)('projectId').isString().notEmpty(), (0, express_validator_2.body)('include_time_entries').optional().isBoolean(), (0, express_validator_2.body)('include_expenses').optional().isBoolean(), (0, express_validator_2.body)('hourly_rate').optional().isFloat({ min: 0 }), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const projectId = req.params.projectId;
        const projectData = await sheetsService.read('Projects', projectId);
        if (projectData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Project not found'
            });
        }
        const project = new Project_1.Project(projectData[0]);
        const clientData = await sheetsService.read('Clients', project.client_id);
        if (clientData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Client not found for project'
            });
        }
        const client = new Client_1.Client(clientData[0]);
        const timeEntriesData = await sheetsService.query('Time_Entries', {
            filters: [
                { column: 'project_id', operator: 'eq', value: projectId },
                { column: 'is_billable', operator: 'eq', value: true }
            ]
        });
        const lineItems = [];
        if (req.body.include_time_entries !== false && timeEntriesData.length > 0) {
            const hourlyRate = req.body.hourly_rate || project.hourly_rate || 50;
            const totalHours = timeEntriesData.reduce((sum, entry) => sum + parseFloat(entry.hours || 0), 0);
            if (totalHours > 0) {
                lineItems.push({
                    description: `Development work for ${project.name}`,
                    quantity: totalHours,
                    unit_price: hourlyRate,
                    tax_rate: 18,
                    hsn_sac_code: '998314'
                });
            }
        }
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
        const invoiceNumber = await generateInvoiceNumber(sheetsService);
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
            status: types_1.InvoiceStatus.DRAFT,
            payment_status: types_1.PaymentStatus.PENDING,
            paid_amount: 0,
            is_recurring: false
        };
        const processedLineItems = lineItems.map((item, index) => ({
            ...item,
            id: `li_${Date.now()}_${index}`,
            total_price: item.quantity * item.unit_price,
            tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
        }));
        const completeInvoiceData = {
            ...invoiceData,
            line_items: processedLineItems
        };
        const invoice = new Invoice_1.Invoice(completeInvoiceData);
        invoice.recalculateAmounts(client);
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
    }
    catch (error) {
        console.error('Error creating invoice from project:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice from project',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/:id', updateInvoiceValidation, validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const existingInvoice = createInvoiceFromData(invoiceData[0]);
        if (existingInvoice.status === types_1.InvoiceStatus.PAID || existingInvoice.status === types_1.InvoiceStatus.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Cannot update paid or cancelled invoices'
            });
        }
        if (req.body.client_id && req.body.client_id !== existingInvoice.client_id) {
            const clientData = await sheetsService.read('Clients', req.body.client_id);
            if (clientData.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Client not found'
                });
            }
        }
        const updateData = { ...req.body };
        if (req.body.line_items) {
            updateData.line_items = req.body.line_items.map((item, index) => ({
                ...item,
                id: item.id || `li_${Date.now()}_${index}`,
                total_price: item.quantity * item.unit_price,
                tax_amount: (item.quantity * item.unit_price * item.tax_rate) / 100
            }));
        }
        const updatedInvoiceData = {
            ...existingInvoice.toJSON(),
            ...updateData
        };
        const updatedInvoice = createInvoiceFromData(updatedInvoiceData);
        if (req.body.line_items || req.body.client_id) {
            const clientId = req.body.client_id || existingInvoice.client_id;
            const clientData = await sheetsService.read('Clients', clientId);
            if (clientData.length > 0) {
                const client = new Client_1.Client(clientData[0]);
                updatedInvoice.recalculateAmounts(client);
            }
        }
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
        if (req.body.status && req.body.status !== existingInvoice.status) {
            try {
                const automationService = automation_1.AutomationService.getInstance();
                if (req.body.status === types_1.InvoiceStatus.OVERDUE) {
                    await automationService.onInvoiceOverdue(invoiceId);
                }
            }
            catch (error) {
                console.error('Failed to trigger invoice automation:', error);
            }
        }
        res.json({
            success: true,
            message: 'Invoice updated successfully',
            data: updatedInvoice.toJSON()
        });
    }
    catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.delete('/:id', (0, express_validator_2.param)('id').isString().notEmpty(), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        if (invoice.status === types_1.InvoiceStatus.PAID) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a paid invoice'
            });
        }
        invoice.cancel();
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
    }
    catch (error) {
        console.error('Error cancelling invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel invoice',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/send', (0, express_validator_2.param)('id').isString().notEmpty(), (0, express_validator_2.body)('email').optional().isEmail(), (0, express_validator_2.body)('subject').optional().isString(), (0, express_validator_2.body)('message').optional().isString(), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        const clientData = await sheetsService.read('Clients', invoice.client_id);
        if (clientData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Client not found'
            });
        }
        const client = new Client_1.Client(clientData[0]);
        const pdfBuffer = await (0, invoice_service_1.generateInvoicePDF)(invoice, client);
        const emailResult = await (0, invoice_service_1.sendInvoiceEmail)({
            invoice,
            client,
            pdfBuffer,
            recipientEmail: req.body.email || client.email,
            subject: req.body.subject,
            message: req.body.message
        });
        if (emailResult.success) {
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
    }
    catch (error) {
        console.error('Error sending invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invoice',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/:id/pdf', (0, express_validator_2.param)('id').isString().notEmpty(), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        const clientData = await sheetsService.read('Clients', invoice.client_id);
        if (clientData.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Client not found'
            });
        }
        const client = new Client_1.Client(clientData[0]);
        const pdfBuffer = await (0, invoice_service_1.generateInvoicePDF)(invoice, client);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoice_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate PDF',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/payment', (0, express_validator_2.param)('id').isString().notEmpty(), (0, express_validator_2.body)('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'), (0, express_validator_2.body)('payment_date').isISO8601().withMessage('Payment date must be valid'), (0, express_validator_2.body)('payment_method').optional().isString(), (0, express_validator_2.body)('transaction_id').optional().isString(), (0, express_validator_2.body)('notes').optional().isString(), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        const paymentAmount = parseFloat(req.body.amount);
        const remainingAmount = invoice.getRemainingAmount();
        if (paymentAmount > remainingAmount) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingAmount})`
            });
        }
        invoice.recordPayment(paymentAmount, req.body.payment_date, req.body.payment_method);
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
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/:id/late-fee', (0, express_validator_2.param)('id').isString().notEmpty(), (0, express_validator_2.body)('late_fee_rate').optional().isFloat({ min: 0, max: 100 }), (0, express_validator_2.body)('max_late_fee').optional().isFloat({ min: 0 }), validateRequest, async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoiceId = req.params.id;
        const invoiceData = await sheetsService.read('Invoices', invoiceId);
        if (invoiceData.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }
        const invoice = createInvoiceFromData(invoiceData[0]);
        if (!invoice.isOverdue()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot apply late fee to non-overdue invoice'
            });
        }
        const lateFeeRate = req.body.late_fee_rate || 1.5;
        const maxLateFee = req.body.max_late_fee;
        const previousLateFee = invoice.late_fee_applied || 0;
        invoice.applyLateFee(lateFeeRate, maxLateFee);
        const newLateFee = (invoice.late_fee_applied || 0) - previousLateFee;
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
    }
    catch (error) {
        console.error('Error applying late fee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply late fee',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/analytics/summary', async (req, res) => {
    try {
        const sheetsService = sheets_service_1.SheetsService.getInstance();
        const invoicesData = await sheetsService.read('Invoices');
        const invoices = invoicesData.map(data => createInvoiceFromData(data));
        const analytics = {
            total_invoices: invoices.length,
            total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
            total_paid: invoices.reduce((sum, inv) => sum + inv.paid_amount, 0),
            total_outstanding: invoices.reduce((sum, inv) => sum + inv.getRemainingAmount(), 0),
            by_status: {
                draft: invoices.filter(inv => inv.status === types_1.InvoiceStatus.DRAFT).length,
                sent: invoices.filter(inv => inv.status === types_1.InvoiceStatus.SENT).length,
                paid: invoices.filter(inv => inv.status === types_1.InvoiceStatus.PAID).length,
                overdue: invoices.filter(inv => inv.status === types_1.InvoiceStatus.OVERDUE).length,
                cancelled: invoices.filter(inv => inv.status === types_1.InvoiceStatus.CANCELLED).length
            },
            by_payment_status: {
                pending: invoices.filter(inv => inv.payment_status === types_1.PaymentStatus.PENDING).length,
                partial: invoices.filter(inv => inv.payment_status === types_1.PaymentStatus.PARTIAL).length,
                paid: invoices.filter(inv => inv.payment_status === types_1.PaymentStatus.PAID).length
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
    }
    catch (error) {
        console.error('Error generating invoice analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate analytics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
function processInvoiceData(data) {
    return {
        ...data,
        line_items: typeof data.line_items === 'string' ? JSON.parse(data.line_items) : data.line_items || [],
        tax_breakdown: typeof data.tax_breakdown === 'string' ? JSON.parse(data.tax_breakdown) : data.tax_breakdown || {
            cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0, igst_rate: 0, igst_amount: 0, total_tax_amount: 0
        }
    };
}
function createInvoiceFromData(data) {
    return new Invoice_1.Invoice(processInvoiceData(data));
}
async function generateInvoiceNumber(sheetsService) {
    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;
    const invoices = await sheetsService.query('Invoices', {
        filters: [
            { column: 'invoice_number', operator: 'contains', value: prefix }
        ]
    });
    const nextNumber = invoices.length + 1;
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
function calculateDueDate(paymentTerms) {
    const match = paymentTerms.match(/(\d+)/);
    const days = match ? parseInt(match[1]) : 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate.toISOString().split('T')[0];
}
function calculateAveragePaymentTime(invoices) {
    const paidInvoices = invoices.filter(inv => inv.isFullyPaid() && inv.payment_date);
    if (paidInvoices.length === 0)
        return 0;
    const totalDays = paidInvoices.reduce((sum, inv) => {
        const issueDate = new Date(inv.issue_date);
        const paymentDate = new Date(inv.payment_date);
        const diffTime = paymentDate.getTime() - issueDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + diffDays;
    }, 0);
    return Math.round(totalDays / paidInvoices.length);
}
function calculateMonthlyRevenue(invoices) {
    const monthlyData = {};
    invoices.forEach(invoice => {
        if (invoice.payment_status === types_1.PaymentStatus.PAID) {
            const month = invoice.payment_date ? invoice.payment_date.substring(0, 7) : invoice.issue_date.substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + invoice.paid_amount;
        }
    });
    return Object.entries(monthlyData)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month));
}
async function calculateTopClients(sheetsService, invoices) {
    const clientRevenue = {};
    invoices.forEach(invoice => {
        clientRevenue[invoice.client_id] = (clientRevenue[invoice.client_id] || 0) + invoice.paid_amount;
    });
    const topClientIds = Object.entries(clientRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([clientId]) => clientId);
    const topClients = [];
    for (const clientId of topClientIds) {
        const clientData = await sheetsService.read('Clients', clientId);
        if (clientData.length > 0) {
            const client = new Client_1.Client(clientData[0]);
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
exports.default = router;
//# sourceMappingURL=invoices.js.map