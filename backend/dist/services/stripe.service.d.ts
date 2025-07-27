import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../types/payment';
export declare class StripePaymentGateway implements PaymentGateway {
    readonly name = "stripe";
    private stripe;
    private webhookSecret;
    constructor(secretKey: string, webhookSecret: string);
    createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
    processWebhook(payload: any, signature?: string): Promise<WebhookResult>;
    getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
    private mapSessionToStatus;
    private mapPaymentIntentToStatus;
}
//# sourceMappingURL=stripe.service.d.ts.map