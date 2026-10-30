import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
export declare class CreditService {
    private readonly userRepository;
    private readonly orderRepository;
    constructor(userRepository: Repository<User>, orderRepository: Repository<Order>);
    getClientCreditSummary(clientId: string): Promise<{
        credit_limit: number;
        used_credit: number;
        available_credit: number;
        credit_blocked: boolean;
        credit_override: boolean;
    }>;
    getCreditLimit(clientId: string): Promise<number>;
    getUsedCredit(clientId: string): Promise<number>;
    getAvailableCredit(clientId: string): Promise<number>;
    calculatePaymentDueDate(createdAt?: Date | string): string;
    validateCreditOrder(clientId: string, orderAmount: number): Promise<void>;
}
