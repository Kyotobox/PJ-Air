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
exports.CreateDeliveryIncidentDto = void 0;
const class_validator_1 = require("class-validator");
class CreateDeliveryIncidentDto {
    order_id;
    user_id;
    product_id;
    quantity;
    reason_category;
    description;
    photo_url;
    amount;
    voucher_code;
    status;
    reviewed_by;
}
exports.CreateDeliveryIncidentDto = CreateDeliveryIncidentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "order_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "user_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'product_id es requerido' }),
    (0, class_validator_1.IsNumber)({}, { message: 'product_id debe ser numérico' }),
    __metadata("design:type", Number)
], CreateDeliveryIncidentDto.prototype, "product_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'quantity es requerido' }),
    (0, class_validator_1.IsNumber)({}, { message: 'quantity debe ser numérico' }),
    (0, class_validator_1.IsPositive)({ message: 'quantity debe ser mayor a 0' }),
    __metadata("design:type", Number)
], CreateDeliveryIncidentDto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'reason_category es requerido' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['missing_kitchen', 'transit_damage', 'quality_defect', 'wrong_item'], {
        message: 'reason_category debe ser missing_kitchen, transit_damage, quality_defect o wrong_item',
    }),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "reason_category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "photo_url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({}, { message: 'amount debe ser numérico' }),
    __metadata("design:type", Number)
], CreateDeliveryIncidentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "voucher_code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateDeliveryIncidentDto.prototype, "reviewed_by", void 0);
//# sourceMappingURL=create-delivery-incident.dto.js.map