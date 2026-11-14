"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var StripeProductSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeProductSyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./product.entity");
const stripe_service_1 = require("../payments/stripe.service");
let StripeProductSyncService = StripeProductSyncService_1 = class StripeProductSyncService {
    productRepo;
    stripeService;
    logger = new common_1.Logger(StripeProductSyncService_1.name);
    constructor(productRepo, stripeService) {
        this.productRepo = productRepo;
        this.stripeService = stripeService;
    }
    async syncAll() {
        const stripe = this.stripeService.getStripeClient();
        if (!stripe) {
            this.logger.error('Stripe client not initialized. Skipping sync.');
            return { synced: 0, skipped: 0, errors: 0, details: [] };
        }
        const products = await this.productRepo.find({ where: { is_deleted: false } });
        const result = { synced: 0, skipped: 0, errors: 0, details: [] };
        for (const product of products) {
            try {
                const action = await this.syncOne(product, stripe);
                result.synced++;
                result.details.push({ productId: product.id, action });
            }
            catch (err) {
                result.errors++;
                result.details.push({ productId: product.id, action: 'error', error: err.message });
                this.logger.error(`Stripe sync failed for product ${product.id} (${product.name}): ${err.message}`);
            }
        }
        this.logger.log(`[Stripe Catalog Sync] Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
        return result;
    }
    async syncOne(product, stripeClient) {
        const stripe = stripeClient || this.stripeService.getStripeClient();
        if (!stripe)
            throw new Error('Stripe client not initialized');
        const priceInCents = Math.round(Number(product.price) * 100);
        let stripeProductId = product.stripe_product_id;
        if (!stripeProductId) {
            const stripeProduct = await stripe.products.create({
                name: product.name,
                description: product.description || undefined,
                metadata: { local_product_id: String(product.id) },
            });
            stripeProductId = stripeProduct.id;
        }
        else {
            await stripe.products.update(stripeProductId, {
                name: product.name,
                description: product.description || undefined,
            });
        }
        let stripePriceId = product.stripe_price_id;
        let action = 'updated';
        if (!stripePriceId) {
            const price = await stripe.prices.create({
                product: stripeProductId,
                unit_amount: priceInCents,
                currency: 'usd',
            });
            stripePriceId = price.id;
            action = 'created';
        }
        else {
            const existingPrice = await stripe.prices.retrieve(stripePriceId);
            if (existingPrice.unit_amount !== priceInCents) {
                await stripe.prices.update(stripePriceId, { active: false });
                const newPrice = await stripe.prices.create({
                    product: stripeProductId,
                    unit_amount: priceInCents,
                    currency: 'usd',
                });
                stripePriceId = newPrice.id;
                action = 'price_updated';
            }
        }
        await this.productRepo.update(product.id, {
            stripe_product_id: stripeProductId,
            stripe_price_id: stripePriceId,
        });
        return action;
    }
};
exports.StripeProductSyncService = StripeProductSyncService;
exports.StripeProductSyncService = StripeProductSyncService = StripeProductSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        stripe_service_1.StripeService])
], StripeProductSyncService);
//# sourceMappingURL=stripe-product-sync.service.js.map