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
const excel_service_1 = require("./excel.service");
const fee_calculator_service_1 = require("./fee-calculator.service");
const order_entity_1 = require("./order.entity");
const order_item_entity_1 = require("./order-item.entity");
const user_entity_1 = require("../users/user.entity");
const product_entity_1 = require("../products/product.entity");
const address_entity_1 = require("../addresses/address.entity");
const mail_module_1 = require("../mail/mail.module");
const zones_module_1 = require("../zones/zones.module");
const credit_module_1 = require("../credit/credit.module");
const logistics_module_1 = require("../logistics/logistics.module");
const payments_module_1 = require("../payments/payments.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([order_entity_1.Order, order_item_entity_1.OrderItem, user_entity_1.User, product_entity_1.Product, address_entity_1.Address]),
            mail_module_1.MailModule,
            zones_module_1.ZonesModule,
            credit_module_1.CreditModule,
            logistics_module_1.LogisticsModule,
            (0, common_1.forwardRef)(() => payments_module_1.PaymentsModule),
        ],
        providers: [orders_service_1.OrdersService, excel_service_1.ExcelService, fee_calculator_service_1.FeeCalculatorService],
        controllers: [orders_controller_1.OrdersController],
        exports: [orders_service_1.OrdersService, excel_service_1.ExcelService, fee_calculator_service_1.FeeCalculatorService],
    })
], OrdersModule);
//# sourceMappingURL=orders.module.js.map