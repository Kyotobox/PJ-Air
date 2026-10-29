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
const address_entity_1 = require("../addresses/address.entity");
const zones_service_1 = require("../zones/zones.service");
const mail_service_1 = require("../mail/mail.service");
const credit_service_1 = require("../credit/credit.service");
const fee_calculator_service_1 = require("./fee-calculator.service");
const mileage_freight_service_1 = require("../logistics/mileage-freight.service");
let OrdersService = class OrdersService {
    orderRepository;
    orderItemRepository;
    userRepository;
    productRepository;
    dataSource;
    addressRepository;
    zonesService;
    mailService;
    creditService;
    feeCalculatorService;
    mileageFreightService;
    constructor(orderRepository, orderItemRepository, userRepository, productRepository, dataSource, addressRepository, zonesService, mailService, creditService, feeCalculatorService, mileageFreightService) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.dataSource = dataSource;
        this.addressRepository = addressRepository;
        this.zonesService = zonesService;
        this.mailService = mailService;
        this.creditService = creditService;
        this.feeCalculatorService = feeCalculatorService;
        this.mileageFreightService = mileageFreightService;
    }
    validateCutoffTime(deliveryDateStr, referenceDate, cutoffHour = 12) {
        if (!deliveryDateStr)
            return;
        const now = referenceDate || new Date();
        const nyDateFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const nyTimeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            hour12: false,
        });
        const dateParts = nyDateFormatter.formatToParts(now);
        const yr = dateParts.find(p => p.type === 'year')?.value || '1970';
        const mo = dateParts.find(p => p.type === 'month')?.value || '01';
        const da = dateParts.find(p => p.type === 'day')?.value || '01';
        const nyDateStr = `${yr}-${mo}-${da}`;
        const timeParts = nyTimeFormatter.formatToParts(now);
        const nyHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
        const todayNY = new Date(Date.UTC(Number(yr), Number(mo) - 1, Number(da)));
        const tomorrowNY = new Date(todayNY);
        tomorrowNY.setUTCDate(tomorrowNY.getUTCDate() + 1);
        const yrT = tomorrowNY.getUTCFullYear();
        const moT = String(tomorrowNY.getUTCMonth() + 1).padStart(2, '0');
        const daT = String(tomorrowNY.getUTCDate()).padStart(2, '0');
        const tomorrowStr = `${yrT}-${moT}-${daT}`;
        const targetDate = deliveryDateStr.split('T')[0].split(' ')[0];
        if (targetDate < nyDateStr) {
            throw new common_1.BadRequestException('La fecha de entrega no puede ser en el pasado.');
        }
        if (targetDate === nyDateStr) {
            throw new common_1.BadRequestException('No se permiten entregas para el mismo día de la orden.');
        }
        if (nyHour >= cutoffHour && targetDate <= tomorrowStr) {
            throw new common_1.BadRequestException(`Corte de producción superado (${cutoffHour}:00 PM ET). No se permiten pedidos para entrega el día siguiente (${tomorrowStr}). Próxima entrega disponible a partir de 2 días hábiles.`);
        }
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
            .andWhere('order.created_at <= :end', { end: queryEnd })
            .andWhere('order.payment_status != :pzStatus', { pzStatus: 'pending_zelle_verification' })
            .andWhere('order.status NOT IN (:...cancelled)', { cancelled: ['cancelled', 'Cancelado'] });
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
        const appliedAddressId = addressId || rest.address_id || null;
        const appliedDeliveryAddressText = deliveryAddressText || rest.delivery_address_text || null;
        let appliedPaymentStatus = paymentStatus || rest.payment_status || 'pending';
        const appliedPaymentMethod = rest.payment_method || orderData.payment_method || (user?.account_type === 'credit' ? 'credit' : 'stripe');
        const rawZelleRef = rest.zelle_reference || orderData.zelle_reference;
        const appliedZelleReference = rawZelleRef ? String(rawZelleRef).trim() : null;
        let appliedPaymentDueDate = null;
        if (appliedPaymentMethod === 'credit') {
            if (this.creditService) {
                appliedPaymentDueDate = this.creditService.calculatePaymentDueDate();
            }
            else {
                const now = new Date();
                const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                const yr = dueDate.getUTCFullYear();
                const mo = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
                const da = String(dueDate.getUTCDate()).padStart(2, '0');
                appliedPaymentDueDate = `${yr}-${mo}-${da}`;
            }
        }
        else {
            appliedPaymentDueDate = null;
        }
        this.validateCutoffTime(appliedDeliveryDate);
        const feeMethod = (appliedPaymentMethod === 'stripe' || appliedPaymentMethod === 'card')
            ? 'STRIPE_CARD'
            : (appliedPaymentMethod === 'ach' || appliedPaymentMethod === 'ach_debit')
                ? 'ACH'
                : String(appliedPaymentMethod || '').toUpperCase();
        let feeAmount = fee_calculator_service_1.FeeCalculatorService.calculateFee(itemsTotal, feeMethod);
        if (orderData.fee_amount !== undefined && orderData.fee_amount !== null) {
            feeAmount = Number(orderData.fee_amount);
        }
        const appliedFeeMethod = orderData.fee_method || feeMethod;
        let packagingFee = Math.round(itemsTotal * 0.035 * 100) / 100;
        let packagingDiscount = 0;
        if (appliedPaymentMethod === 'zelle') {
            if (!appliedZelleReference) {
                throw new common_1.BadRequestException('El número de referencia o confirmación de Zelle es obligatorio para pagos con Zelle.');
            }
            const existingZelle = await this.orderRepository.createQueryBuilder('order')
                .where('LOWER(TRIM(order.zelle_reference)) = LOWER(:ref)', { ref: appliedZelleReference })
                .andWhere('order.status NOT IN (:...cancelled)', { cancelled: ['cancelled', 'Cancelado'] })
                .getOne();
            if (existingZelle) {
                throw new common_1.BadRequestException(`El número de referencia Zelle "${appliedZelleReference}" ya ha sido registrado en otra orden activa.`);
            }
            appliedPaymentStatus = 'pending_zelle_verification';
            packagingDiscount = packagingFee;
        }
        else if (appliedPaymentMethod === 'stripe' || appliedPaymentMethod === 'card') {
            packagingDiscount = 0;
        }
        else if (appliedPaymentMethod === 'ach' || appliedPaymentMethod === 'ach_debit') {
            packagingFee = feeAmount;
            packagingDiscount = 0;
        }
        else if (appliedPaymentMethod === 'credit') {
            packagingDiscount = packagingFee;
        }
        else if (appliedPaymentMethod === 'check' || appliedPaymentMethod === 'cash') {
            packagingDiscount = packagingFee;
        }
        let deliveryFee = 0;
        if (appliedDeliveryType === 'pickup') {
            deliveryFee = 0;
        }
        else if (user?.delivery_fee !== null && user?.delivery_fee !== undefined && Number(user.delivery_fee) > 0) {
            deliveryFee = Number(user.delivery_fee);
        }
        else if (this.mileageFreightService && (orderData.miles !== undefined || orderData.dest_lat !== undefined)) {
            const miles = orderData.miles !== undefined
                ? Number(orderData.miles)
                : this.mileageFreightService.calculateDistanceMiles(Number(orderData.dest_lat), Number(orderData.dest_lng));
            const serviceType = orderData.freight_service_type || 'shared';
            const quote = this.mileageFreightService.calculateFreight(miles, serviceType);
            deliveryFee = quote.cost;
        }
        else if (this.zonesService) {
            let zip = orderData.zip_code || orderData.zip || rest.zip_code || rest.zip || null;
            if (!zip && appliedAddressId && this.addressRepository) {
                try {
                    const addr = await this.addressRepository.findOne({ where: { id: appliedAddressId } });
                    const match = addr?.address?.match(/\b\d{5}\b/);
                    if (match)
                        zip = match[0];
                }
                catch (_) { }
            }
            if (!zip && appliedDeliveryAddressText) {
                const match = appliedDeliveryAddressText.match(/\b\d{5}\b/);
                if (match)
                    zip = match[0];
            }
            if (zip) {
                const zone = await this.zonesService.resolveZip(zip);
                if (zone) {
                    if (zone.min_free_delivery_amount !== null &&
                        zone.min_free_delivery_amount !== undefined &&
                        Number(zone.min_free_delivery_amount) > 0 &&
                        itemsTotal >= Number(zone.min_free_delivery_amount)) {
                        deliveryFee = 0;
                    }
                    else {
                        deliveryFee = Number(zone.base_fee);
                    }
                }
                else {
                    deliveryFee = 15.00;
                }
            }
            else {
                deliveryFee = 15.00;
            }
        }
        else {
            deliveryFee = Number(user?.delivery_fee || 0);
        }
        const finalTotal = Math.round((itemsTotal + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100;
        let shouldSendCreditAlert = false;
        let isOverdraftAlert = false;
        let prospectiveCreditTotal = 0;
        let clientCreditLimit = 0;
        if (user?.account_type === 'credit' || appliedPaymentMethod === 'credit') {
            let usedCredit = 0;
            if (this.creditService) {
                clientCreditLimit = await this.creditService.getCreditLimit(userId);
                usedCredit = await this.creditService.getUsedCredit(userId);
            }
            else {
                const unpaidOrders = (user?.orders || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado');
                usedCredit = unpaidOrders.reduce((acc, o) => {
                    const netOrderDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
                    return acc + netOrderDebt;
                }, 0);
                clientCreditLimit = Number(user?.credit_limit || 0);
            }
            prospectiveCreditTotal = Math.round((usedCredit + finalTotal + Number.EPSILON) * 100) / 100;
            const isOverride = Boolean(user?.credit_override);
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
        const isUserTaxExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt || orderData.tax_exempt);
        const taxId = user?.profile?.tax_id || user?.tax_id || orderData.tax_id || null;
        let appliedTaxAmount = 0.00;
        let appliedTaxRate = 0.00;
        let appliedTaxExempt = false;
        let appliedTaxLegend = null;
        if (isUserTaxExempt) {
            appliedTaxAmount = 0.00;
            appliedTaxRate = 0.00;
            appliedTaxExempt = true;
            appliedTaxLegend = `Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business. NY Resale / Tax ID: ${taxId || 'N/A'}`;
        }
        else {
            appliedTaxAmount = Number(orderData.tax_amount || 0);
            appliedTaxRate = Number(orderData.tax_rate || 0);
            appliedTaxExempt = false;
            appliedTaxLegend = null;
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
                payment_method: appliedPaymentMethod,
                zelle_reference: appliedZelleReference,
                packaging_fee: packagingFee,
                packaging_discount: packagingDiscount,
                fee_amount: feeAmount,
                fee_method: appliedFeeMethod,
                delivery_fee_charged: deliveryFee,
                payment_status: appliedPaymentStatus,
                tax_amount: appliedTaxAmount,
                tax_rate: appliedTaxRate,
                tax_exempt: appliedTaxExempt,
                tax_legend: appliedTaxLegend,
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
        if (this.mailService && typeof this.mailService.sendOrderReceipt === 'function' && user?.email) {
            this.mailService.sendOrderReceipt(createdOrder, user.email).catch(err => {
                console.error('[OrdersService] Error sending order receipt email:', err?.message || err);
            });
        }
        if (this.mailService && typeof this.mailService.sendAdminNewOrderAlert === 'function') {
            const clientName = user?.profile?.full_name || 'Cliente Mayorista';
            this.mailService.sendAdminNewOrderAlert(createdOrder, user?.email, clientName).catch(err => {
                console.error('[OrdersService] Error sending admin new order alert email:', err?.message || err);
            });
        }
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
        if (updateData.fee_amount !== undefined) {
            order.fee_amount = Number(updateData.fee_amount);
        }
        if (updateData.fee_method !== undefined) {
            order.fee_method = updateData.fee_method;
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
    async approveZellePayment(orderId) {
        const order = await this.findOne(orderId);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        order.payment_status = 'paid';
        const saved = await this.orderRepository.save(order);
        if (this.mailService && typeof this.mailService.sendOrderReceipt === 'function') {
            const user = await this.userRepository.findOne({ where: { id: order.user_id } });
            if (user?.email) {
                this.mailService.sendOrderReceipt(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending zelle approved receipt email:', err?.message || err);
                });
            }
        }
        return saved;
    }
    async rejectZellePayment(orderId, reason) {
        const order = await this.findOne(orderId);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        order.payment_status = 'unpaid';
        order.status = 'Cancelado';
        if (reason) {
            order.notes = `[Rechazo Zelle]: ${reason}\n${order.notes || ''}`;
        }
        return this.orderRepository.save(order);
    }
    async settleBatch(userId, userRole, dto) {
        if (!dto || !Array.isArray(dto.order_ids) || dto.order_ids.length === 0) {
            throw new common_1.BadRequestException('Debe proporcionar una lista no vacía de order_ids');
        }
        if (!dto.payment_method || typeof dto.payment_method !== 'string' || !dto.payment_method.trim()) {
            throw new common_1.BadRequestException('El método de pago es obligatorio para la liquidación');
        }
        const cleanMethod = dto.payment_method.trim().toLowerCase();
        const orders = await this.orderRepository.find({
            where: { id: (0, typeorm_2.In)(dto.order_ids) },
            relations: ['items'],
        });
        if (orders.length !== dto.order_ids.length) {
            const foundIds = orders.map((o) => o.id);
            const missing = dto.order_ids.filter((id) => !foundIds.includes(id));
            throw new common_1.NotFoundException(`No se encontraron las órdenes: ${missing.join(', ')}`);
        }
        for (const order of orders) {
            if (userRole !== 'admin' && order.user_id !== userId) {
                throw new common_1.ForbiddenException(`No tiene autorización para liquidar la orden #${order.id}`);
            }
            if (order.status === 'cancelled' || order.status === 'Cancelado') {
                throw new common_1.BadRequestException(`La orden #${order.id.slice(0, 8)} está cancelada y no puede ser liquidada`);
            }
            if (order.payment_status === 'paid') {
                throw new common_1.BadRequestException(`La orden #${order.id.slice(0, 8)} ya se encuentra pagada`);
            }
        }
        const feeCalc = this.feeCalculatorService || new fee_calculator_service_1.FeeCalculatorService();
        const orderNetDebts = orders.map((o) => Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0)));
        const feeResult = feeCalc.calculateBatchFee(orderNetDebts, cleanMethod);
        const totalBase = feeResult.baseAmount;
        const totalFee = feeResult.feeAmount;
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            const netDebt = orderNetDebts[i];
            const propFee = totalBase > 0 ? Math.round(((netDebt / totalBase) * totalFee + Number.EPSILON) * 100) / 100 : 0;
            order.payment_status = 'paid';
            order.fee_amount = propFee;
            order.fee_method = cleanMethod;
            if (dto.payment_reference) {
                order.zelle_reference = (order.zelle_reference ? order.zelle_reference + ' | ' : '') + dto.payment_reference;
            }
            await this.orderRepository.save(order);
        }
        let newAvailableCredit = 0;
        let newUsedCredit = 0;
        if (this.creditService) {
            newAvailableCredit = await this.creditService.getAvailableCredit(userId);
            newUsedCredit = await this.creditService.getUsedCredit(userId);
        }
        return {
            success: true,
            settled_count: orders.length,
            order_ids: dto.order_ids,
            base_total: totalBase,
            fee_amount: totalFee,
            fee_percentage: feeResult.feePercentage,
            total_paid: feeResult.totalWithFee,
            payment_method: cleanMethod,
            available_credit: newAvailableCredit,
            used_credit: newUsedCredit,
        };
    }
    async getFrequentProducts(userId) {
        if (!userId) {
            throw new common_1.BadRequestException('UserId es obligatorio');
        }
        const orders = await this.orderRepository.find({
            where: { user_id: userId },
            relations: ['items', 'items.product'],
            order: { created_at: 'DESC' },
        });
        const validOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'Cancelado');
        const productCountMap = new Map();
        for (const order of validOrders) {
            for (const item of (order.items || [])) {
                if (!item.product)
                    continue;
                const pId = item.product.id;
                const existing = productCountMap.get(pId);
                if (existing) {
                    existing.count += 1;
                    existing.totalQuantity += Number(item.quantity) || 1;
                    if (new Date(order.created_at) > existing.lastOrdered) {
                        existing.lastOrdered = new Date(order.created_at);
                    }
                }
                else {
                    productCountMap.set(pId, {
                        product: item.product,
                        count: 1,
                        totalQuantity: Number(item.quantity) || 1,
                        lastOrdered: new Date(order.created_at),
                    });
                }
            }
        }
        let results = Array.from(productCountMap.values())
            .sort((a, b) => b.totalQuantity - a.totalQuantity || b.count - a.count)
            .slice(0, 10)
            .map((entry) => ({
            ...entry.product,
            order_frequency: entry.count,
            total_purchased_units: entry.totalQuantity,
            last_ordered: entry.lastOrdered,
        }));
        if (results.length === 0) {
            const topCatalog = await this.productRepository.find({
                where: { is_deleted: false },
                take: 8,
            });
            results = topCatalog.map((p) => ({
                ...p,
                order_frequency: 0,
                total_purchased_units: 0,
                last_ordered: null,
            }));
        }
        return results;
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
    __param(5, (0, typeorm_1.InjectRepository)(address_entity_1.Address)),
    __param(6, (0, common_1.Optional)()),
    __param(7, (0, common_1.Optional)()),
    __param(8, (0, common_1.Optional)()),
    __param(9, (0, common_1.Optional)()),
    __param(10, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        typeorm_2.Repository,
        zones_service_1.ZonesService,
        mail_service_1.MailService,
        credit_service_1.CreditService,
        fee_calculator_service_1.FeeCalculatorService,
        mileage_freight_service_1.MileageFreightService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map