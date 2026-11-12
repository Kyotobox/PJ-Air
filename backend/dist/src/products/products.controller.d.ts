import { ProductsService } from './products.service';
import { StripeProductSyncService, StripeSyncResult } from './stripe-product-sync.service';
export declare class ProductsController {
    private readonly productsService;
    private readonly stripeProductSyncService;
    constructor(productsService: ProductsService, stripeProductSyncService: StripeProductSyncService);
    findAll(): Promise<import("./product.entity").Product[]>;
    findByCategory(category: string): Promise<import("./product.entity").Product[]>;
    findOne(id: string): Promise<import("./product.entity").Product | null>;
    create(body: any): Promise<import("./product.entity").Product[]>;
    updateCategory(body: {
        oldName: string;
        newName: string;
        newNameEn: string;
        minQty?: number;
    }): Promise<{
        updated: number;
    }>;
    update(id: string, body: any): Promise<import("./product.entity").Product>;
    delete(id: string): Promise<import("./product.entity").Product | null>;
    uploadImage(file: Express.Multer.File): Promise<{
        url: string;
    }>;
    uploadProducts(files: Express.Multer.File[], body: any): Promise<{
        message: string;
    }>;
    syncStripeCatalog(): Promise<StripeSyncResult>;
}
