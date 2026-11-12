import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StripeProductSyncService } from '../products/stripe-product-sync.service';

@Injectable()
export class StripeSyncCron {
  private readonly logger = new Logger(StripeSyncCron.name);

  constructor(private readonly stripeProductSyncService: StripeProductSyncService) {}

  /**
   * S81: Sincronización diaria del catálogo de productos con Stripe Dashboard.
   * Se ejecuta a las 02:00 AM ET todos los días.
   */
  @Cron('0 2 * * *', { timeZone: 'America/New_York' })
  async handleDailyStripeCatalogSync(): Promise<void> {
    this.logger.log('[Stripe Cron] Iniciando sincronización diaria de catálogo con Stripe...');
    const result = await this.stripeProductSyncService.syncAll();
    this.logger.log(
      `[Stripe Cron] Completado — Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors}`
    );
  }
}
