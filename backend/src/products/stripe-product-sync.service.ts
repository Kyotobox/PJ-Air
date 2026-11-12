import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { StripeService } from '../payments/stripe.service';

export interface StripeSyncResult {
  synced: number;
  skipped: number;
  errors: number;
  details: Array<{ productId: number; action: string; error?: string }>;
}

@Injectable()
export class StripeProductSyncService {
  private readonly logger = new Logger(StripeProductSyncService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly stripeService: StripeService,
  ) {}

  async syncAll(): Promise<StripeSyncResult> {
    const stripe = this.stripeService.getStripeClient();
    if (!stripe) {
      this.logger.error('Stripe client not initialized. Skipping sync.');
      return { synced: 0, skipped: 0, errors: 0, details: [] };
    }

    const products = await this.productRepo.find({ where: { is_deleted: false } });
    const result: StripeSyncResult = { synced: 0, skipped: 0, errors: 0, details: [] };

    for (const product of products) {
      try {
        const action = await this.syncOne(product, stripe);
        result.synced++;
        result.details.push({ productId: product.id, action });
      } catch (err: any) {
        result.errors++;
        result.details.push({ productId: product.id, action: 'error', error: err.message });
        this.logger.error(`Stripe sync failed for product ${product.id} (${product.name}): ${err.message}`);
      }
    }

    this.logger.log(`[Stripe Catalog Sync] Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
    return result;
  }

  async syncOne(product: Product, stripeClient?: any): Promise<string> {
    const stripe = stripeClient || this.stripeService.getStripeClient();
    if (!stripe) throw new Error('Stripe client not initialized');

    const priceInCents = Math.round(Number(product.price) * 100);

    // Upsert Stripe Product
    let stripeProductId = product.stripe_product_id;
    if (!stripeProductId) {
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description || undefined,
        metadata: { local_product_id: String(product.id) },
      });
      stripeProductId = stripeProduct.id;
    } else {
      await stripe.products.update(stripeProductId, {
        name: product.name,
        description: product.description || undefined,
      });
    }

    // Upsert Stripe Price (prices are immutable — deactivate old, create new if changed)
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
    } else {
      // Check if price changed
      const existingPrice = await stripe.prices.retrieve(stripePriceId);
      if (existingPrice.unit_amount !== priceInCents) {
        // Deactivate old price
        await stripe.prices.update(stripePriceId, { active: false });
        // Create new price
        const newPrice = await stripe.prices.create({
          product: stripeProductId,
          unit_amount: priceInCents,
          currency: 'usd',
        });
        stripePriceId = newPrice.id;
        action = 'price_updated';
      }
    }

    // Persist IDs to local DB
    await this.productRepo.update(product.id, {
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
    });

    return action;
  }
}
