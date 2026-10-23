"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const orders_service_1 = require("./orders.service");
const orders_controller_1 = require("./orders.controller");
const scheduled_orders_service_1 = require("./scheduled-orders.service");
const scheduled_orders_controller_1 = require("./scheduled-orders.controller");
const excel_service_1 = require("./excel.service");
const order_entity_1 = require("./order.entity");
const order_item_entity_1 = require("./order-item.entity");
const scheduled_order_entity_1 = require("./scheduled-order.entity");
const user_entity_1 = require("../users/user.entity");
const product_entity_1 = require("../products/product.entity");
const mail_module_1 = require("../mail/mail.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([order_entity_1.Order, order_item_entity_1.OrderItem, user_entity_1.User, product_entity_1.Product, scheduled_order_entity_1.ScheduledOrder]),
            mail_module_1.MailModule,
        ],
        providers: [orders_service_1.OrdersService, scheduled_orders_service_1.ScheduledOrdersService, excel_service_1.ExcelService],
        controllers: [orders_controller_1.OrdersController, scheduled_orders_controller_1.ScheduledOrdersController],
        exports: [orders_service_1.OrdersService, scheduled_orders_service_1.ScheduledOrdersService, excel_service_1.ExcelService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map