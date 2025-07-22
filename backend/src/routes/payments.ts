import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { GoogleSheetsService } from '../services/googleSheets';
import { 
  PaymentProcessingService, 
  LateFeeConfig
} from '../services/paymentProcessing';
import { PaymentGateway, PaymentStatus } from '../models/types';
import { Invoice, InvoiceStatus } from '../models';

const router = Router();

// Initialize services (will be injected in main app)
let sheetsService: GoogleSheetsService;
let paymentService: PaymentProcessingService;

export const initializePaymentRoutes = (
  sheets: GoogleSheetsService,
  payments: PaymentProcessingService
) => {
  sheetsService = sheets;
  paymentService = payments;
  return router;
};

// Generate payment link for invoice
router.post('/generate-link',
  authenticateToken,
  body('invoice_id').isString().notEmpty(),
  body('gateway').isIn(['stripe', 'paypal', 'razorpay']).withMessage('Invalid payment gateway'),
  body('description').optional().isString(),
  body('expires_in_days').optional().isInt({ min: 1, max: 365 }),
  body('redirect_url').optional().isURL(),
  body('callback_url').optional().isURL(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { 
        invoice_id, 
        gateway, 
        description, 
        expires_in_days, 
        redirect_url, 
        callback_url 
      } = req.body;

      // Get invoice details
      const invoiceRows = await sheetsService.read('Invoices', invoice_id);
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

      // Get client details for customer info
      const clientRows = await sheetsService.read('Clients', invoice.client_id);
      if (clientRows.length === 0) {
        res.status(400).json({ error: 'Client not found' });
        return;
      }
      
      const client = clientRows[0];

      // Generate payment link
      const paymentLink = await paymentService.generatePaymentLink(
        invoice_id,
        gateway as PaymentGateway,
        {
          description,
          expiresInDays: expires_in_days,
          redirectUrl: redirect_url,
          callbackUrl: callback_url,
          customerEmail: client.email,
          customerName: client.name,
          metadata: {
            invoice_number: invoice.invoice_number,
            client_id: client.id
          }
        }
      );

      res.json({
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.total_amount,
        currency: invoice.currency,
        client_name: client.name,
        payment_link: paymentLink,
        gateway,
        expires_at: expires_in_days 
          ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString() 
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default 7 days
      });
    } catch (error) {
      console.error('Error generating payment link:', error);
      res.status(500).json({ error: 'Failed to generate payment link' });
    }
  }
);

// Record payment for invoice
router.post('/record',
  authenticateToken,
  body('invoice_id').isString().notEmpty(),
  body('amount').isNumeric().custom(value => value > 0),
  body('gateway').isIn(['stripe', 'paypal', 'razorpay', 'bank_transfer', 'cash', 'other']),
  body('gateway_payment_id').optional().isString(),
  body('payment_method').isString(),
  body('transaction_fee').optional().isNumeric(),
  body('payment_date').optional().isISO8601(),
  body('metadata').optional().isObject(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { 
        invoice_id, 
        amount, 
        gateway, 
        gateway_payment_id, 
        payment_method,
        transaction_fee,
        payment_date,
        metadata 
      } = req.body;

      // Get invoice details
      const invoiceRows = await sheetsService.read('Invoices', invoice_id);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Process payment
      const payment = await paymentService.processPayment(invoice_id, {
        amount: parseFloat(amount),
        gateway: gateway as PaymentGateway,
        gateway_payment_id: gateway_payment_id || `manual_${Date.now()}`,
        payment_method,
        transaction_fee: transaction_fee ? parseFloat(transaction_fee) : undefined,
        metadata: {
          ...metadata,
          recorded_by: req.user?.id,
          payment_date: payment_date || new Date().toISOString()
        }
      });

      res.json({
        success: true,
        payment_id: payment.id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        payment_date: payment.payment_date.toISOString(),
        payment_method: payment.payment_method
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      res.status(500).json({ error: 'Failed to record payment' });
    }
  }
);

// Get payment history for invoice
router.get('/history/:invoiceId',
  authenticateToken,
  param('invoiceId').isString().notEmpty(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { invoiceId } = req.params;

      // Check if invoice exists
      const invoiceRows = await sheetsService.read('Invoices', invoiceId);
      if (invoiceRows.length === 0) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const invoice = Invoice.fromSheetRow(invoiceRows[0]);
      
      // Get payment history
      const payments = await paymentService.getPaymentHistory(invoiceId);

      res.json({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        status: invoice.status,
        payments: payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          gateway: payment.gateway,
          status: payment.status,
          payment_date: payment.payment_date.toISOString(),
          payment_method: payment.payment_method,
          transaction_fee: payment.transaction_fee
        })),
        total_paid: payments.reduce((sum, payment) => 
          payment.status === PaymentStatus.COMPLETED ? sum + payment.amount : sum, 0)
      });
    } catch (error) {
      console.error('Error getting payment history:', error);
      res.status(500).json({ error: 'Failed to get payment history' });
    }
  }
);

