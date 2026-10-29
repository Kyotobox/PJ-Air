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
var AppModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const typeorm_2 = require("typeorm");
const config_1 = require("./config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const users_module_1 = require("./users/users.module");
const products_module_1 = require("./products/products.module");
const orders_module_1 = require("./orders/orders.module");
const addresses_module_1 = require("./addresses/addresses.module");
const devtools_module_1 = require("./devtools/devtools.module");
const auth_module_1 = require("./auth/auth.module");
const system_configs_module_1 = require("./system-configs/system-configs.module");
const admin_actions_module_1 = require("./admin-actions/admin-actions.module");
const payments_module_1 = require("./payments/payments.module");
const mail_module_1 = require("./mail/mail.module");
const zones_module_1 = require("./zones/zones.module");
const credit_module_1 = require("./credit/credit.module");
const sms_module_1 = require("./sms/sms.module");
const collection_cron_module_1 = require("./cron/collection-cron.module");
const tax_module_1 = require("./tax/tax.module");
const product_entity_1 = require("./products/product.entity");
const category_entity_1 = require("./products/category.entity");
const user_entity_1 = require("./users/user.entity");
const profile_entity_1 = require("./users/profile.entity");
const address_entity_1 = require("./addresses/address.entity");
const order_entity_1 = require("./orders/order.entity");
const order_item_entity_1 = require("./orders/order-item.entity");
const product_discount_entity_1 = require("./users/product-discount.entity");
const system_config_entity_1 = require("./system-configs/system-config.entity");
const delivery_zone_entity_1 = require("./zones/delivery-zone.entity");
const check_payment_entity_1 = require("./payments/check-payment.entity");
let AppModule = AppModule_1 = class AppModule {
    dataSource;
    logger = new common_1.Logger(AppModule_1.name);
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async onModuleInit() {
        this.logger.log('Application initialized. Running schema verification...');
        try {
            const qr = this.dataSource.createQueryRunner();
            try {
                await qr.query(`PRAGMA journal_mode = WAL;`);
                await qr.query(`PRAGMA busy_timeout = 10000;`);
                await qr.query(`PRAGMA synchronous = NORMAL;`);
            }
            catch (e) {
                this.logger.warn(`Could not set SQLite pragmas: ${e.message}`);
            }
            const orderCols = await qr.query(`PRAGMA table_info(orders);`);
            const orderColNames = orderCols.map((c) => c.name);
            if (!orderColNames.includes('stripe_payment_id')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN stripe_payment_id VARCHAR;`);
            }
            if (!orderColNames.includes('refunded_amount')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0;`);
            }
            if (!orderColNames.includes('refund_reason')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN refund_reason VARCHAR;`);
            }
            if (!orderColNames.includes('payment_due_date')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN payment_due_date VARCHAR;`);
            }
            if (!orderColNames.includes('fee_amount')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN fee_amount DECIMAL(10,2) DEFAULT 0;`);
            }
            if (!orderColNames.includes('fee_method')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN fee_method VARCHAR;`);
            }
            const userCols = await qr.query(`PRAGMA table_info(users);`);
            const userColNames = userCols.map((c) => c.name);
            if (!userColNames.includes('stripe_customer_id')) {
                await qr.query(`ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR;`);
            }
            if (!userColNames.includes('credit_blocked')) {
                await qr.query(`ALTER TABLE users ADD COLUMN credit_blocked BOOLEAN DEFAULT 0;`);
            }
            if (!userColNames.includes('tax_id')) {
                await qr.query(`ALTER TABLE users ADD COLUMN tax_id VARCHAR;`);
            }
            if (!userColNames.includes('st120_status')) {
                await qr.query(`ALTER TABLE users ADD COLUMN st120_status VARCHAR DEFAULT 'NONE';`);
            }
            if (!userColNames.includes('st120_document_url')) {
                await qr.query(`ALTER TABLE users ADD COLUMN st120_document_url VARCHAR;`);
            }
            if (!userColNames.includes('tax_exempt')) {
                await qr.query(`ALTER TABLE users ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
            }
            await qr.query(`
        CREATE TABLE IF NOT EXISTS check_payments (
          id VARCHAR PRIMARY KEY NOT NULL,
          order_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          check_number VARCHAR NOT NULL,
          bank_name VARCHAR NOT NULL,
          status VARCHAR NOT NULL DEFAULT 'PENDING_CLEARANCE',
          deposit_date DATETIME NOT NULL,
          estimated_clearance_date DATETIME NOT NULL,
          cleared_at DATETIME,
          bounced_at DATETIME,
          bounce_reason VARCHAR,
          reference_image_url VARCHAR,
          notes VARCHAR,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        );
      `);
            const profileCols = await qr.query(`PRAGMA table_info(profiles);`);
            const profileColNames = profileCols.map((c) => c.name);
            if (!profileColNames.includes('phone_verified')) {
                await qr.query(`ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT 0;`);
            }
            if (!profileColNames.includes('tax_id')) {
                await qr.query(`ALTER TABLE profiles ADD COLUMN tax_id VARCHAR;`);
            }
            if (!profileColNames.includes('st120_status')) {
                await qr.query(`ALTER TABLE profiles ADD COLUMN st120_status VARCHAR DEFAULT 'NONE';`);
            }
            if (!profileColNames.includes('st120_document_url')) {
                await qr.query(`ALTER TABLE profiles ADD COLUMN st120_document_url VARCHAR;`);
            }
            if (!profileColNames.includes('tax_exempt')) {
                await qr.query(`ALTER TABLE profiles ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
            }
            if (!orderColNames.includes('tax_amount')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN tax_amount DECIMAL(10,2) DEFAULT 0;`);
            }
            if (!orderColNames.includes('tax_rate')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0;`);
            }
            if (!orderColNames.includes('tax_exempt')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN tax_exempt BOOLEAN DEFAULT 0;`);
            }
            if (!orderColNames.includes('tax_legend')) {
                await qr.query(`ALTER TABLE orders ADD COLUMN tax_legend TEXT;`);
            }
            await qr.query(`DROP TABLE IF EXISTS scheduled_orders;`);
            await qr.query(`
        CREATE TABLE IF NOT EXISTS delivery_zones (
          id VARCHAR PRIMARY KEY NOT NULL,
          name VARCHAR NOT NULL,
          zip_codes TEXT NOT NULL,
          base_fee DECIMAL(10,2) DEFAULT 0,
          min_free_delivery_amount DECIMAL(10,2) DEFAULT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT (datetime('now')),
          updated_at DATETIME DEFAULT (datetime('now'))
        );
      `);
            const zoneCountRows = await qr.query(`SELECT COUNT(*) as count FROM delivery_zones;`);
            const zoneCount = zoneCountRows && zoneCountRows[0] ? Number(zoneCountRows[0].count ?? zoneCountRows[0]['COUNT(*)'] ?? 0) : 0;
            if (zoneCount === 0) {
                await qr.query(`
          INSERT INTO delivery_zones (id, name, zip_codes, base_fee, min_free_delivery_amount, is_active)
          VALUES 
          ('zone-astoria-lic', 'Zona 1: Local Inmediata (Astoria & LIC)', '11101, 11102, 11103, 11104, 11105, 11106, 11109, 11377', 5.00, 60.00, 1),
          ('zone-queens-mid', 'Zona 2: Queens Centro & Norte', '11354, 11355, 11356, 11368, 11369, 11370, 11372, 11373, 11374, 11375, 11378, 11379, 11385', 12.00, 120.00, 1),
          ('zone-bk-east-mnh', 'Zona 3: North Brooklyn & East Manhattan', '10044, 10016, 10017, 10021, 10022, 10028, 10065, 10075, 11206, 11211, 11222, 11237, 11249', 18.00, 180.00, 1),
          ('zone-mnh-south-bk', 'Zona 4: Manhattan Central/Sur & Downtown Brooklyn', '10001, 10002, 10003, 10004, 10005, 10006, 10007, 10009, 10010, 10011, 10012, 10013, 10014, 10018, 10019, 10023, 10024, 10025, 10036, 10038, 11201, 11205, 11215, 11217, 11231, 11238', 25.00, 250.00, 1),
          ('zone-outer-bx', 'Zona 5: Queens Exterior & South Bronx', '10451, 10454, 10455, 11357, 11360, 11361, 11364, 11415, 11418, 11421, 11432, 11435', 35.00, 350.00, 1);
        `);
            }
            await qr.release();
            this.logger.log('Schema verification completed successfully.');
        }
        catch (e) {
            this.logger.warn(`Schema verification warning: ${e.message}`);
        }
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = AppModule_1 = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: config_1.DATABASE_PATH,
                entities: [product_entity_1.Product, category_entity_1.Category, user_entity_1.User, profile_entity_1.Profile, address_entity_1.Address, order_entity_1.Order, order_item_entity_1.OrderItem, product_discount_entity_1.ProductDiscount, system_config_entity_1.SystemConfig, delivery_zone_entity_1.DeliveryZone, check_payment_entity_1.CheckPayment],
                synchronize: config_1.NODE_ENV !== 'production',
                logging: false,
            }),
            users_module_1.UsersModule,
            products_module_1.ProductsModule,
            orders_module_1.OrdersModule,
            addresses_module_1.AddressesModule,
            devtools_module_1.DevtoolsModule,
            auth_module_1.AuthModule,
            system_configs_module_1.SystemConfigsModule,
            admin_actions_module_1.AdminActionsModule,
            payments_module_1.PaymentsModule,
            mail_module_1.MailModule,
            zones_module_1.ZonesModule,
            credit_module_1.CreditModule,
            schedule_1.ScheduleModule.forRoot(),
            sms_module_1.SmsModule,
            collection_cron_module_1.CollectionCronModule,
            tax_module_1.TaxModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    }),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], AppModule);
//# sourceMappingURL=app.module.js.map