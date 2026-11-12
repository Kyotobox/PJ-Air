"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionCronModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const collection_cron_1 = require("./collection.cron");
const financial_reports_cron_1 = require("./financial-reports.cron");
const stripe_sync_cron_1 = require("./stripe-sync.cron");
const order_entity_1 = require("../orders/order.entity");
const mail_module_1 = require("../mail/mail.module");
const sms_module_1 = require("../sms/sms.module");
const excel_service_1 = require("../orders/excel.service");
const system_configs_module_1 = require("../system-configs/system-configs.module");
const products_module_1 = require("../products/products.module");
let CollectionCronModule = class CollectionCronModule {
};
exports.CollectionCronModule = CollectionCronModule;
exports.CollectionCronModule = CollectionCronModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([order_entity_1.Order]),
            mail_module_1.MailModule,
            sms_module_1.SmsModule,
            system_configs_module_1.SystemConfigsModule,
            products_module_1.ProductsModule,
        ],
        providers: [collection_cron_1.CollectionCron, financial_reports_cron_1.FinancialReportsCron, stripe_sync_cron_1.StripeSyncCron, excel_service_1.ExcelService],
        exports: [collection_cron_1.CollectionCron, financial_reports_cron_1.FinancialReportsCron, stripe_sync_cron_1.StripeSyncCron],
    })
], CollectionCronModule);
//# sourceMappingURL=collection-cron.module.js.map