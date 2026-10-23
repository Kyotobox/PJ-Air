import { User } from '../users/user.entity';
import { Address } from '../addresses/address.entity';
import { OrderItem } from './order-item.entity';
export declare class Order {
    id: string;
    user_id: string;
    total: number;
    status: string;
    payment_status: string;
    delivery_fee_charged: number;
    stripe_payment_id: string;
    refunded_amount: number;
    refund_reason: string;
    address_id: string;
    delivery_date: string;
    payment_due_date: string;
    delivery_user_id: string;
    notes: string;
    delivery_type: string;
    delivery_address_text: string;
    created_at: Date;
    delivery_user: User;
    user: User;
    address: Address;
    items: OrderItem[];
}
