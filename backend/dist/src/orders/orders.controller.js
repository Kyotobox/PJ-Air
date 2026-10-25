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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const excel_service_1 = require("./excel.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const resource_ownership_guard_1 = require("../auth/resource-ownership.guard");
let OrdersController = class OrdersController {
    ordersService;
    excelService;
    constructor(ordersService, excelService) {
        this.ordersService = ordersService;
        this.excelService = excelService;
    }
    async create(body, req) {
        const targetUserId = (req.user?.role === 'admin' && body.userId) ? body.userId : req.user.id;
        const { userId, ...orderData } = body;
        return this.ordersService.create(targetUserId, orderData);
    }
    async findAll(req) {
        const role = req.user?.role;
        if (role === 'admin' || role === 'delivery' || role === 'produccion') {
            return this.ordersService.findAll();
        }
        return this.ordersService.findByUser(req.user.id);
    }
    async findByUser(userId, req) {
        const role = req.user?.role;
        if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && req.user.id !== userId) {
            throw new common_1.ForbiddenException('Cannot access other user orders');
        }
        return this.ordersService.findByUser(userId);
    }
    async exportIndividual(startDate, endDate, res) {
        const orders = await this.ordersService.findInRange(startDate, endDate);
        const buffer = await this.excelService.exportIndividual(orders);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="ORDENES_INDIVIDUALES.xlsx"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async exportConsolidated(startDate, endDate, res) {
        const orders = await this.ordersService.findInRange(startDate, endDate);
        const buffer = await this.excelService.exportConsolidated(orders);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="ORDENES_CONSOLIDADO.xlsx"`,
            'Content-Length': buffer.length,
        });
        res.end(buffer);
    }
    async findInRange(startDate, endDate, userId) {
        return this.ordersService.findInRange(startDate, endDate, userId);
    }
    async findOne(id, req) {
        const order = await this.ordersService.findOne(id);
        const role = req.user?.role;
        if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && order.user_id !== req.user.id) {
            throw new common_1.ForbiddenException('Cannot access this order');
        }
        return order;
    }
    async updateStatus(id, status, req) {
        const order = await this.ordersService.findOne(id);
        const role = req.user?.role;
        if (role !== 'admin' && role !== 'delivery' && role !== 'produccion' && order.user_id !== req.user.id) {
            throw new common_1.ForbiddenException('Cannot modify this order status');
        }
        return this.ordersService.updateStatus(id, status, role);
    }
    async updatePaymentStatus(id, paymentStatus) {
        return this.ordersService.update(id, { payment_status: paymentStatus }, 'admin');
    }
    async approveZelle(id) {
        return this.ordersService.approveZellePayment(id);
    }
    async rejectZelle(id, reason) {
        return this.ordersService.rejectZellePayment(id, reason);
    }
    async assignDelivery(id, deliveryUserId) {
        return this.ordersService.assignDelivery(id, deliveryUserId);
    }
    async update(id, body, req) {
        const order = await this.ordersService.findOne(id);
        const role = req.user?.role;
        if (role !== 'admin' && role !== 'produccion' && order.user_id !== req.user.id) {
            throw new common_1.ForbiddenException('Cannot modify this order');
        }
        return this.ordersService.update(id, body, role);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, resource_ownership_guard_1.ResourceOwnershipGuard),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findByUser", null);
__decorate([
    (0, common_1.Get)('reports/export-individual'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "exportIndividual", null);
__decorate([
    (0, common_1.Get)('reports/export-consolidated'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "exportConsolidated", null);
__decorate([
    (0, common_1.Get)('reports/range'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __param(2, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findInRange", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/payment-status'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('payment_status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updatePaymentStatus", null);
__decorate([
    (0, common_1.Patch)(':id/approve-zelle'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "approveZelle", null);
__decorate([
    (0, common_1.Patch)(':id/reject-zelle'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "rejectZelle", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'produccion'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('deliveryUserId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "assignDelivery", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "update", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService,
        excel_service_1.ExcelService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map