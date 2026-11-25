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
exports.DeliveryIncidentsController = void 0;
const common_1 = require("@nestjs/common");
const delivery_incidents_service_1 = require("./delivery-incidents.service");
const create_delivery_incident_dto_1 = require("./dto/create-delivery-incident.dto");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let DeliveryIncidentsController = class DeliveryIncidentsController {
    deliveryIncidentsService;
    constructor(deliveryIncidentsService) {
        this.deliveryIncidentsService = deliveryIncidentsService;
    }
    async reportIncident(orderId, body, req) {
        return this.deliveryIncidentsService.createIncident({
            ...body,
            order_id: orderId,
        }, req.user);
    }
    async approveIncident(incidentId, req) {
        const adminId = req.user?.id || 'admin';
        return this.deliveryIncidentsService.approveIncident(incidentId, adminId);
    }
    async getIncidentsByUser(userId, req) {
        if (req?.user) {
            return this.deliveryIncidentsService.findByUser(userId, req.user);
        }
        return this.deliveryIncidentsService.findByUser(userId);
    }
    async getIncidentsByOrder(orderId, req) {
        return this.deliveryIncidentsService.findByOrder(orderId, req.user);
    }
};
exports.DeliveryIncidentsController = DeliveryIncidentsController;
__decorate([
    (0, common_1.Post)(':id/incidents'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_delivery_incident_dto_1.CreateDeliveryIncidentDto, Object]),
    __metadata("design:returntype", Promise)
], DeliveryIncidentsController.prototype, "reportIncident", null);
__decorate([
    (0, common_1.Patch)('incidents/:id/approve'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeliveryIncidentsController.prototype, "approveIncident", null);
__decorate([
    (0, common_1.Get)('incidents/user/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin', 'auditor'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeliveryIncidentsController.prototype, "getIncidentsByUser", null);
__decorate([
    (0, common_1.Get)(':id/incidents'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DeliveryIncidentsController.prototype, "getIncidentsByOrder", null);
exports.DeliveryIncidentsController = DeliveryIncidentsController = __decorate([
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [delivery_incidents_service_1.DeliveryIncidentsService])
], DeliveryIncidentsController);
//# sourceMappingURL=delivery-incidents.controller.js.map