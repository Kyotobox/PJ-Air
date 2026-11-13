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
exports.AdminActionsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const admin_actions_service_1 = require("./admin-actions.service");
let AdminActionsController = class AdminActionsController {
    adminActionsService;
    constructor(adminActionsService) {
        this.adminActionsService = adminActionsService;
    }
    async getAuditLogs(page, limit, action, targetEntity, targetEntityCamel, targetId, targetIdCamel, adminId, adminIdCamel, startDate, endDate) {
        return this.adminActionsService.getAuditLogs({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            action,
            targetEntity: targetEntity || targetEntityCamel,
            targetId: targetId || targetIdCamel,
            adminId: adminId || adminIdCamel,
            startDate,
            endDate,
        });
    }
    async resetPassword(id, body, req) {
        if (!req.user || req.user.role !== 'admin') {
            throw new common_1.ForbiddenException('Solo los administradores pueden realizar esta acción');
        }
        const { newPassword } = body;
        if (!newPassword || newPassword.length < 8) {
            throw new common_1.BadRequestException('La contraseña debe tener al menos 8 caracteres');
        }
        const res = await this.adminActionsService.resetPassword(id, newPassword);
        try {
            await this.adminActionsService.logAction(req.user.id, req.user.name || req.user.email || 'Admin', 'PASSWORD_RESET', 'User', id, null, null, 'Restablecimiento forzado de contraseña por administrador', req.ip);
        }
        catch (_) { }
        return res;
    }
    async changePassword(body, req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new common_1.UnauthorizedException('No autenticado');
        }
        const { currentPassword, newPassword } = body;
        if (!currentPassword) {
            throw new common_1.BadRequestException('Contraseña actual requerida');
        }
        if (!newPassword || newPassword.length < 8) {
            throw new common_1.BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
        }
        return this.adminActionsService.changeOwnPassword(userId, currentPassword, newPassword);
    }
};
exports.AdminActionsController = AdminActionsController;
__decorate([
    (0, common_1.Get)('audit-logs'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('action')),
    __param(3, (0, common_1.Query)('target_entity')),
    __param(4, (0, common_1.Query)('targetEntity')),
    __param(5, (0, common_1.Query)('target_id')),
    __param(6, (0, common_1.Query)('targetId')),
    __param(7, (0, common_1.Query)('admin_id')),
    __param(8, (0, common_1.Query)('adminId')),
    __param(9, (0, common_1.Query)('startDate')),
    __param(10, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminActionsController.prototype, "getAuditLogs", null);
__decorate([
    (0, common_1.Patch)('users/:id/reset-password'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminActionsController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Patch)('me/change-password'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminActionsController.prototype, "changePassword", null);
exports.AdminActionsController = AdminActionsController = __decorate([
    (0, common_1.Controller)(['admin-actions', 'api/admin-actions']),
    __metadata("design:paramtypes", [admin_actions_service_1.AdminActionsService])
], AdminActionsController);
//# sourceMappingURL=admin-actions.controller.js.map