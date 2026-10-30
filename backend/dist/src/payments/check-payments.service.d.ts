import { Repository } from 'typeorm';
import { CheckPayment, CheckPaymentStatus } from './check-payment.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
export declare class RegisterCheckDto {
    order_id: string;
    check_number: string;
    bank_name: string;
    amount: number;
    received_date: string;
    notes?: string;
    user_id?: string;
    status?: CheckPaymentStatus;
}
export declare class CheckPaymentsService {
    private readonly checkPaymentRepository;
    private readonly orderRepository;
    private readonly userRepository;
    constructor(checkPaymentRepository: Repository<CheckPayment>, orderRepository: Repository<Order>, userRepository: Repository<User>);
    registerCheck(dto: RegisterCheckDto): Promise<CheckPayment>;
    markAsDeposited(checkPaymentId: string, notes?: string): Promise<CheckPayment>;
    markAsBounced(checkPaymentId: string, bounceReason?: string): Promise<CheckPayment>;
    findAll(filter?: {
        status?: CheckPaymentStatus;
        orderId?: string;
        userId?: string;
    }): Promise<CheckPayment[]>;
    findById(id: string): Promise<CheckPayment>;
    findByOrder(orderId: string): Promise<CheckPayment[]>;
    getReconciliationGrouped(): Promise<{
        inHand: CheckPayment[];
        deposited: CheckPayment[];
        bounced: CheckPayment[];
    }>;
}
