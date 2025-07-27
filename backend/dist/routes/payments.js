"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const payment_service_1 = require("../services/payment.service");
const payment_reminder_service_1 = require("../services/payment-reminder.service");
const stripe_service_1 = require("../services/stripe.service");
const paypal_service_1 = require("../services/paypal.service");
const razorpay_service_1 = require("../services/razorpay.service");
const sheets_service_1 = require("../services/sheets.service");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
const sheetsService = new sheets_service_1.SheetsService(spreadsheetId, serviceAccountKey);
const paymentService = new payment_service_1.PaymentService(sheetsService);
const reminderService = new payment_reminder_service_1.PaymentReminderService(sheetsService);
if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
    const stripeGateway = new stripe_service_1.StripePaymentGateway(process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET);
    paymentService.registerGateway(stripeGateway);
}
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
    const paypalGateway = new paypal_service_1.PayPalPaymentGateway(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET, process.env.PAYPAL_MODE);
    paymentService.registerGateway(paypalGateway);
}
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const razorpayGateway = new razorpay_service_1.RazorpayPaymentGateway(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET);
    paymentService.registerGateway(razorpayGateway);
}
router.get('/gateways', auth_1.authenticateToken, (req, res) => {
    try {
        const gateways = paymentService.getAvailableGateways();
        res.json({ gateways });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to get payment gateways',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/links', auth_1.authenticateToken, [
    (0, express_validator_1.body)('gateway').isString().notEmpty().withMessage('Gateway is required'),
    (0, express_validator_1.body)('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    (0, express_validator_1.body)('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    (0, express_validator_1.body)('description').isString().notEmpty().withMessage('Description is required'),
    (0, express_validator_1.body)('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
    (0, express_validator_1.body)('clientEmail').isEmail().withMessage('Valid client email is required'),
    (0, express_validator_1.body)('clientName').isString().notEmpty().withMessage('Client name is required'),
    (0, express_validator_1.body)('successUrl').optional().isURL().withMessage('Success URL must be valid'),
    (0, express_validator_1.body)('cancelUrl').optional().isURL().withMessage('Cancel URL must be valid'),
    (0, express_validator_1.body)('expiresAt').optional().isISO8601().withMessage('Expires at must be valid date'),
    (0, express_validator_1.body)('allowPartialPayments').optional().isBoolean(),
    (0, express_validator_1.body)('metadata').optional().isObject()
], validation_1.validateRequest, async (req, res) => {
    try {
        const { gateway, amount, currency, description, invoiceId, clientEmail, clientName, successUrl, cancelUrl, expiresAt, allowPartialPayments, metadata } = req.body;
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
    }
    catch (error) {
        res.status(400).json({
            error: 'Failed to create payment link',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/status/:gateway/:paymentId', auth_1.authenticateToken, [
    (0, express_validator_1.param)('gateway').isString().notEmpty().withMessage('Gateway is required'),
    (0, express_validator_1.param)('paymentId').isString().notEmpty().withMessage('Payment ID is required')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { gateway, paymentId } = req.params;
        const status = await paymentService.getPaymentStatus(gateway, paymentId);
        res.json(status);
    }
    catch (error) {
        res.status(400).json({
            error: 'Failed to get payment status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/refund', auth_1.authenticateToken, [
    (0, express_validator_1.body)('gateway').isString().notEmpty().withMessage('Gateway is required'),
    (0, express_validator_1.body)('paymentId').isString().notEmpty().withMessage('Payment ID is required'),
    (0, express_validator_1.body)('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { gateway, paymentId, amount } = req.body;
        const refund = await paymentService.refundPayment(gateway, paymentId, amount);
        res.json(refund);
    }
    catch (error) {
        res.status(400).json({
            error: 'Failed to process refund',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        const result = await paymentService.processWebhook('stripe', req.body, signature);
        res.json({ received: true, result });
    }
    catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({
            error: 'Webhook processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/webhooks/paypal', express_1.default.json(), async (req, res) => {
    try {
        const result = await paymentService.processWebhook('paypal', req.body);
        res.json({ received: true, result });
    }
    catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(400).json({
            error: 'Webhook processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/webhooks/razorpay', express_1.default.json(), async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const result = await paymentService.processWebhook('razorpay', req.body, signature);
        res.json({ received: true, result });
    }
    catch (error) {
        console.error('Razorpay webhook error:', error);
        res.status(400).json({
            error: 'Webhook processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/analytics', auth_1.authenticateToken, [
    (0, express_validator_1.query)('gateway').optional().isString(),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Start date must be valid'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('End date must be valid')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { gateway, startDate, endDate } = req.query;
        const analytics = await paymentService.getPaymentAnalytics(gateway, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json(analytics);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to get payment analytics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/reminders', auth_1.authenticateToken, [
    (0, express_validator_1.body)('invoiceId').isString().notEmpty().withMessage('Invoice ID is required'),
    (0, express_validator_1.body)('type').isIn(['before_due', 'on_due', 'after_due']).withMessage('Invalid reminder type'),
    (0, express_validator_1.body)('daysOffset').isInt({ min: 0 }).withMessage('Days offset must be non-negative integer'),
    (0, express_validator_1.body)('template').isString().notEmpty().withMessage('Template is required'),
    (0, express_validator_1.body)('method').isIn(['email', 'sms', 'both']).withMessage('Invalid reminder method')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { invoiceId, type, daysOffset, template, method } = req.body;
        const reminderId = await reminderService.createReminderRule(invoiceId, type, daysOffset, template, method);
        res.status(201).json({ id: reminderId });
    }
    catch (error) {
        res.status(400).json({
            error: 'Failed to create reminder',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/late-fee-rules', auth_1.authenticateToken, [
    (0, express_validator_1.body)('name').isString().notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
    (0, express_validator_1.body)('amount').isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
    (0, express_validator_1.body)('gracePeriodDays').isInt({ min: 0 }).withMessage('Grace period must be non-negative integer'),
    (0, express_validator_1.body)('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be non-negative'),
    (0, express_validator_1.body)('compoundingFrequency').optional().isIn(['daily', 'weekly', 'monthly']),
    (0, express_validator_1.body)('isActive').isBoolean().withMessage('Is active must be boolean')
], validation_1.validateRequest, async (req, res) => {
    try {
        const { name, type, amount, gracePeriodDays, maxAmount, compoundingFrequency, isActive } = req.body;
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
    }
    catch (error) {
        res.status(400).json({
            error: 'Failed to create late fee rule',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/reminders/process', auth_1.authenticateToken, async (req, res) => {
    try {
        await reminderService.processScheduledReminders();
        res.json({ message: 'Reminders processed successfully' });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to process reminders',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/late-fees/process', auth_1.authenticateToken, async (req, res) => {
    try {
        await reminderService.processLateFees();
        res.json({ message: 'Late fees processed successfully' });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to process late fees',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=payments.js.map