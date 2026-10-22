"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AppModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
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
const product_entity_1 = require("./products/product.entity");
const category_entity_1 = require("./products/category.entity");
const user_entity_1 = require("./users/user.entity");
const profile_entity_1 = require("./users/profile.entity");
const address_entity_1 = require("./addresses/address.entity");
const order_entity_1 = require("./orders/order.entity");
const order_item_entity_1 = require("./orders/order-item.entity");
const product_discount_entity_1 = require("./users/product-discount.entity");
const system_config_entity_1 = require("./system-configs/system-config.entity");
let AppModule = AppModule_1 = class AppModule {
    logger = new common_1.Logger(AppModule_1.name);
    onModuleInit() {
        this.logger.log('Application initialized');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = AppModule_1 = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: config_1.DATABASE_PATH,
                entities: [product_entity_1.Product, category_entity_1.Category, user_entity_1.User, profile_entity_1.Profile, address_entity_1.Address, order_entity_1.Order, order_item_entity_1.OrderItem, product_discount_entity_1.ProductDiscount, system_config_entity_1.SystemConfig],
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
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map