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
exports.CheckPaymentsService = exports.RegisterCheckDto = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const check_payment_entity_1 = require("./check-payment.entity");
const order_entity_1 = require("../orders/order.entity");
const user_entity_1 = require("../users/user.entity");
const date_utils_1 = require("../common/utils/date.utils");
class RegisterCheckDto {
    order_id;
    check_number;
    bank_name;
    amount;
    received_date;
    notes;
    user_id;
    status;
}
exports.RegisterCheckDto = RegisterCheckDto;
let CheckPaymentsService = class CheckPaymentsService {
    checkPaymentRepository;
    orderRepository;
    userRepository;
    constructor(checkPaymentRepository, orderRepository, userRepository) {
        this.checkPaymentRepository = checkPaymentRepository;
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
    }
    async registerCheck(dto) {
        if (!dto.order_id || !dto.check_number || !dto.bank_name || dto.amount === undefined || !dto.received_date) {
            throw new common_1.BadRequestException('Faltan campos obligatorios para registrar el cheque (order_id, check_number, bank_name, amount, received_date)');
        }
        const numAmount = Number(dto.amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new common_1.BadRequestException('El monto del cheque debe ser un número mayor a cero');
        }
        const order = await this.orderRepository.findOne({
            where: { id: dto.order_id },
            relations: ['user'],
        });
        if (!order) {
            throw new common_1.NotFoundException(`Orden con id ${dto.order_id} no encontrada`);
        }
        const clearance_deadline = (0, date_utils_1.addBusinessDays)(dto.received_date, 3);
        const userId = dto.user_id || order.user_id;
        const checkPayment = this.checkPaymentRepository.create({
            order_id: order.id,
            user_id: userId,
            check_number: dto.check_number.trim(),
            bank_name: dto.bank_name.trim(),
            amount: numAmount,
            received_date: dto.received_date,
            clearance_deadline,
            status: dto.status || 'IN_HAND',
            notes: dto.notes || '',
        });
        return await this.checkPaymentRepository.save(checkPayment);
    }
    async markAsDeposited(checkPaymentId, notes) {
        const check = await this.checkPaymentRepository.findOne({
            where: { id: checkPaymentId },
        });
        if (!check) {
            throw new common_1.NotFoundException(`Cheque con id ${checkPaymentId} no encontrado`);
        }
        check.status = 'DEPOSITED';
        if (notes) {
            check.notes = check.notes ? `${check.notes} | ${notes}` : notes;
        }
        const savedCheck = await this.checkPaymentRepository.save(check);
        const order = await this.orderRepository.findOne({
            where: { id: check.order_id },
        });
        if (order) {
            order.payment_status = 'paid';
            await this.orderRepository.save(order);
        }
        return savedCheck;
    }
    async markAsBounced(checkPaymentId, bounceReason) {
        const check = await this.checkPaymentRepository.findOne({
            where: { id: checkPaymentId },
        });
        if (!check) {
            throw new common_1.NotFoundException(`Cheque con id ${checkPaymentId} no encontrado`);
        }
        check.status = 'BOUNCED';
        const reasonText = bounceReason || 'Cheque rebotado por entidad bancaria';
        check.notes = check.notes
            ? `${check.notes} | [REBOTE] ${reasonText}`
            : `[REBOTE] ${reasonText}`;
        const savedCheck = await this.checkPaymentRepository.save(check);
        const order = await this.orderRepository.findOne({
            where: { id: check.order_id },
        });
        if (order) {
            order.payment_status = 'pending';
            const bounceAlert = `[ALERTA CONTABLE] Cheque #${check.check_number} rebotado. Pago revertido a deuda activa.`;
            order.notes = order.notes ? `${order.notes} | ${bounceAlert}` : bounceAlert;
            await this.orderRepository.save(order);
        }
        const user = await this.userRepository.findOne({
            where: { id: check.user_id },
        });
        if (user) {
            user.credit_override = false;
            user.credit_blocked = true;
            await this.userRepository.save(user);
        }
        return savedCheck;
    }
    async findAll(filter) {
        const where = {};
        if (filter?.status) {
            where.status = filter.status;
        }
        if (filter?.orderId) {
            where.order_id = filter.orderId;
        }
        if (filter?.userId) {
            where.user_id = filter.userId;
        }
        return await this.checkPaymentRepository.find({
            where,
            order: { created_at: 'DESC' },
            relations: ['order', 'user'],
        });
    }
    async findById(id) {
        const check = await this.checkPaymentRepository.findOne({
            where: { id },
            relations: ['order', 'user'],
        });
        if (!check) {
            throw new common_1.NotFoundException(`Cheque con id ${id} no encontrado`);
        }
        return check;
    }
    async findByOrder(orderId) {
        return await this.checkPaymentRepository.find({
            where: { order_id: orderId },
            order: { created_at: 'DESC' },
        });
    }
    async getReconciliationGrouped() {
        const all = await this.checkPaymentRepository.find({
            order: { created_at: 'DESC' },
            relations: ['order', 'user'],
        });
        const inHand = all.filter((c) => c.status === 'IN_HAND' || c.status === 'PENDING_RECEIPT');
        const deposited = all.filter((c) => c.status === 'DEPOSITED');
        const bounced = all.filter((c) => c.status === 'BOUNCED');
        return { inHand, deposited, bounced };
    }
};
exports.CheckPaymentsService = CheckPaymentsService;
exports.CheckPaymentsService = CheckPaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(check_payment_entity_1.CheckPayment)),
    __param(1, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CheckPaymentsService);
//# sourceMappingURL=check-payments.service.js.map