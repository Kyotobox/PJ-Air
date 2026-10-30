import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
export type CheckPaymentStatus = 'PENDING_RECEIPT' | 'IN_HAND' | 'DEPOSITED' | 'BOUNCED';
export declare class CheckPayment {
    id: string;
    order_id: string;
    user_id: string;
    check_number: string;
    bank_name: string;
    amount: number;
    received_date: string;
    clearance_deadline: string;
    status: CheckPaymentStatus;
    notes: string;
    created_at: Date;
    order?: Order;
    user?: User;
}
