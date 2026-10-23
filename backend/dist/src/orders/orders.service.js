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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("./order.entity");
const order_item_entity_1 = require("./order-item.entity");
const user_entity_1 = require("../users/user.entity");
const product_entity_1 = require("../products/product.entity");
const mail_service_1 = require("../mail/mail.service");
let OrdersService = class OrdersService {
    orderRepository;
    orderItemRepository;
    userRepository;
    productRepository;
    dataSource;
    mailService;
    constructor(orderRepository, orderItemRepository, userRepository, productRepository, dataSource, mailService) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.dataSource = dataSource;
        this.mailService = mailService;
    }
    validateStatusTransition(currentStatus, newStatus, userRole) {
        if (userRole === 'admin')
            return;
        const validTransitions = {
            'pending': ['confirmed', 'shipped', 'cancelled'],
            'confirmed': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': [],
        };
        const current = currentStatus?.toLowerCase() || 'pending';
        const next = newStatus?.toLowerCase() || 'pending';
        if (current === next)
            return;
        const allowed = validTransitions[current];
        if (!allowed || !allowed.includes(next)) {
            throw new common_1.BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
    }
    async calculateOrderPricesAndTotal(userId, items) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['productDiscounts']
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const productIds = Array.from(new Set(items
            .map(item => Number(item.productId || item.product_id))
            .filter(id => !isNaN(id) && id > 0)));
        const products = productIds.length > 0
            ? await this.productRepository.find({ where: { id: (0, typeorm_2.In)(productIds) } })
            : [];
        const productMap = new Map(products.map(p => [p.id, p]));
        let calculatedTotal = 0;
        const validatedItems = [];
        for (const item of items) {
            const productId = Number(item.productId || item.product_id);
            const product = productMap.get(productId);
            if (!product) {
                throw new common_1.NotFoundException(`Product with ID ${productId} not found`);
            }
            const quantity = Number(item.quantity) || 0;
            if (quantity < 1) {
                throw new common_1.BadRequestException('Validation Error: Item quantity must be at least 1');
            }
            let finalPrice = Number(product.price);
            const productDiscount = user.productDiscounts?.find(d => d.product_id === product.id);
            if (productDiscount) {
                if (productDiscount.special_price !== null && productDiscount.special_price !== undefined && Number(productDiscount.special_price) > 0) {
                    finalPrice = Number(productDiscount.special_price);
                }
                else if (productDiscount.discount_percentage !== null && productDiscount.discount_percentage !== undefined && Number(productDiscount.discount_percentage) > 0) {
                    finalPrice = Number(product.price) * (1 - Number(productDiscount.discount_percentage) / 100);
                }
            }
            else if (user.general_discount !== null && user.general_discount !== undefined && Number(user.general_discount) > 0) {
                finalPrice = Number(product.price) * (1 - Number(user.general_discount) / 100);
            }
            finalPrice = Math.round((finalPrice + Number.EPSILON) * 100) / 100;
            calculatedTotal += finalPrice * quantity;
            validatedItems.push({
                product_id: product.id,
                price_at_time: finalPrice,
                quantity,
            });
        }
        return {
            validatedItems,
            total: Math.round((calculatedTotal + Number.EPSILON) * 100) / 100,
        };
    }
    async findInRange(startDate, endDate, userId) {
        console.log('findInRange called with:', { startDate, endDate, userId });
        const rawStart = startDate.split(' ')[0].split('T')[0];
        const rawEnd = endDate.split(' ')[0].split('T')[0];
        const startD = new Date(rawStart + 'T12:00:00');
        startD.setDate(startD.getDate() - 2);
        const endD = new Date(rawEnd + 'T12:00:00');
        endD.setDate(endD.getDate() + 2);
        const queryStart = startD.toISOString().split('T')[0] + 'T00:00:00.000Z';
        const queryEnd = endD.toISOString().split('T')[0] + 'T23:59:59.999Z';
        const qb = this.orderRepository.createQueryBuilder('order')
            .leftJoinAndSelect('order.items', 'items')
            .leftJoinAndSelect('items.product', 'product')
            .leftJoinAndSelect('product.category', 'category')
            .leftJoinAndSelect('order.user', 'user')
            .leftJoinAndSelect('user.profile', 'profile')
            .leftJoinAndSelect('order.delivery_user', 'delivery_user')
            .leftJoinAndSelect('delivery_user.profile', 'delivery_profile')
            .leftJoinAndSelect('order.address', 'address')
            .where('order.created_at >= :start', { start: queryStart })
            .andWhere('order.created_at <= :end', { end: queryEnd });
        if (userId) {
            qb.andWhere('order.user_id = :userId', { userId });
        }
        qb.orderBy('order.created_at', 'DESC');
        const allMatching = await qb.getMany();
        const getProductionDate = (dateVal) => {
            if (!dateVal)
                return '';
            const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
            if (isNaN(d.getTime()))
                return '';
            const nyDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            if (nyDate.getHours() >= 13) {
                nyDate.setDate(nyDate.getDate() + 1);
            }
            const yr = nyDate.getFullYear();
            const mo = String(nyDate.getMonth() + 1).padStart(2, '0');
            const da = String(nyDate.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        };
        const filtered = allMatching.filter(order => {
            const prodDate = getProductionDate(order.created_at || order.delivery_date || '');
            return prodDate >= rawStart && prodDate <= rawEnd;
        });
        console.log(`findInRange: wider query found ${allMatching.length}, filtered down to ${filtered.length} for ${rawStart} to ${rawEnd}`);
        return filtered;
    }
    async findAll() {
        return this.orderRepository.find({
            relations: ['items', 'items.product', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address'],
            order: { created_at: 'DESC' },
            take: 100
        });
    }
    async findByUser(userId) {
        return this.orderRepository.find({
            where: { user_id: userId },
            relations: ['items', 'items.product', 'address'],
            order: { created_at: 'DESC' }
        });
    }
    async findOne(id) {
        const order = await this.orderRepository.findOne({
            where: { id },
            relations: ['items', 'items.product', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address']
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        return order;
    }
    async create(userId, orderData) {
        const { items, ...rest } = orderData;
        const { deliveryDate, paymentDueDate, addressId, deliveryType, deliveryAddressText, paymentStatus, ...otherData } = rest;
        let itemsTotal = 0;
        let validatedItems = [];
        if (items && items.length > 0) {
            const result = await this.calculateOrderPricesAndTotal(userId, items);
            validatedItems = result.validatedItems;
            itemsTotal = result.total;
        }
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['orders', 'profile']
        });
        const appliedDeliveryType = deliveryType || rest.delivery_type || 'saved';
        const appliedDeliveryDate = deliveryDate || rest.delivery_date;
        const appliedPaymentDueDate = paymentDueDate || rest.payment_due_date;
        const appliedAddressId = addressId || rest.address_id || null;
        const appliedDeliveryAddressText = deliveryAddressText || rest.delivery_address_text || null;
        const appliedPaymentStatus = paymentStatus || rest.payment_status || 'pending';
        const deliveryFee = appliedDeliveryType === 'pickup' ? 0 : Number(user?.delivery_fee || 0);
        const finalTotal = Math.round((itemsTotal + deliveryFee + Number.EPSILON) * 100) / 100;
        let shouldSendCreditAlert = false;
        let isOverdraftAlert = false;
        let prospectiveCreditTotal = 0;
        let clientCreditLimit = 0;
        if (user?.account_type === 'credit') {
            const unpaidOrders = (user.orders || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado');
            const usedCredit = unpaidOrders.reduce((acc, o) => {
                const netOrderDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
                return acc + netOrderDebt;
            }, 0);
            clientCreditLimit = Number(user.credit_limit || 0);
            prospectiveCreditTotal = Math.round((usedCredit + finalTotal + Number.EPSILON) * 100) / 100;
            const isOverride = Boolean(user.credit_override);
            if (prospectiveCreditTotal > clientCreditLimit && !isOverride) {
                throw new common_1.BadRequestException(`Límite de crédito excedido: Tu límite es de $${clientCreditLimit.toFixed(2)}, tienes $${usedCredit.toFixed(2)} pendiente y esta orden suma $${finalTotal.toFixed(2)}. Contacta a la administración para una autorización.`);
            }
            if (prospectiveCreditTotal > clientCreditLimit && isOverride) {
                shouldSendCreditAlert = true;
                isOverdraftAlert = true;
            }
            else if (prospectiveCreditTotal >= clientCreditLimit * 0.8 && prospectiveCreditTotal <= clientCreditLimit) {
                shouldSendCreditAlert = true;
                isOverdraftAlert = false;
            }
        }
        const savedOrderId = await this.dataSource.transaction(async (manager) => {
            const orderToCreate = manager.create(order_entity_1.Order, {
                ...otherData,
                delivery_date: appliedDeliveryDate,
                payment_due_date: appliedPaymentDueDate,
                address_id: appliedAddressId,
                delivery_type: appliedDeliveryType,
                delivery_address_text: appliedDeliveryAddressText,
                user_id: userId,
                total: finalTotal,
                delivery_fee_charged: deliveryFee,
                payment_status: appliedPaymentStatus,
            });
            const savedResult = await manager.save(order_entity_1.Order, orderToCreate);
            const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;
            if (validatedItems.length > 0) {
                const orderItems = validatedItems.map((item) => manager.create(order_item_entity_1.OrderItem, {
                    product_id: item.product_id,
                    price_at_time: item.price_at_time,
                    quantity: item.quantity,
                    order_id: savedOrder.id,
                }));
                await manager.save(order_item_entity_1.OrderItem, orderItems);
            }
            return savedOrder.id;
        });
        const createdOrder = await this.findOne(savedOrderId);
        if (shouldSendCreditAlert && this.mailService && user?.email) {
            const clientName = user.profile?.full_name || 'Cliente B2B';
            this.mailService.sendCreditAlert(user.email, clientName, prospectiveCreditTotal, clientCreditLimit, isOverdraftAlert).catch(err => {
                console.error('[OrdersService] Error sending credit alert email:', err?.message || err);
            });
        }
        return createdOrder;
    }
    async updateStatus(id, status, userRole) {
        const order = await this.findOne(id);
        this.validateStatusTransition(order.status, status, userRole);
        order.status = status;
        return this.orderRepository.save(order);
    }
    async assignDelivery(id, deliveryUserId) {
        const order = await this.findOne(id);
        order.delivery_user_id = deliveryUserId;
        return this.orderRepository.save(order);
    }
    async update(id, updateData, userRole) {
        const order = await this.findOne(id);
        const { status, total, delivery_date, address_id, motivo, items, payment_status, paymentStatus } = updateData;
        if (status) {
            this.validateStatusTransition(order.status, status, userRole);
            order.status = status;
        }
        if (payment_status !== undefined || paymentStatus !== undefined) {
            order.payment_status = payment_status || paymentStatus;
        }
        if (updateData.stripe_payment_id !== undefined) {
            order.stripe_payment_id = updateData.stripe_payment_id;
        }
        if (updateData.refunded_amount !== undefined) {
            order.refunded_amount = Number(updateData.refunded_amount);
        }
        if (updateData.refund_reason !== undefined) {
            order.refund_reason = updateData.refund_reason;
        }
        if (motivo) {
            const originalLines = (order.items || []).map(item => `${item.quantity} Unidades de ${item.product?.name || 'Producto'}, precio unitario: ${item.price_at_time}, subtotal: ${(item.quantity * item.price_at_time).toFixed(2)}`).join('; ');
            const auditLog = `El pedido ha sido modificado por: ${motivo}, pedido original: ${originalLines}, total original: ${Number(order.total || 0).toFixed(2)}. Modificado el ${new Date().toLocaleString('es-ES')}.\n`;
            order.notes = auditLog + (order.notes || '');
        }
        if (delivery_date)
            order.delivery_date = delivery_date;
        if (address_id)
            order.address_id = address_id;
        if (items && Array.isArray(items)) {
            order.items = [];
            await this.orderItemRepository.delete({ order_id: id });
            const result = await this.calculateOrderPricesAndTotal(order.user_id, items);
            const newItems = result.validatedItems.map((item) => ({
                product_id: item.product_id,
                price_at_time: item.price_at_time,
                quantity: item.quantity,
                order_id: id,
            }));
            order.items = await this.orderItemRepository.save(newItems);
            order.total = result.total;
        }
        else if (total !== undefined) {
            order.total = total;
        }
        await this.orderRepository.save(order);
        return this.findOne(id);
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_1.OrderItem)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        mail_service_1.MailService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map