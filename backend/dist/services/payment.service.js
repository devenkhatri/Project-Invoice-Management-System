"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
class PaymentService {
    constructor(sheetsService) {
        this.gateways = new Map();
        this.sheetsService = sheetsService;
    }
    registerGateway(gateway) {
        this.gateways.set(gateway.name, gateway);
    }
    getGateway(name) {
        return this.gateways.get(name);
    }
    getAvailableGateways() {
        return Array.from(this.gateways.keys());
    }
    async createPaymentLink(gatewayName, params) {
        const gateway = this.getGateway(gatewayName);
        if (!gateway) {
            throw new Error(`Payment gateway '${gatewayName}' not found`);
        }
        const fraudCheck = await this.performFraudDetection(params);
        if (fraudCheck.recommendation === 'decline') {
            throw new Error(`Payment declined due to fraud detection: ${fraudCheck.flags.join(', ')}`);
        }
        const paymentLink = await gateway.createPaymentLink(params);
        await this.storePaymentLink(gatewayName, paymentLink, params);
        return paymentLink;
    }
    async processWebhook(gatewayName, payload, signature) {
        const gateway = this.getGateway(gatewayName);
        if (!gateway) {
            throw new Error(`Payment gateway '${gatewayName}' not found`);
        }
        const result = await gateway.processWebhook(payload, signature);
        await this.updatePaymentStatus(result.paymentId, result.status, result.paidAmount);
        if (result.status === 'completed') {
            await this.updateInvoiceStatus(result.paymentId, 'paid');
            try {
                const { AutomationService } = await Promise.resolve().then(() => __importStar(require('./automation')));
                const automationService = AutomationService.getInstance();
                const paymentLinks = await this.sheetsService.query('Payment_Links', {
                    id: result.paymentId
                });
                if (paymentLinks.length > 0) {
                    const invoiceId = paymentLinks[0].invoice_id;
                    await automationService.onPaymentReceived(invoiceId, result.paidAmount || 0, {
                        gateway: gatewayName,
                        payment_id: result.paymentId,
                        transaction_id: result.transactionId,
                        payment_method: result.paymentMethod
                    });
                }
            }
            catch (error) {
                console.error('Failed to trigger payment automation:', error);
            }
        }
        else if (result.status === 'failed') {
            await this.updateInvoiceStatus(result.paymentId, 'overdue');
        }
        return result;
    }
    async getPaymentStatus(gatewayName, paymentId) {
        const gateway = this.getGateway(gatewayName);
        if (!gateway) {
            throw new Error(`Payment gateway '${gatewayName}' not found`);
        }
        return await gateway.getPaymentStatus(paymentId);
    }
    async refundPayment(gatewayName, paymentId, amount) {
        const gateway = this.getGateway(gatewayName);
        if (!gateway) {
            throw new Error(`Payment gateway '${gatewayName}' not found`);
        }
        const result = await gateway.refundPayment(paymentId, amount);
        if (result.status === 'completed') {
            await this.updatePaymentStatus(paymentId, amount ? 'partially_refunded' : 'refunded');
        }
        return result;
    }
    async getPaymentAnalytics(gatewayName, startDate, endDate) {
        const queryParams = {};
        if (gatewayName) {
            queryParams.gateway = gatewayName;
        }
        if (startDate || endDate) {
            queryParams.created_at = {};
            if (startDate) {
                queryParams.created_at['>='] = startDate.toISOString();
            }
            if (endDate) {
                queryParams.created_at['<='] = endDate.toISOString();
            }
        }
        const payments = await this.sheetsService.query('Payment_Links', queryParams);
        const analytics = new Map();
        for (const payment of payments) {
            const gateway = payment.gateway;
            if (!analytics.has(gateway)) {
                analytics.set(gateway, {
                    gateway,
                    totalTransactions: 0,
                    successfulTransactions: 0,
                    failedTransactions: 0,
                    successRate: 0,
                    totalAmount: 0,
                    averagePaymentTime: 0,
                    averageTransactionAmount: 0,
                    period: {
                        start: startDate || new Date(Math.min(...payments.map(p => new Date(p.created_at).getTime()))),
                        end: endDate || new Date(Math.max(...payments.map(p => new Date(p.created_at).getTime())))
                    }
                });
            }
            const stats = analytics.get(gateway);
            stats.totalTransactions++;
            stats.totalAmount += payment.amount;
            if (payment.status === 'completed') {
                stats.successfulTransactions++;
                if (payment.paid_at) {
                    const paymentTime = (new Date(payment.paid_at).getTime() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24);
                    stats.averagePaymentTime = (stats.averagePaymentTime * (stats.successfulTransactions - 1) + paymentTime) / stats.successfulTransactions;
                }
            }
            else if (payment.status === 'failed') {
                stats.failedTransactions++;
            }
        }
        for (const stats of analytics.values()) {
            stats.successRate = stats.totalTransactions > 0 ? (stats.successfulTransactions / stats.totalTransactions) * 100 : 0;
            stats.averageTransactionAmount = stats.totalTransactions > 0 ? stats.totalAmount / stats.totalTransactions : 0;
        }
        return Array.from(analytics.values());
    }
    async storePaymentLink(gateway, paymentLink, params) {
        const data = {
            id: paymentLink.id,
            gateway,
            url: paymentLink.url,
            amount: params.amount,
            currency: params.currency,
            description: params.description,
            invoice_id: params.invoiceId,
            client_email: params.clientEmail,
            client_name: params.clientName,
            status: paymentLink.status,
            expires_at: paymentLink.expiresAt?.toISOString(),
            allow_partial_payments: params.allowPartialPayments || false,
            metadata: JSON.stringify(params.metadata || {}),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await this.sheetsService.create('Payment_Links', data);
    }
    async updatePaymentStatus(paymentId, status, paidAmount) {
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        if (paidAmount !== undefined) {
            updateData.paid_amount = paidAmount;
        }
        if (status === 'completed') {
            updateData.paid_at = new Date().toISOString();
        }
        await this.sheetsService.update('Payment_Links', paymentId, updateData);
    }
    async updateInvoiceStatus(paymentId, status) {
        const paymentLinks = await this.sheetsService.query('Payment_Links', { id: paymentId });
        if (paymentLinks.length === 0) {
            return;
        }
        const invoiceId = paymentLinks[0].invoice_id;
        await this.sheetsService.update('Invoices', invoiceId, {
            status,
            updated_at: new Date().toISOString()
        });
    }
    async performFraudDetection(params) {
        let riskScore = 0;
        const flags = [];
        if (params.amount > 100000) {
            riskScore += 20;
            flags.push('high_amount');
        }
        if (params.clientEmail.includes('temp') || params.clientEmail.includes('disposable')) {
            riskScore += 30;
            flags.push('suspicious_email');
        }
        const recentPayments = await this.sheetsService.query('Payment_Links', {
            client_email: params.clientEmail,
            created_at: { '>=': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
        });
        if (recentPayments.length > 5) {
            riskScore += 25;
            flags.push('rapid_payments');
        }
        let riskLevel;
        let recommendation;
        if (riskScore < 30) {
            riskLevel = 'low';
            recommendation = 'approve';
        }
        else if (riskScore < 60) {
            riskLevel = 'medium';
            recommendation = 'review';
        }
        else {
            riskLevel = 'high';
            recommendation = 'decline';
        }
        if (flags.length > 0) {
            recommendation = 'decline';
        }
        return {
            riskScore,
            riskLevel,
            flags,
            recommendation
        };
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=payment.service.js.map