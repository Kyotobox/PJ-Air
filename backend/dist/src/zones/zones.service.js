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
exports.ZonesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const delivery_zone_entity_1 = require("./delivery-zone.entity");
let ZonesService = class ZonesService {
    zoneRepository;
    constructor(zoneRepository) {
        this.zoneRepository = zoneRepository;
    }
    async findAll() {
        try {
            return await this.zoneRepository.find({
                order: { created_at: 'DESC' },
            });
        }
        catch (_) {
            return [];
        }
    }
    async findOne(id) {
        const zone = await this.zoneRepository.findOne({ where: { id } });
        if (!zone) {
            throw new common_1.NotFoundException(`Delivery zone with ID "${id}" not found`);
        }
        return zone;
    }
    async create(dto) {
        if (!dto.name || !dto.name.trim()) {
            throw new common_1.BadRequestException('El nombre de la zona es obligatorio');
        }
        if (!dto.zip_codes || !dto.zip_codes.trim()) {
            throw new common_1.BadRequestException('Debe especificar al menos un código postal');
        }
        const zone = this.zoneRepository.create({
            name: dto.name.trim(),
            zip_codes: dto.zip_codes.trim(),
            base_fee: dto.base_fee !== undefined && dto.base_fee !== null ? Number(dto.base_fee) : 0,
            min_free_delivery_amount: dto.min_free_delivery_amount !== undefined && dto.min_free_delivery_amount !== null && Number(dto.min_free_delivery_amount) > 0
                ? Number(dto.min_free_delivery_amount)
                : null,
            is_active: dto.is_active !== undefined ? Boolean(dto.is_active) : true,
        });
        return this.zoneRepository.save(zone);
    }
    async update(id, dto) {
        const zone = await this.findOne(id);
        if (dto.name !== undefined) {
            if (!dto.name.trim())
                throw new common_1.BadRequestException('El nombre de la zona no puede estar vacío');
            zone.name = dto.name.trim();
        }
        if (dto.zip_codes !== undefined) {
            if (!dto.zip_codes.trim())
                throw new common_1.BadRequestException('Los códigos postales no pueden estar vacíos');
            zone.zip_codes = dto.zip_codes.trim();
        }
        if (dto.base_fee !== undefined) {
            zone.base_fee = Number(dto.base_fee) || 0;
        }
        if (dto.min_free_delivery_amount !== undefined) {
            zone.min_free_delivery_amount =
                dto.min_free_delivery_amount !== null && Number(dto.min_free_delivery_amount) > 0
                    ? Number(dto.min_free_delivery_amount)
                    : null;
        }
        if (dto.is_active !== undefined) {
            zone.is_active = Boolean(dto.is_active);
        }
        return this.zoneRepository.save(zone);
    }
    async delete(id) {
        const zone = await this.findOne(id);
        await this.zoneRepository.remove(zone);
    }
    async resolveZip(zip) {
        return null;
    }
};
exports.ZonesService = ZonesService;
exports.ZonesService = ZonesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(delivery_zone_entity_1.DeliveryZone)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ZonesService);
//# sourceMappingURL=zones.service.js.map