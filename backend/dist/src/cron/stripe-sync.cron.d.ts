import { StripeProductSyncService } from '../products/stripe-product-sync.service';
export declare class StripeSyncCron {
    private readonly stripeProductSyncService;
    private readonly logger;
    constructor(stripeProductSyncService: StripeProductSyncService);
    handleDailyStripeCatalogSync(): Promise<void>;
}
