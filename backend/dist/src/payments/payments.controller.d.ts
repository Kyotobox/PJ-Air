import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    createIntent(body: {
        amount: number;
        currency?: string;
        orderId?: string;
        customerEmail?: string;
        description?: string;
    }): Promise<{
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
    }>;
    createSettlementLink(body: {
        orderId?: string;
        clientId?: string;
        clientEmail?: string;
    }, req: any): Promise<{
        url: string;
        clientSecret?: string;
        paymentIntentId?: string;
        amount?: number;
        totalDebt?: number;
        orderId?: string;
        orderCount?: number;
        customerEmail?: string;
    }>;
    createRefund(body: {
        orderId: string;
        amount?: number;
        reason?: string;
    }): Promise<{
        success: boolean;
        orderId: string;
        refundedAmount: number;
        totalRefunded: number;
        paymentStatus: string;
        reason: string;
    }>;
    handleWebhook(req: any, signature: string, body: any): Promise<{
        received: boolean;
        status: string;
    }>;
}
