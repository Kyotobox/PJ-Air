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
exports.CheckPaymentsController = void 0;
const common_1 = require("@nestjs/common");
const check_payments_service_1 = require("./check-payments.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let CheckPaymentsController = class CheckPaymentsController {
    checkPaymentsService;
    constructor(checkPaymentsService) {
        this.checkPaymentsService = checkPaymentsService;
    }
    async register(dto) {
        return await this.checkPaymentsService.registerCheck(dto);
    }
    async markAsDeposited(id, body) {
        return await this.checkPaymentsService.markAsDeposited(id, body?.notes);
    }
    async markAsBounced(id, body) {
        return await this.checkPaymentsService.markAsBounced(id, body?.reason);
    }
    async getReconciliation() {
        return await this.checkPaymentsService.getReconciliationGrouped();
    }
    async getByOrder(orderId) {
        return await this.checkPaymentsService.findByOrder(orderId);
    }
    async getById(id) {
        return await this.checkPaymentsService.findById(id);
    }
    async getAll(status, orderId, userId) {
        return await this.checkPaymentsService.findAll({ status: status, orderId, userId });
    }
};
exports.CheckPaymentsController = CheckPaymentsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [check_payments_service_1.RegisterCheckDto]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "register", null);
__decorate([
    (0, common_1.Post)(':id/deposit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "markAsDeposited", null);
__decorate([
    (0, common_1.Post)(':id/bounce'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "markAsBounced", null);
__decorate([
    (0, common_1.Get)('reconciliation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "getReconciliation", null);
__decorate([
    (0, common_1.Get)('order/:orderId'),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "getByOrder", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('orderId')),
    __param(2, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CheckPaymentsController.prototype, "getAll", null);
exports.CheckPaymentsController = CheckPaymentsController = __decorate([
    (0, common_1.Controller)('payments/checks'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [check_payments_service_1.CheckPaymentsService])
], CheckPaymentsController);
//# sourceMappingURL=check-payments.controller.js.map