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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryZone = exports.ColumnNumericTransformer = void 0;
const typeorm_1 = require("typeorm");
exports.ColumnNumericTransformer = {
    to: (data) => (data === undefined || data === null ? null : Number(data)),
    from: (data) => (data === null || data === undefined ? null : Number(data)),
};
let DeliveryZone = class DeliveryZone {
    id;
    name;
    zip_codes;
    base_fee;
    min_free_delivery_amount;
    is_active;
    created_at;
    updated_at;
};
exports.DeliveryZone = DeliveryZone;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DeliveryZone.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DeliveryZone.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], DeliveryZone.prototype, "zip_codes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
        transformer: exports.ColumnNumericTransformer,
    }),
    __metadata("design:type", Number)
], DeliveryZone.prototype, "base_fee", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 10,
        scale: 2,
        nullable: true,
        default: null,
        transformer: exports.ColumnNumericTransformer,
    }),
    __metadata("design:type", Object)
], DeliveryZone.prototype, "min_free_delivery_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DeliveryZone.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DeliveryZone.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DeliveryZone.prototype, "updated_at", void 0);
exports.DeliveryZone = DeliveryZone = __decorate([
    (0, typeorm_1.Entity)('delivery_zones')
], DeliveryZone);
//# sourceMappingURL=delivery-zone.entity.js.map