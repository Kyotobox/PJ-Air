export declare class MailService {
    private readonly logger;
    private transporter;
    constructor();
    private initTransporter;
    sendOrderReceipt(order: any, customerEmail: string): Promise<boolean>;
    sendAdminNewOrderAlert(order: any, customerEmail?: string, clientName?: string): Promise<boolean>;
    sendRefundReceipt(order: any, customerEmail: string, refundData: {
        refundedAmount: number;
        totalRefunded: number;
        reason?: string;
    }): Promise<boolean>;
    sendStandingOrderConfirmation(scheduledOrder: any, customerEmail: string, clientName?: string): Promise<boolean>;
    sendCreditAlert(userEmail: string, clientName: string, usedCredit: number, creditLimit: number, isOverdraft: boolean): Promise<boolean>;
    sendPaymentFailedAlert(userEmail: string, clientName: string, orderId: string, amount: number, reason: string): Promise<boolean>;
}
