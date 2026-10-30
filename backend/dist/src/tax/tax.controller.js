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
exports.TaxController = void 0;
const common_1 = require("@nestjs/common");
const tax_service_1 = require("./tax.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let TaxController = class TaxController {
    taxService;
    constructor(taxService) {
        this.taxService = taxService;
    }
    async validateST120(userId) {
        return this.taxService.auditUserST120(userId);
    }
    async approveExemption(userId) {
        return this.taxService.approveExemption(userId);
    }
    async rejectExemption(userId, reason) {
        return this.taxService.rejectExemption(userId, reason);
    }
    async getStatus(userId) {
        const user = await this.taxService['userRepository'].findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
        const taxId = user?.profile?.tax_id || user?.tax_id || null;
        const st120Status = user?.profile?.st120_status || user?.st120_status || 'NONE';
        const st120DocUrl = user?.profile?.st120_document_url || user?.st120_document_url || null;
        return {
            userId,
            taxId,
            st120Status,
            st120DocumentUrl: st120DocUrl,
            taxExempt: isExempt,
            taxLegend: isExempt ? this.taxService.getOfficialNysDtfLegend(taxId) : null,
        };
    }
};
exports.TaxController = TaxController;
__decorate([
    (0, common_1.Post)('validate-st120/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "validateST120", null);
__decorate([
    (0, common_1.Post)('approve/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "approveExemption", null);
__decorate([
    (0, common_1.Post)('reject/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "rejectExemption", null);
__decorate([
    (0, common_1.Get)('status/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "getStatus", null);
exports.TaxController = TaxController = __decorate([
    (0, common_1.Controller)('tax'),
    __metadata("design:paramtypes", [tax_service_1.TaxService])
], TaxController);
//# sourceMappingURL=tax.controller.js.map