import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
export declare class PaymentsService {
    private readonly ordersService;
    private readonly usersService;
    private readonly mailService?;
    private stripe;
    private readonly logger;
    constructor(ordersService: OrdersService, usersService: UsersService, mailService?: MailService | undefined);
    getOrCreateCustomer(userId: string): Promise<{
        id: string;
        email: string;
    }>;
    createSetupIntent(userId: string): Promise<{
        clientSecret: string;
        customerId: string;
    }>;
    getPaymentMethods(userId: string): Promise<any[]>;
    deletePaymentMethod(userId: string, paymentMethodId: string): Promise<{
        success: boolean;
        id: string;
    }>;
    createCustomerPortalSession(userId: string): Promise<{
        url: string;
    }>;
    createPaymentIntent(data: {
        amount: number;
        currency?: string;
        orderId?: string;
        customerEmail?: string;
        description?: string;
        customerId?: string;
        paymentMethodId?: string;
        saveCard?: boolean;
        paymentMethodType?: string;
    }): Promise<{
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
        status?: string;
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
