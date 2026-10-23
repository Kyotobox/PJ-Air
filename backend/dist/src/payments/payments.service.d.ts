import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
export declare class PaymentsService {
    private readonly ordersService;
    private readonly usersService;
    private stripe;
    private readonly logger;
    constructor(ordersService: OrdersService, usersService: UsersService);
    createPaymentIntent(data: {
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
    createSettlementLink(data: {
        orderId?: string;
        clientId?: string;
        clientEmail?: string;
    }): Promise<{
        url: string;
        clientSecret?: string;
        paymentIntentId?: string;
        amount?: number;
        totalDebt?: number;
        orderId?: string;
        orderCount?: number;
        customerEmail?: string;
    }>;
    createRefund(data: {
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
    handleWebhook(rawBody: any, signature?: string): Promise<{
        received: boolean;
        status: string;
    }>;
}
