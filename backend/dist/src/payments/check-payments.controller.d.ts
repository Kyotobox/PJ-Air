import { CheckPaymentsService, RegisterCheckDto } from './check-payments.service';
export declare class CheckPaymentsController {
    private readonly checkPaymentsService;
    constructor(checkPaymentsService: CheckPaymentsService);
    register(dto: RegisterCheckDto): Promise<import("./check-payment.entity").CheckPayment>;
    markAsDeposited(id: string, body: {
        notes?: string;
    }): Promise<import("./check-payment.entity").CheckPayment>;
    markAsBounced(id: string, body: {
        reason?: string;
    }): Promise<import("./check-payment.entity").CheckPayment>;
    getReconciliation(): Promise<{
        inHand: import("./check-payment.entity").CheckPayment[];
        deposited: import("./check-payment.entity").CheckPayment[];
        bounced: import("./check-payment.entity").CheckPayment[];
    }>;
    getByOrder(orderId: string): Promise<import("./check-payment.entity").CheckPayment[]>;
    getById(id: string): Promise<import("./check-payment.entity").CheckPayment>;
    getAll(status?: string, orderId?: string, userId?: string): Promise<import("./check-payment.entity").CheckPayment[]>;
}
