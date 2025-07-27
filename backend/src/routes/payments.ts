import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PaymentService } from '../services/payment.service';
import { PaymentReminderService } from '../services/payment-reminder.service';
import { StripePaymentGateway } from '../services/stripe.service';
import { PayPalPaymentGateway } from '../services/paypal.service';
import { RazorpayPaymentGateway } from '../services/razorpay.service';
import { SheetsService } from '../services/sheets.service';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

// Initialize services
const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
const sheetsService = new SheetsService(spreadsheetId, serviceAccountKey);
const paymentService = new PaymentService(sheetsService);
const reminderService = new PaymentReminderService(sheetsService);

// Register payment gateways
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
  const stripeGateway = new StripePaymentGateway(
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  paymentService.registerGateway(stripeGateway);
}

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  const paypalGateway = new PayPalPaymentGateway(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET,
    process.env.PAYPAL_MODE as 'sandbox' | 'live'
  );
  paymentService.registerGateway(paypalGateway);
}

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  const razorpayGateway = new RazorpayPaymentGateway(
    process.env.RAZORPAY_KEY_ID,
    process.env.RAZORPAY_KEY_SECRET
  );
  paymentService.registerGateway(razorpayGateway);
}

// Get available payment gateways
router.get('/gateways', authenticateToken, (req: Request, res: Response) => {
  try {
    const gateways = paymentService.getAvailableGateways();
    res.json({ gateways });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get payment gateways',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create payment link
router.post('/links',
  authenticateToken,
  [
    body('gateway').isString().notEmpty().withMessage('Gateway is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
    body('clientEmail').isEmail().withMessage('Valid client email is required'),
    body('clientName').isString().notEmpty().withMessage('Client name is required'),
    body('successUrl').optional().isURL().withMessage('Success URL must be valid'),
    body('cancelUrl').optional().isURL().withMessage('Cancel URL must be valid'),
    body('expiresAt').optional().isISO8601().withMessage('Expires at must be valid date'),
    body('allowPartialPayments').optional().isBoolean(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const {
        gateway,
        amount,
        currency,
        description,
        invoiceId,
        clientEmail,
        clientName,
        successUrl,
        cancelUrl,
        expiresAt,
        allowPartialPayments,
        metadata
      } = req.body;

      const paymentLink = await paymentService.createPaymentLink(gateway, {
        amount,
        currency,
        description,
        invoiceId,
        clientEmail,
        clientName,
        successUrl,
        cancelUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        allowPartialPayments,
        metadata
      });

      res.status(201).json(paymentLink);
    } catch (error) {
      res.status(400).json({
        error: 'Failed to create payment link',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get payment status
router.get('/status/:gateway/:paymentId',
  authenticateToken,
  [
    param('gateway').isString().notEmpty().withMessage('Gateway is required'),
    param('paymentId').isString().notEmpty().withMessage('Payment ID is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { gateway, paymentId } = req.params;
      const status = await paymentService.getPaymentStatus(gateway, paymentId);
      res.json(status);
    } catch (error) {
      res.status(400).json({
        error: 'Failed to get payment status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Process refund
router.post('/refund',
  authenticateToken,
  [
    body('gateway').isString().notEmpty().withMessage('Gateway is required'),
    body('paymentId').isString().notEmpty().withMessage('Payment ID is required'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { gateway, paymentId, amount } = req.body;
      const refund = await paymentService.refundPayment(gateway, paymentId, amount);
      res.json(refund);
    } catch (error) {
      res.status(400).json({
        error: 'Failed to process refund',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Webhook endpoints for each gateway
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const result = await paymentService.processWebhook('stripe', req.body, signature);
    res.json({ received: true, result });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/webhooks/paypal', express.json(), async (req, res) => {
  try {
    const result = await paymentService.processWebhook('paypal', req.body);
    res.json({ received: true, result });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/webhooks/razorpay', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const result = await paymentService.processWebhook('razorpay', req.body, signature);
    res.json({ received: true, result });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(400).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Payment analytics
router.get('/analytics',
  authenticateToken,
  [
    query('gateway').optional().isString(),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { gateway, startDate, endDate } = req.query;
      const analytics = await paymentService.getPaymentAnalytics(
        gateway as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(analytics);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get payment analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Payment reminder routes
router.post('/reminders',
  authenticateToken,
  [
    body('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
    body('type').isIn(['before_due', 'on_due', 'after_due']).withMessage('Invalid reminder type'),
    body('daysOffset').isInt({ min: 0 }).withMessage('Days offset must be non-negative integer'),
    body('template').isString().notEmpty().withMessage('Template is required'),
    body('method').isIn(['email', 'sms', 'both']).withMessage('Invalid reminder method')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, type, daysOffset, template, method } = req.body;
      const reminderId = await reminderService.createReminderRule(
        invoiceId,
        type,
        daysOffset,
        template,
        method
      );
      res.status(201).json({ id: reminderId });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to create reminder',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Late fee rules
router.post('/late-fee-rules',
  authenticateToken,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
    body('gracePeriodDays').isInt({ min: 0 }).withMessage('Grace period must be non-negative integer'),
    body('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be non-negative'),
    body('compoundingFrequency').optional().isIn(['daily', 'weekly', 'monthly']),
    body('isActive').isBoolean().withMessage('Is active must be boolean')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        type,
        amount,
        gracePeriodDays,
        maxAmount,
        compoundingFrequency,
        isActive
      } = req.body;

      const ruleId = await reminderService.createLateFeeRule({
        name,
        type,
        amount,
        gracePeriodDays,
        maxAmount,
        compoundingFrequency,
        isActive
      });

      res.status(201).json({ id: ruleId });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to create late fee rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Manual reminder processing (for testing)
router.post('/reminders/process',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      await reminderService.processScheduledReminders();
      res.json({ message: 'Reminders processed successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process reminders',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Manual late fee processing (for testing)
router.post('/late-fees/process',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      await reminderService.processLateFees();
      res.json({ message: 'Late fees processed successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process late fees',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;