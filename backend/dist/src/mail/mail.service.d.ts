export declare class MailService {
    private readonly logger;
    private transporter;
    constructor();
    private initTransporter;
    sendOrderReceipt(order: any, customerEmail: string): Promise<boolean>;
    sendEnglishInvoice(order: any, customerEmail: string): Promise<boolean>;
    sendAdminNewOrderAlert(order: any, customerEmail?: string, clientName?: string): Promise<boolean>;
    sendRefundReceipt(order: any, customerEmail: string, refundData: {
        refundedAmount: number;
        totalRefunded: number;
        reason?: string;
    }): Promise<boolean>;
    sendStandingOrderConfirmation(scheduledOrder: any, customerEmail: string, clientName?: string): Promise<boolean>;
    sendCreditAlert(userEmail: string, clientName: string, usedCredit: number, creditLimit: number, isOverdraft: boolean): Promise<boolean>;
    sendPaymentFailedAlert(userEmail: string, clientName: string, orderId: string, amount: number, reason: string): Promise<boolean>;
    sendOverdueInvoiceAlert(clientEmail: string, orderData: any): Promise<boolean>;
    sendFeedbackAlert(feedback: {
        id: string;
        userId?: string;
        userName?: string;
        userEmail?: string;
        category: string;
        message: string;
        createdAt?: Date | string;
    }): Promise<boolean>;
    sendZelleRejectionAlert(order: any, customerEmail: string, reason: string): Promise<boolean>;
    sendFinancialReport(recipientEmails: string[], reportDate: string, excelBuffer: Buffer, isFallback?: boolean, fallbackReason?: string): Promise<boolean>;
    sendPasswordResetEmail(userEmail: string, resetToken: string, clientName?: string | null): Promise<boolean>;
}
