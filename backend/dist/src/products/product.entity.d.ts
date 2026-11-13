import { Category } from './category.entity';
export declare class Product {
    id: number;
    name: string;
    category: Category | null;
    price: number;
    description: string;
    image: string;
    is_deleted: boolean;
    stripe_product_id: string;
    stripe_price_id: string;
    production_group: string | null;
}
