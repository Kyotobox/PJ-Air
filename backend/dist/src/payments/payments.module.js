"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const payments_controller_1 = require("./payments.controller");
const payments_service_1 = require("./payments.service");
const check_payments_controller_1 = require("./check-payments.controller");
const check_payments_service_1 = require("./check-payments.service");
const check_payment_entity_1 = require("./check-payment.entity");
const order_entity_1 = require("../orders/order.entity");
const user_entity_1 = require("../users/user.entity");
const orders_module_1 = require("../orders/orders.module");
const users_module_1 = require("../users/users.module");
const mail_module_1 = require("../mail/mail.module");
const credit_module_1 = require("../credit/credit.module");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([check_payment_entity_1.CheckPayment, order_entity_1.Order, user_entity_1.User]),
            orders_module_1.OrdersModule,
            users_module_1.UsersModule,
            mail_module_1.MailModule,
            credit_module_1.CreditModule,
        ],
        controllers: [payments_controller_1.PaymentsController, check_payments_controller_1.CheckPaymentsController],
        providers: [payments_service_1.PaymentsService, check_payments_service_1.CheckPaymentsService],
        exports: [payments_service_1.PaymentsService, check_payments_service_1.CheckPaymentsService],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map