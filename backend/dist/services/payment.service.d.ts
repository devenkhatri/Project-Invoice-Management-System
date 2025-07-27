import { PaymentGateway, CreatePaymentLinkParams, PaymentLink, PaymentStatus, WebhookResult, RefundResult, PaymentAnalytics } from '../types/payment';
import { SheetsService } from './sheets.service';
export declare class PaymentService {
    private gateways;
    private sheetsService;
    constructor(sheetsService: SheetsService);
    registerGateway(gateway: PaymentGateway): void;
    getGateway(name: string): PaymentGateway | undefined;
    getAvailableGateways(): string[];
    createPaymentLink(gatewayName: string, params: CreatePaymentLinkParams): Promise<PaymentLink>;
    processWebhook(gatewayName: string, payload: any, signature?: string): Promise<WebhookResult>;
    getPaymentStatus(gatewayName: string, paymentId: string): Promise<PaymentStatus>;
    refundPayment(gatewayName: string, paymentId: string, amount?: number): Promise<RefundResult>;
    getPaymentAnalytics(gatewayName?: string, startDate?: Date, endDate?: Date): Promise<PaymentAnalytics[]>;
    private storePaymentLink;
    private updatePaymentStatus;
    private updateInvoiceStatus;
    private performFraudDetection;
}
//# sourceMappingURL=payment.service.d.ts.map