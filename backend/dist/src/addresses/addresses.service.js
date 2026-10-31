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
exports.AddressesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const address_entity_1 = require("./address.entity");
const address_validation_service_1 = require("./address-validation.service");
let AddressesService = class AddressesService {
    addressRepository;
    addressValidationService;
    constructor(addressRepository, addressValidationService) {
        this.addressRepository = addressRepository;
        this.addressValidationService = addressValidationService;
    }
    async findAll() {
        return this.addressRepository.find();
    }
    async findByUser(userId) {
        return this.addressRepository.find({
            where: { user_id: userId, is_temporary: false },
        });
    }
    async findOne(id) {
        const address = await this.addressRepository.findOne({ where: { id } });
        if (!address)
            throw new common_1.NotFoundException('Address not found');
        return address;
    }
    async create(userId, addressData) {
        if (this.addressValidationService && addressData.address) {
            const geo = await this.addressValidationService.validateAndGeocode(addressData.address, addressData.lat, addressData.lng);
            addressData.lat = geo.lat;
            addressData.lng = geo.lng;
            if (!addressData.city && geo.city)
                addressData.city = geo.city;
            if (geo.formatted_address)
                addressData.address = geo.formatted_address;
        }
        const address = this.addressRepository.create({
            ...addressData,
            user_id: userId,
        });
        return this.addressRepository.save(address);
    }
    async update(id, addressData) {
        const address = await this.addressRepository.findOne({ where: { id } });
        if (!address)
            throw new common_1.NotFoundException('Address not found');
        if (this.addressValidationService && addressData.address) {
            const geo = await this.addressValidationService.validateAndGeocode(addressData.address, addressData.lat, addressData.lng);
            addressData.lat = geo.lat;
            addressData.lng = geo.lng;
            if (!addressData.city && geo.city)
                addressData.city = geo.city;
            if (geo.formatted_address)
                addressData.address = geo.formatted_address;
        }
        Object.assign(address, addressData);
        return this.addressRepository.save(address);
    }
    async delete(id) {
        const address = await this.addressRepository.findOne({ where: { id } });
        if (!address)
            throw new common_1.NotFoundException('Address not found');
        return this.addressRepository.remove(address);
    }
};
exports.AddressesService = AddressesService;
exports.AddressesService = AddressesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(address_entity_1.Address)),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        address_validation_service_1.AddressValidationService])
], AddressesService);
//# sourceMappingURL=addresses.service.js.map