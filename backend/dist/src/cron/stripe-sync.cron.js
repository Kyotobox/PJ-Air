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
var StripeSyncCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeSyncCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const stripe_product_sync_service_1 = require("../products/stripe-product-sync.service");
let StripeSyncCron = StripeSyncCron_1 = class StripeSyncCron {
    stripeProductSyncService;
    logger = new common_1.Logger(StripeSyncCron_1.name);
    constructor(stripeProductSyncService) {
        this.stripeProductSyncService = stripeProductSyncService;
    }
    async handleDailyStripeCatalogSync() {
        this.logger.log('[Stripe Cron] Iniciando sincronización diaria de catálogo con Stripe...');
        const result = await this.stripeProductSyncService.syncAll();
        this.logger.log(`[Stripe Cron] Completado — Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
    }
};
exports.StripeSyncCron = StripeSyncCron;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *', { timeZone: 'America/New_York' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StripeSyncCron.prototype, "handleDailyStripeCatalogSync", null);
exports.StripeSyncCron = StripeSyncCron = StripeSyncCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stripe_product_sync_service_1.StripeProductSyncService])
], StripeSyncCron);
//# sourceMappingURL=stripe-sync.cron.js.map