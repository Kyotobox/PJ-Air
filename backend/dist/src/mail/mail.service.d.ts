export declare class MailService {
    private readonly logger;
    private transporter;
    constructor();
    private initTransporter;
    sendOrderReceipt(order: any, customerEmail: string): Promise<boolean>;
    sendCreditAlert(userEmail: string, clientName: string, usedCredit: number, creditLimit: number, isOverdraft: boolean): Promise<boolean>;
    sendPaymentFailedAlert(userEmail: string, clientName: string, orderId: string, amount: number, reason: string): Promise<boolean>;
}
