import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../types/payment';
export declare class RazorpayPaymentGateway implements PaymentGateway {
    readonly name = "razorpay";
    private razorpay;
    private webhookSecret;
    constructor(keyId: string, keySecret: string, webhookSecret?: string);
    createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
    processWebhook(payload: any, signature?: string): Promise<WebhookResult>;
    getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
    private mapPaymentLinkToStatus;
    private mapPaymentToStatus;
}
//# sourceMappingURL=razorpay.service.d.ts.map