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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogisticsController = exports.FreightQuoteDto = void 0;
const common_1 = require("@nestjs/common");
const mileage_freight_service_1 = require("./mileage-freight.service");
class FreightQuoteDto {
    miles;
    destLat;
    destLng;
    serviceType;
    destinationAddress;
    address;
}
exports.FreightQuoteDto = FreightQuoteDto;
let LogisticsController = class LogisticsController {
    freightService;
    constructor(freightService) {
        this.freightService = freightService;
    }
    getOrigin() {
        return this.freightService.origin;
    }
    async calculateQuote(body) {
        const serviceType = body.serviceType || 'shared';
        if (body.destLat !== undefined && body.destLng !== undefined) {
            return this.freightService.quoteByCoordinates(Number(body.destLat), Number(body.destLng), serviceType, body.destinationAddress || body.address);
        }
        if (body.address || body.destinationAddress) {
            return this.freightService.quoteByAddress(body.address || body.destinationAddress, serviceType);
        }
        if (body.miles !== undefined) {
            return this.freightService.calculateFreight(Number(body.miles), serviceType);
        }
        if (serviceType === 'pickup') {
            return this.freightService.calculateFreight(0, 'pickup');
        }
        throw new common_1.BadRequestException('Debe proporcionar "miles", "address" o ("destLat" y "destLng") para cotizar');
    }
};
exports.LogisticsController = LogisticsController;
__decorate([
    (0, common_1.Get)('origin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LogisticsController.prototype, "getOrigin", null);
__decorate([
    (0, common_1.Post)('quote'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LogisticsController.prototype, "calculateQuote", null);
exports.LogisticsController = LogisticsController = __decorate([
    (0, common_1.Controller)('logistics'),
    __metadata("design:paramtypes", [mileage_freight_service_1.MileageFreightService])
], LogisticsController);
//# sourceMappingURL=logistics.controller.js.map