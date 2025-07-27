export interface PaymentGateway {
    name: string;
    createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
    processWebhook(payload: any, signature?: string): Promise<WebhookResult>;
    getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
}
export interface CreatePaymentLinkParams {
    amount: number;
    currency: string;
    description: string;
    invoiceId: string;
    clientEmail: string;
    clientName: string;
    successUrl?: string;
    cancelUrl?: string;
    expiresAt?: Date;
    allowPartialPayments?: boolean;
    metadata?: Record<string, any>;
}
export interface PaymentLink {
    id: string;
    url: string;
    expiresAt?: Date;
    status: 'active' | 'expired' | 'completed';
}
export interface PaymentStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
    amount: number;
    currency: string;
    paidAmount?: number;
    paymentMethod?: string;
    transactionId?: string;
    paidAt?: Date;
    failureReason?: string;
    metadata?: Record<string, any>;
}
export interface WebhookResult {
    eventType: string;
    paymentId: string;
    status: PaymentStatus['status'];
    amount?: number;
    paidAmount?: number;
    metadata?: Record<string, any>;
}
export interface RefundResult {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    amount: number;
    reason?: string;
}
export interface PaymentReminder {
    id: string;
    invoiceId: string;
    type: 'before_due' | 'on_due' | 'after_due';
    daysOffset: number;
    template: string;
    method: 'email' | 'sms' | 'both';
    status: 'scheduled' | 'sent' | 'failed';
    scheduledAt: Date;
    sentAt?: Date;
}
export interface LateFeeRule {
    id: string;
    name: string;
    type: 'percentage' | 'fixed';
    amount: number;
    gracePeriodDays: number;
    maxAmount?: number;
    compoundingFrequency?: 'daily' | 'weekly' | 'monthly';
    isActive: boolean;
}
export interface PaymentAnalytics {
    gateway: string;
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: number;
    totalAmount: number;
    averagePaymentTime: number;
    averageTransactionAmount: number;
    period: {
        start: Date;
        end: Date;
    };
}
export interface FraudDetectionResult {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
    recommendation: 'approve' | 'review' | 'decline';
}
//# sourceMappingURL=payment.d.ts.map