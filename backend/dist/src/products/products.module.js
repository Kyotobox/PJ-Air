"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const products_service_1 = require("./products.service");
const products_controller_1 = require("./products.controller");
const categories_controller_1 = require("./categories.controller");
const product_entity_1 = require("./product.entity");
const category_entity_1 = require("./category.entity");
const payments_module_1 = require("../payments/payments.module");
const stripe_product_sync_service_1 = require("./stripe-product-sync.service");
let ProductsModule = class ProductsModule {
};
exports.ProductsModule = ProductsModule;
exports.ProductsModule = ProductsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([product_entity_1.Product, category_entity_1.Category]), payments_module_1.PaymentsModule],
        providers: [products_service_1.ProductsService, stripe_product_sync_service_1.StripeProductSyncService],
        controllers: [categories_controller_1.CategoriesController, products_controller_1.ProductsController],
        exports: [products_service_1.ProductsService, stripe_product_sync_service_1.StripeProductSyncService],
    })
], ProductsModule);
//# sourceMappingURL=products.module.js.map