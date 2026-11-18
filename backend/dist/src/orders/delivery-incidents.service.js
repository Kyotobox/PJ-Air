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
var DeliveryIncidentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryIncidentsService = exports.CreateDeliveryIncidentDto = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const delivery_incident_entity_1 = require("./entities/delivery-incident.entity");
const order_entity_1 = require("./order.entity");
const user_entity_1 = require("../users/user.entity");
const mail_service_1 = require("../mail/mail.service");
const create_delivery_incident_dto_1 = require("./dto/create-delivery-incident.dto");
Object.defineProperty(exports, "CreateDeliveryIncidentDto", { enumerable: true, get: function () { return create_delivery_incident_dto_1.CreateDeliveryIncidentDto; } });
let DeliveryIncidentsService = DeliveryIncidentsService_1 = class DeliveryIncidentsService {
    incidentRepository;
    orderRepository;
    userRepository;
    mailService;
    logger = new common_1.Logger(DeliveryIncidentsService_1.name);
    constructor(incidentRepository, orderRepository, userRepository, mailService) {
        this.incidentRepository = incidentRepository;
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
    }
    async generateVoucherCode(year = new Date().getFullYear()) {
        const prefix = `SC-${year}-`;
        let latestIncident = null;
        if (typeof this.incidentRepository.find === 'function') {
            const results = await this.incidentRepository.find({
                where: { voucher_code: (0, typeorm_2.Like)(`${prefix}%`) },
                order: { voucher_code: 'DESC' },
                take: 1,
            });
            latestIncident = results && results.length > 0 ? results[0] : null;
        }
        if (!latestIncident && typeof this.incidentRepository.findOne === 'function') {
            latestIncident = await this.incidentRepository.findOne({
                where: { voucher_code: (0, typeorm_2.Like)(`${prefix}%`) },
                order: { voucher_code: 'DESC' },
            });
        }
        let nextNumber = 1;
        if (latestIncident && latestIncident.voucher_code) {
            const match = latestIncident.voucher_code.match(/^SC-\d{4}-(\d+)/);
            if (match && match[1]) {
                const parsed = parseInt(match[1], 10);
                if (!isNaN(parsed)) {
                    nextNumber = parsed + 1;
                }
            }
        }
        const paddedNumber = String(nextNumber).padStart(4, '0');
        return `${prefix}${paddedNumber}`;
    }
    async createIncident(dto, userContext) {
        const orderId = dto.order_id || dto.orderId;
        if (!orderId) {
            throw new common_1.BadRequestException('El ID de la orden es mandatorio para registrar una incidencia');
        }
        const order = await this.orderRepository.findOne({
            where: { id: orderId },
            relations: ['items'],
        });
        if (!order) {
            throw new common_1.NotFoundException(`Orden con id ${orderId} no encontrada`);
        }
        if (userContext && userContext.role !== 'admin' && order.user_id !== userContext.id) {
            throw new common_1.ForbiddenException('No autorizado para reportar incidencias sobre esta orden');
        }
        const productId = Number(dto.product_id ?? dto.productId);
        if (isNaN(productId)) {
            throw new common_1.BadRequestException('El ID del producto es mandatorio y debe ser numérico');
        }
        const orderItem = order.items?.find((item) => Number(item.product_id) === productId);
        if (!orderItem) {
            throw new common_1.BadRequestException(`El producto con id ${productId} no pertenece a la orden ${orderId}`);
        }
        const quantity = Number(dto.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            throw new common_1.BadRequestException('La cantidad afectada debe ser mayor a 0');
        }
        let amount = dto.amount !== undefined && dto.amount !== null ? Number(dto.amount) : undefined;
        if (amount === undefined || isNaN(amount)) {
            const itemPrice = Number(orderItem.price_at_time) || 0;
            amount = Math.round((quantity * itemPrice + Number.EPSILON) * 100) / 100;
        }
        else {
            amount = Math.round((amount + Number.EPSILON) * 100) / 100;
        }
        const voucherCode = dto.voucher_code || (await this.generateVoucherCode());
        const userId = dto.user_id || dto.userId || order.user_id;
        const incident = this.incidentRepository.create({
            order_id: order.id,
            user_id: userId,
            product_id: productId,
            quantity,
            reason_category: dto.reason_category,
            description: dto.description || null,
            photo_url: dto.photo_url || null,
            amount,
            voucher_code: voucherCode,
            status: dto.status || 'pending_review',
            reviewed_by: dto.reviewed_by || null,
        });
        return await this.incidentRepository.save(incident);
    }
    async approveIncident(incidentId, adminId) {
        const incident = await this.incidentRepository.findOne({
            where: { id: incidentId },
        });
        if (!incident) {
            throw new common_1.NotFoundException(`Incidencia con id ${incidentId} no encontrada`);
        }
        if (incident.status === 'approved') {
            return incident;
        }
        const user = await this.userRepository.findOne({
            where: { id: incident.user_id },
        });
        if (!user) {
            throw new common_1.NotFoundException(`Usuario con id ${incident.user_id} no encontrado`);
        }
        const currentBalance = Number(user.credit_balance) || 0;
        const increment = Number(incident.amount) || 0;
        const newBalance = Math.round((currentBalance + increment + Number.EPSILON) * 100) / 100;
        user.credit_balance = newBalance;
        await this.userRepository.save(user);
        incident.status = 'approved';
        incident.reviewed_by = adminId;
        incident.updated_at = new Date();
        const savedIncident = await this.incidentRepository.save(incident);
        if (this.mailService && user.email) {
            this.dispatchStoreCreditNotification(user, savedIncident, newBalance).catch((err) => {
                this.logger.error(`Error en despacho asíncrono de Store Credit Card para incidencia ${savedIncident.id}: ${err.message}`);
            });
        }
        return savedIncident;
    }
    async dispatchStoreCreditNotification(user, incident, newBalance) {
        if (!this.mailService || !user.email)
            return;
        const reasonLabels = {
            missing_kitchen: 'Faltante en entrega',
            transit_damage: 'Producto quebrado / aplastado',
            quality_defect: 'Problema de calidad / horneado',
            wrong_item: 'Producto incorrecto',
        };
        const reasonLabel = reasonLabels[incident.reason_category] ||
            incident.reason_category ||
            'Incidencia de entrega';
        let productName = `Producto #${incident.product_id}`;
        try {
            const order = await this.orderRepository.findOne({
                where: { id: incident.order_id },
                relations: ['items', 'items.product'],
            });
            const matchedItem = order?.items?.find((i) => Number(i.product_id) === Number(incident.product_id));
            if (matchedItem?.product?.name) {
                productName = matchedItem.product.name;
            }
            else if (matchedItem?.product_name) {
                productName = matchedItem.product_name;
            }
            else if (matchedItem?.name) {
                productName = matchedItem.name;
            }
        }
        catch (err) {
            this.logger.warn(`No se pudo resolver el nombre del producto para la orden ${incident.order_id}: ${err.message}`);
        }
        const clientName = user.profile?.company_name ||
            user.profile?.full_name ||
            user.legal_business_name ||
            user.dba ||
            user.name ||
            'Estimado Cliente';
        await this.mailService.sendStoreCreditCard(user.email, {
            clientName,
            voucherCode: incident.voucher_code,
            amount: Number(incident.amount),
            newTotalBalance: newBalance,
            productName,
            quantity: Number(incident.quantity),
            reasonLabel,
            photoUrl: incident.photo_url || undefined,
        });
    }
    async findByOrder(orderId, userContext) {
        if (userContext && userContext.role !== 'admin') {
            const order = await this.orderRepository.findOne({ where: { id: orderId } });
            if (!order) {
                throw new common_1.NotFoundException(`Orden con id ${orderId} no encontrada`);
            }
            if (order.user_id !== userContext.id) {
                throw new common_1.ForbiddenException('No autorizado para ver incidencias de esta orden');
            }
        }
        return await this.incidentRepository.find({
            where: { order_id: orderId },
            order: { created_at: 'DESC' },
        });
    }
    async findByUser(userId) {
        return await this.incidentRepository.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
        });
    }
    async findById(id) {
        const incident = await this.incidentRepository.findOne({ where: { id } });
        if (!incident) {
            throw new common_1.NotFoundException(`Incidencia con id ${id} no encontrada`);
        }
        return incident;
    }
};
exports.DeliveryIncidentsService = DeliveryIncidentsService;
exports.DeliveryIncidentsService = DeliveryIncidentsService = DeliveryIncidentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(delivery_incident_entity_1.DeliveryIncident)),
    __param(1, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        mail_service_1.MailService])
], DeliveryIncidentsService);
//# sourceMappingURL=delivery-incidents.service.js.map