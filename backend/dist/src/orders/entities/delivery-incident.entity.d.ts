import { Order } from '../order.entity';
import { User } from '../../users/user.entity';
export declare class DeliveryIncident {
    id: string;
    order_id: string;
    user_id: string;
    product_id: number;
    quantity: number;
    reason_category: string;
    description: string | null;
    photo_url: string | null;
    amount: number;
    voucher_code: string;
    status: string;
    reviewed_by: string | null;
    created_at: Date;
    updated_at: Date;
    order: Order;
    user: User;
}
