"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalPaymentGateway = void 0;
class PayPalPaymentGateway {
    constructor(clientId, clientSecret, mode = 'sandbox') {
        this.name = 'paypal';
        this.accessToken = null;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.baseUrl = mode === 'sandbox'
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
    }
    async createPaymentLink(params) {
        try {
            const accessToken = await this.getAccessToken();
            const order = await this.createOrder({
                amount: params.amount,
                currency: params.currency,
                description: params.description,
                invoiceId: params.invoiceId,
                clientEmail: params.clientEmail,
                clientName: params.clientName,
                successUrl: params.successUrl,
                cancelUrl: params.cancelUrl,
                metadata: params.metadata
            });
            const approveLink = order.links.find(link => link.rel === 'approve');
            if (!approveLink) {
                throw new Error('No approval link found in PayPal order response');
            }
            return {
                id: order.id,
                url: approveLink.href,
                expiresAt: params.expiresAt,
                status: 'active'
            };
        }
        catch (error) {
            throw new Error(`PayPal payment link creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processWebhook(payload, signature) {
        const event = payload;
        switch (event.event_type) {
            case 'CHECKOUT.ORDER.APPROVED': {
                const resource = event.resource;
                return {
                    eventType: 'payment_approved',
                    paymentId: resource.id,
                    status: 'processing',
                    amount: parseFloat(resource.purchase_units[0].amount.value),
                    metadata: resource.custom_id ? { custom_id: resource.custom_id } : {}
                };
            }
            case 'PAYMENT.CAPTURE.COMPLETED': {
                const resource = event.resource;
                return {
                    eventType: 'payment_completed',
                    paymentId: resource.supplementary_data?.related_ids?.order_id || resource.id,
                    status: 'completed',
                    amount: parseFloat(resource.amount.value),
                    paidAmount: parseFloat(resource.amount.value),
                    metadata: {}
                };
            }
            case 'PAYMENT.CAPTURE.DENIED': {
                const resource = event.resource;
                return {
                    eventType: 'payment_failed',
                    paymentId: resource.supplementary_data?.related_ids?.order_id || resource.id,
                    status: 'failed',
                    amount: parseFloat(resource.amount.value),
                    metadata: {}
                };
            }
            case 'PAYMENT.CAPTURE.REFUNDED': {
                const resource = event.resource;
                return {
                    eventType: 'payment_refunded',
                    paymentId: resource.supplementary_data?.related_ids?.order_id || resource.id,
                    status: 'refunded',
                    amount: parseFloat(resource.amount.value),
                    metadata: {}
                };
            }
            default:
                throw new Error(`Unhandled PayPal webhook event type: ${event.event_type}`);
        }
    }
    async getPaymentStatus(paymentId) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`PayPal API error: ${response.status} ${response.statusText}`);
            }
            const order = await response.json();
            return this.mapOrderToStatus(order);
        }
        catch (error) {
            throw new Error(`Failed to get PayPal payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async refundPayment(paymentId, amount) {
        try {
            const accessToken = await this.getAccessToken();
            const orderResponse = await fetch(`${this.baseUrl}/v2/checkout/orders/${paymentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!orderResponse.ok) {
                throw new Error(`Failed to get order details: ${orderResponse.status}`);
            }
            const order = await orderResponse.json();
            const captureId = order.purchase_units[0]?.payments?.captures?.[0]?.id;
            if (!captureId) {
                throw new Error('No capture found for this order');
            }
            const refundData = {
                note_to_payer: 'Refund processed'
            };
            if (amount) {
                refundData.amount = {
                    value: amount.toFixed(2),
                    currency_code: order.purchase_units[0].amount.currency_code
                };
            }
            const refundResponse = await fetch(`${this.baseUrl}/v2/payments/captures/${captureId}/refund`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(refundData)
            });
            if (!refundResponse.ok) {
                throw new Error(`Refund failed: ${refundResponse.status}`);
            }
            const refund = await refundResponse.json();
            return {
                id: refund.id,
                status: refund.status === 'COMPLETED' ? 'completed' : 'pending',
                amount: parseFloat(refund.amount.value),
                reason: refund.note_to_payer
            };
        }
        catch (error) {
            throw new Error(`PayPal refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getAccessToken() {
        if (this.accessToken && this.accessToken.expires_at > Date.now()) {
            return this.accessToken;
        }
        const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        if (!response.ok) {
            throw new Error(`Failed to get PayPal access token: ${response.status}`);
        }
        const tokenData = await response.json();
        this.accessToken = {
            access_token: tokenData.access_token,
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            expires_at: Date.now() + (tokenData.expires_in * 1000) - 60000
        };
        return this.accessToken;
    }
    async createOrder(params) {
        const accessToken = await this.getAccessToken();
        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [{
                    amount: {
                        currency_code: params.currency.toUpperCase(),
                        value: params.amount.toFixed(2)
                    },
                    description: params.description,
                    custom_id: params.invoiceId,
                    invoice_id: params.invoiceId
                }],
            application_context: {
                brand_name: 'Your Business Name',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                return_url: params.successUrl || `${process.env.FRONTEND_URL}/payment/success`,
                cancel_url: params.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`
            }
        };
        const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`PayPal order creation failed: ${response.status} ${error}`);
        }
        return await response.json();
    }
    mapOrderToStatus(order) {
        let status;
        switch (order.status) {
            case 'COMPLETED':
                status = 'completed';
                break;
            case 'APPROVED':
                status = 'processing';
                break;
            case 'CREATED':
            case 'SAVED':
                status = 'pending';
                break;
            case 'VOIDED':
            case 'PAYER_ACTION_REQUIRED':
                status = 'cancelled';
                break;
            default:
                status = 'failed';
        }
        const amount = parseFloat(order.purchase_units[0]?.amount?.value || '0');
        return {
            id: order.id,
            status,
            amount,
            currency: order.purchase_units[0]?.amount?.currency_code?.toLowerCase() || 'usd',
            paidAmount: status === 'completed' ? amount : 0,
            paymentMethod: 'paypal',
            transactionId: order.id,
            paidAt: status === 'completed' ? new Date() : undefined,
            metadata: {}
        };
    }
}
exports.PayPalPaymentGateway = PayPalPaymentGateway;
//# sourceMappingURL=paypal.service.js.map