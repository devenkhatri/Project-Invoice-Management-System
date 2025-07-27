import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult } from '../types/payment';
export declare class PayPalPaymentGateway implements PaymentGateway {
    readonly name = "paypal";
    private clientId;
    private clientSecret;
    private baseUrl;
    private accessToken;
    constructor(clientId: string, clientSecret: string, mode?: 'sandbox' | 'live');
    createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
    processWebhook(payload: any, signature?: string): Promise<WebhookResult>;
    getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
    refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
    private getAccessToken;
    private createOrder;
    private mapOrderToStatus;
}
//# sourceMappingURL=paypal.service.d.ts.map