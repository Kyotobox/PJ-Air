import { Address } from '../addresses/address.entity';
import { Order } from '../orders/order.entity';
import { ProductDiscount } from './product-discount.entity';
import { Profile } from './profile.entity';
export declare class User {
    id: string;
    email: string;
    password: string;
    role: string;
    profile: Profile;
    addresses: Address[];
    orders: Order[];
    general_discount: number;
    delivery_fee: number;
    account_type: 'cash' | 'credit';
    credit_limit: number;
    credit_override: boolean;
    stripe_customer_id: string;
    productDiscounts: ProductDiscount[];
}
