import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { StripeService } from '../payments/stripe.service';
export interface StripeSyncResult {
    synced: number;
    skipped: number;
    errors: number;
    details: Array<{
        productId: number;
        action: string;
        error?: string;
    }>;
}
export declare class StripeProductSyncService {
    private readonly productRepo;
    private readonly stripeService;
    private readonly logger;
    constructor(productRepo: Repository<Product>, stripeService: StripeService);
    syncAll(): Promise<StripeSyncResult>;
    syncOne(product: Product, stripeClient?: any): Promise<string>;
}
