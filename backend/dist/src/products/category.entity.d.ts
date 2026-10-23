import { Product } from './product.entity';
export declare class Category {
    id: number;
    name: string;
    name_en: string;
    min_qty: number;
    is_active: boolean;
    products: Product[];
}