// Check for overdue invoices and apply late fees
router.post('/check-overdue',
  authenticateToken,
  body('apply_late_fees').optional().isBoolean(),
  body('send_reminders').optional().isBoolean(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { apply_late_fees = true, send_reminders = false } = req.body;
      
      // Check overdue invoices and apply late fees if requested
      const overdueResult = await paymentService.checkOverdueInvoicesAndApplyLateFees();
      
      // Send reminders if requested
      let reminderResult = null;
      if (send_reminders) {
        reminderResult = await paymentService.sendPaymentReminders({
          includePaymentLink: true
        });
      }
      
      res.json({
        checked_at: new Date().toISOString(),
        overdue_check: {
          total_checked: overdueResult.checked,
          overdue_found: overdueResult.overdue,
          late_fees_applied: apply_late_fees ? overdueResult.feesApplied : 0
        },
        reminders: send_reminders ? {
          total: reminderResult?.total || 0,
          sent: reminderResult?.sent || 0,
          failed: reminderResult?.failed || 0
        } : null
      });
    } catch (error) {
      console.error('Error checking overdue invoices:', error);
      res.status(500).json({ error: 'Failed to check overdue invoices' });
    }
  }
);

// Configure late fee settings
router.post('/late-fee-config',
  authenticateToken,
  body('enabled').isBoolean(),
  body('grace_period_days').isInt({ min: 0 }),
  body('fee_type').isIn(['fixed', 'percentage']),
  body('fee_amount').isNumeric().custom(value => value > 0),
  body('max_fee_amount').optional().isNumeric().custom(value => value > 0),
  body('compounding_period_days').optional().isInt({ min: 1 }),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { 
        enabled, 
        grace_period_days, 
        fee_type, 
        fee_amount, 
        max_fee_amount, 
        compounding_period_days 
      } = req.body;
      
      // Update late fee configuration
      const config: Partial<LateFeeConfig> = {
        enabled,
        gracePeriodDays: grace_period_days,
        feeType: fee_type as 'fixed' | 'percentage',
        feeAmount: parseFloat(fee_amount)
      };
      
      if (max_fee_amount !== undefined) {
        config.maxFeeAmount = parseFloat(max_fee_amount);
      }
      
      if (compounding_period_days !== undefined) {
        config.compoundingPeriodDays = compounding_period_days;
      }
      
      paymentService.setLateFeeConfig(config);
      
      res.json({
        success: true,
        config: paymentService.getLateFeeConfig()
      });
    } catch (error) {
      console.error('Error configuring late fees:', error);
      res.status(500).json({ error: 'Failed to configure late fees' });
    }
  }
);

// Get late fee configuration
router.get('/late-fee-config',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const config = paymentService.getLateFeeConfig();
      
      res.json({
        enabled: config.enabled,
        grace_period_days: config.gracePeriodDays,
        fee_type: config.feeType,
        fee_amount: config.feeAmount,
        max_fee_amount: config.maxFeeAmount,
        compounding_period_days: config.compoundingPeriodDays
      });
    } catch (error) {
      console.error('Error getting late fee configuration:', error);
      res.status(500).json({ error: 'Failed to get late fee configuration' });
    }
  }
);

// Send payment reminders for overdue invoices
router.post('/send-reminders',
  authenticateToken,
  body('days_overdue').optional().isInt({ min: 0 }),
  body('include_payment_link').optional().isBoolean(),
  handleValidationErrors,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { days_overdue = 0, include_payment_link = true } = req.body;
      
      // Send reminders
      const result = await paymentService.sendPaymentReminders({
        daysOverdue: days_overdue,
        includePaymentLink: include_payment_link
      });
      
      res.json({
        success: true,
        sent_at: new Date().toISOString(),
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        details: result.details
      });
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      res.status(500).json({ error: 'Failed to send payment reminders' });
    }
  }
);

// Webhook endpoint for payment gateway callbacks
router.post('/webhook/:gateway',
  param('gateway').isIn(['stripe', 'paypal', 'razorpay']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { gateway } = req.params;
      const payload = req.body;
      
      console.log(`Received ${gateway} webhook:`, JSON.stringify(payload));
      
      // In a real implementation, we would:
      // 1. Verify the webhook signature
      // 2. Parse the event type
      // 3. Handle different event types (payment.success, payment.failed, etc.)
      // 4. Update the invoice status accordingly
      
      // For now, we'll just acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }
);

export default router;