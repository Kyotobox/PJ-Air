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
exports.ZonesController = void 0;
const common_1 = require("@nestjs/common");
const zones_service_1 = require("./zones.service");
const create_zone_dto_1 = require("./dto/create-zone.dto");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let ZonesController = class ZonesController {
    zonesService;
    constructor(zonesService) {
        this.zonesService = zonesService;
    }
    async resolve(zip, orFail) {
        if (!zip || !zip.trim()) {
            throw new common_1.BadRequestException('Query parameter "zip" is required');
        }
        const zone = await this.zonesService.resolveZip(zip);
        if (!zone) {
            if (orFail === 'true' || orFail === '1') {
                throw new common_1.NotFoundException(`No delivery zone found for ZIP "${zip}"`);
            }
            return null;
        }
        return zone;
    }
    async findAll() {
        return this.zonesService.findAll();
    }
    async findOne(id) {
        return this.zonesService.findOne(id);
    }
    async create(dto) {
        return this.zonesService.create(dto);
    }
    async updatePut(id, dto) {
        return this.zonesService.update(id, dto);
    }
    async updatePatch(id, dto) {
        return this.zonesService.update(id, dto);
    }
    async delete(id) {
        await this.zonesService.delete(id);
        return { success: true, message: `Zone ${id} deleted successfully` };
    }
};
exports.ZonesController = ZonesController;
__decorate([
    (0, common_1.Get)('resolve'),
    __param(0, (0, common_1.Query)('zip')),
    __param(1, (0, common_1.Query)('orFail')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "resolve", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_zone_dto_1.CreateZoneDto]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_zone_dto_1.UpdateZoneDto]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "updatePut", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_zone_dto_1.UpdateZoneDto]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "updatePatch", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ZonesController.prototype, "delete", null);
exports.ZonesController = ZonesController = __decorate([
    (0, common_1.Controller)('zones'),
    __metadata("design:paramtypes", [zones_service_1.ZonesService])
], ZonesController);
//# sourceMappingURL=zones.controller.js.map