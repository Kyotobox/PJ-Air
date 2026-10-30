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
exports.CreditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const order_entity_1 = require("../orders/order.entity");
let CreditService = class CreditService {
    userRepository;
    orderRepository;
    constructor(userRepository, orderRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }
    async getClientCreditSummary(clientId) {
        const user = await this.userRepository.findOne({
            where: { id: clientId },
            relations: ['profile'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`Cliente con id ${clientId} no encontrado`);
        }
        const creditLimit = await this.getCreditLimit(clientId);
        const usedCredit = await this.getUsedCredit(clientId);
        const availableCredit = await this.getAvailableCredit(clientId);
        return {
            credit_limit: creditLimit,
            used_credit: usedCredit,
            available_credit: availableCredit,
            credit_blocked: Boolean(user.credit_blocked),
            credit_override: Boolean(user.credit_override),
        };
    }
    async getCreditLimit(clientId) {
        const user = await this.userRepository.findOne({
            where: { id: clientId },
            relations: ['profile'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`Cliente con id ${clientId} no encontrado`);
        }
        return Math.round((Number(user.credit_limit || 0) + Number.EPSILON) * 100) / 100;
    }
    async getUsedCredit(clientId) {
        const orders = await this.orderRepository.find({
            where: { user_id: clientId },
        });
        const activeCreditOrders = orders.filter((o) => {
            const isCredit = o.payment_method === 'credit';
            const notCancelled = o.status !== 'cancelled' && o.status !== 'Cancelado';
            const notPaid = o.payment_status !== 'paid';
            return isCredit && notCancelled && notPaid;
        });
        const totalUsed = activeCreditOrders.reduce((sum, o) => {
            const netDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
            return sum + netDebt;
        }, 0);
        return Math.round((totalUsed + Number.EPSILON) * 100) / 100;
    }
    async getAvailableCredit(clientId) {
        const limit = await this.getCreditLimit(clientId);
        const used = await this.getUsedCredit(clientId);
        return Math.round((limit - used + Number.EPSILON) * 100) / 100;
    }
    calculatePaymentDueDate(createdAt = new Date()) {
        const base = typeof createdAt === 'string' ? new Date(createdAt) : new Date(createdAt.getTime());
        const dueDate = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
        const yr = dueDate.getUTCFullYear();
        const mo = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
        const da = String(dueDate.getUTCDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
    }
    async validateCreditOrder(clientId, orderAmount) {
        const user = await this.userRepository.findOne({ where: { id: clientId } });
        if (!user) {
            throw new common_1.NotFoundException(`Cliente con id ${clientId} no encontrado`);
        }
        if (user.credit_blocked && !user.credit_override) {
            throw new common_1.BadRequestException('Crédito bloqueado por mora o cheques devueltos. Contacte a administración para regularizar su cuenta.');
        }
        const availableCredit = await this.getAvailableCredit(clientId);
        const limit = await this.getCreditLimit(clientId);
        const used = await this.getUsedCredit(clientId);
        if (orderAmount > availableCredit && !user.credit_override) {
            throw new common_1.BadRequestException(`Límite de crédito excedido: Tu límite es de $${limit.toFixed(2)}, tienes $${used.toFixed(2)} pendiente y esta orden suma $${orderAmount.toFixed(2)}. Cupo disponible: $${availableCredit.toFixed(2)}.`);
        }
    }
};
exports.CreditService = CreditService;
exports.CreditService = CreditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CreditService);
//# sourceMappingURL=credit.service.js.map