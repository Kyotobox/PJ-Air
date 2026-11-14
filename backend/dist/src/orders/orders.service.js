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
const payments_service_1 = require("../payments/payments.service");
const check_payments_service_1 = require("../payments/check-payments.service");
const address_validation_service_1 = require("../addresses/address-validation.service");
const system_configs_service_1 = require("../system-configs/system-configs.service");
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
    paymentsService;
    checkPaymentsService;
    addressValidationService;
    systemConfigsService;
    constructor(orderRepository, orderItemRepository, userRepository, productRepository, dataSource, addressRepository, zonesService, mailService, creditService, feeCalculatorService, mileageFreightService, paymentsService, checkPaymentsService, addressValidationService, systemConfigsService) {
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
        this.paymentsService = paymentsService;
        this.checkPaymentsService = checkPaymentsService;
        this.addressValidationService = addressValidationService;
        this.systemConfigsService = systemConfigsService;
    }
    calculateMinDeliveryDate(referenceDate, cutoffHour = 12, scheduleConfig) {
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
        const timeParts = nyTimeFormatter.formatToParts(now);
        let nyHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
        if (nyHour === 24)
            nyHour = 0;
        const config = scheduleConfig || this.systemConfigsService?.getCachedDeliverySchedule?.();
        const effectiveCutoff = config?.cutoffHour ?? cutoffHour;
        const pastCutoff = nyHour >= effectiveCutoff;
        const daysToAdd = pastCutoff ? 3 : 2;
        const minDateNY = new Date(Date.UTC(Number(yr), Number(mo) - 1, Number(da)));
        minDateNY.setUTCDate(minDateNY.getUTCDate() + daysToAdd);
        if (config) {
            const workingDays = Array.isArray(config.workingDays)
                ? config.workingDays
                : [0, 1, 3, 4, 5, 6];
            const holidays = Array.isArray(config.holidays)
                ? config.holidays
                : [];
            const exceptionalDays = Array.isArray(config.exceptionalDays)
                ? config.exceptionalDays
                : [];
            let attempts = 0;
            while (attempts++ < 365) {
                const cYr = minDateNY.getUTCFullYear();
                const cMo = String(minDateNY.getUTCMonth() + 1).padStart(2, '0');
                const cDa = String(minDateNY.getUTCDate()).padStart(2, '0');
                const candidateDateStr = `${cYr}-${cMo}-${cDa}`;
                const dayOfWeek = minDateNY.getUTCDay();
                if (exceptionalDays.some(e => e.date === candidateDateStr)) {
                    break;
                }
                if (holidays.some(h => h.date === candidateDateStr)) {
                    minDateNY.setUTCDate(minDateNY.getUTCDate() + 1);
                    continue;
                }
                if (!workingDays.includes(dayOfWeek)) {
                    minDateNY.setUTCDate(minDateNY.getUTCDate() + 1);
                    continue;
                }
                break;
            }
        }
        else {
            if (minDateNY.getUTCDay() === 2) {
                minDateNY.setUTCDate(minDateNY.getUTCDate() + 1);
            }
        }
        const yrMin = minDateNY.getUTCFullYear();
        const moMin = String(minDateNY.getUTCMonth() + 1).padStart(2, '0');
        const daMin = String(minDateNY.getUTCDate()).padStart(2, '0');
        return `${yrMin}-${moMin}-${daMin}`;
    }
    validateCutoffTime(deliveryDateStr, referenceDate, cutoffHour = 12, scheduleConfig) {
        if (!deliveryDateStr)
            return;
        const targetDate = deliveryDateStr.split('T')[0].split(' ')[0];
        const [tYr, tMo, tDa] = targetDate.split('-').map(Number);
        const targetDateObj = new Date(Date.UTC(tYr, tMo - 1, tDa));
        const config = scheduleConfig || this.systemConfigsService?.getCachedDeliverySchedule?.();
        if (config) {
            const workingDays = Array.isArray(config.workingDays)
                ? config.workingDays
                : [0, 1, 3, 4, 5, 6];
            const holidays = Array.isArray(config.holidays)
                ? config.holidays
                : [];
            const exceptionalDays = Array.isArray(config.exceptionalDays)
                ? config.exceptionalDays
                : [];
            const isExceptional = exceptionalDays.some(e => e.date === targetDate);
            if (!isExceptional) {
                const holiday = holidays.find(h => h.date === targetDate);
                if (holiday) {
                    throw new common_1.BadRequestException(`Panadería Jhoanes no realiza entregas el ${targetDate}: ${holiday.name}.`);
                }
                const dayOfWeek = targetDateObj.getUTCDay();
                if (!workingDays.includes(dayOfWeek)) {
                    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                    const dayName = dayNames[dayOfWeek] || 'este día';
                    throw new common_1.BadRequestException(`Panadería Jhoanes no realiza entregas los días ${dayName}. Por favor selecciona un día operativo.`);
                }
            }
        }
        else {
            if (targetDateObj.getUTCDay() === 2) {
                throw new common_1.BadRequestException('Panadería Jhoanes no realiza entregas los martes. Por favor selecciona a partir del miércoles.');
            }
        }
        const minDeliveryDateStr = this.calculateMinDeliveryDate(referenceDate, cutoffHour, config);
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
        let nyHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
        if (nyHour === 24)
            nyHour = 0;
        const effectiveCutoff = config?.cutoffHour ?? cutoffHour;
        const pastCutoff = nyHour >= effectiveCutoff;
        if (targetDate < minDeliveryDateStr) {
            if (targetDate < nyDateStr) {
                throw new common_1.BadRequestException('La fecha de entrega no puede ser en el pasado.');
            }
            if (targetDate === nyDateStr) {
                throw new common_1.BadRequestException('No se permiten entregas para el mismo día de la orden. Lead time mínimo de 48 horas requerido.');
            }
            throw new common_1.BadRequestException(pastCutoff
                ? `Corte de producción superado (${effectiveCutoff}:00 PM ET). Para pedidos después de las 12 PM, la fecha de entrega más temprana es ${minDeliveryDateStr} (T+3).`
                : `Lead time de producción de 48h requerido. La fecha de entrega más temprana es ${minDeliveryDateStr} (T+2).`);
        }
    }
    normalizeStatus(status) {
        if (!status)
            return 'pending';
        const s = status.toLowerCase().trim();
        switch (s) {
            case 'pedido enviado':
            case 'shipped':
            case 'en delivery':
            case 'enviado':
            case 'camino':
            case 'en camino':
                return 'shipped';
            case 'pedido recibido':
            case 'delivered':
            case 'entregado':
            case 'recibido':
            case 'finalizado':
                return 'delivered';
            case 'pending':
            case 'pendiente':
            case 'pedido':
                return 'pending';
            case 'confirmed':
            case 'confirmado':
            case 'en producción':
            case 'en produccion':
            case 'processing':
                return 'confirmed';
            case 'cancelled':
            case 'cancelado':
                return 'cancelled';
            default:
                return s;
        }
    }
    validateStatusTransition(currentStatus, newStatus, userRole) {
        const current = this.normalizeStatus(currentStatus);
        const next = this.normalizeStatus(newStatus);
        if (userRole === 'admin')
            return next;
        const validTransitions = {
            'pending': ['confirmed', 'shipped', 'cancelled'],
            'confirmed': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': [],
        };
        if (current === next)
            return next;
        const allowed = validTransitions[current];
        if (!allowed || !allowed.includes(next)) {
            throw new common_1.BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
        return next;
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
            const rawQuantity = item.quantity;
            const quantity = Number(rawQuantity);
            if (isNaN(quantity) || !Number.isInteger(quantity) || quantity < 1) {
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
            else if (user.general_discount !== null && user.general_discount !== undefined && Number(user.general_discount) > 0 && user.productDiscounts && user.productDiscounts.length > 0) {
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
        const rawStart = (startDate || '').split(' ')[0].split('T')[0] || new Date().toISOString().split('T')[0];
        const rawEnd = (endDate || startDate || '').split(' ')[0].split('T')[0] || rawStart;
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
            .where('((order.delivery_date >= :rawStart AND (order.delivery_date <= :rawEnd OR order.delivery_date <= :rawEndMax)) OR ((order.delivery_date IS NULL OR order.delivery_date = :emptyStr) AND order.created_at >= :start AND order.created_at <= :end))', {
            rawStart,
            rawEnd,
            rawEndMax: rawEnd + 'T23:59:59.999Z',
            emptyStr: '',
            start: queryStart,
            end: queryEnd,
        })
            .andWhere('order.payment_status NOT IN (:...pendingVerifications)', {
            pendingVerifications: ['pending_zelle_verification', 'pending_check_verification'],
        })
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
            let effectiveDate = '';
            if (order.delivery_date) {
                effectiveDate = order.delivery_date.includes('T')
                    ? order.delivery_date.split('T')[0]
                    : order.delivery_date.split(' ')[0];
            }
            else {
                effectiveDate = getProductionDate(order.created_at);
            }
            return effectiveDate >= rawStart && effectiveDate <= rawEnd;
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
    async getNextInvoiceNumber(manager) {
        const repo = (manager && typeof manager.getRepository === 'function')
            ? manager.getRepository(order_entity_1.Order)
            : this.orderRepository;
        const qb = repo.createQueryBuilder('order')
            .where('order.invoice_number LIKE :prefix', { prefix: 'INV-%' });
        if (typeof qb.orderBy === 'function') {
            qb.orderBy('order.invoice_number', 'DESC');
        }
        let candidateOrders = [];
        if (typeof qb.getMany === 'function') {
            const many = await qb.getMany();
            if (Array.isArray(many) && many.length > 0) {
                candidateOrders = many;
            }
        }
        if (candidateOrders.length === 0 && typeof qb.getOne === 'function') {
            const single = await qb.getOne();
            if (single) {
                candidateOrders = [single];
            }
        }
        if (!candidateOrders || candidateOrders.length === 0) {
            return 'INV-1600';
        }
        let maxNum = null;
        for (const ord of candidateOrders) {
            if (ord && ord.invoice_number) {
                const match = String(ord.invoice_number).trim().match(/^INV-(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num)) {
                        if (maxNum === null || num > maxNum) {
                            maxNum = num;
                        }
                    }
                }
            }
        }
        if (maxNum === null) {
            return 'INV-1600';
        }
        return `INV-${maxNum + 1}`;
    }
    async backfillInvoiceNumbers() {
        const unassignedOrders = await this.orderRepository
            .createQueryBuilder('order')
            .where('order.invoice_number IS NULL OR order.invoice_number = :empty', { empty: '' })
            .orderBy('order.created_at', 'ASC')
            .getMany();
        if (!unassignedOrders || unassignedOrders.length === 0) {
            return 0;
        }
        const nextInvoiceStr = await this.getNextInvoiceNumber();
        const match = nextInvoiceStr.match(/^INV-(\d+)$/i);
        let currentNum = match ? parseInt(match[1], 10) : 1600;
        for (const order of unassignedOrders) {
            order.invoice_number = `INV-${currentNum}`;
            await this.orderRepository.save(order);
            currentNum++;
        }
        return unassignedOrders.length;
    }
    async create(userId, orderData) {
        const rawDeliveryFee = orderData.delivery_fee_charged !== undefined
            ? orderData.delivery_fee_charged
            : orderData.delivery_fee;
        if (rawDeliveryFee !== undefined && rawDeliveryFee !== null) {
            const parsedFee = Number(rawDeliveryFee);
            if (isNaN(parsedFee) || parsedFee < 0 || parsedFee > 150) {
                throw new common_1.BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $150.00');
            }
        }
        const rawDiscount = orderData.discount_percentage !== undefined
            ? orderData.discount_percentage
            : orderData.global_discount_percentage;
        if (rawDiscount !== undefined && rawDiscount !== null) {
            const parsedDiscount = Number(rawDiscount);
            if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 50) {
                throw new common_1.BadRequestException('El porcentaje de descuento no puede exceder el 50%');
            }
        }
        const earlyMethod = orderData.paymentMethod || orderData.payment_method;
        const isEarlyCheck = String(earlyMethod || '').trim().toUpperCase() === 'CHECK';
        const earlyCheckPhoto = orderData.checkImageUrl ||
            orderData.check_image_url ||
            orderData.checkPhoto ||
            orderData.check_photo;
        if (isEarlyCheck && (!earlyCheckPhoto || !String(earlyCheckPhoto).trim())) {
            throw new common_1.BadRequestException('Foto del cheque es obligatoria para pagos con cheque');
        }
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
        let appliedDeliveryAddressText = deliveryAddressText || rest.delivery_address_text || null;
        if (appliedDeliveryAddressText && this.addressValidationService) {
            try {
                const validated = await this.addressValidationService.validateAndGeocode(appliedDeliveryAddressText);
                appliedDeliveryAddressText = validated.formatted_address;
                if (!orderData.dest_lat)
                    orderData.dest_lat = validated.lat;
                if (!orderData.dest_lng)
                    orderData.dest_lng = validated.lng;
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException)
                    throw err;
            }
        }
        if (appliedAddressId && this.addressRepository && (!orderData.dest_lat || !orderData.dest_lng)) {
            try {
                const addr = await this.addressRepository.findOne({ where: { id: appliedAddressId } });
                if (addr && addr.lat && addr.lng) {
                    orderData.dest_lat = addr.refined_lat || addr.lat;
                    orderData.dest_lng = addr.refined_lng || addr.lng;
                }
            }
            catch (_) { }
        }
        let appliedPaymentStatus = paymentStatus || rest.payment_status || 'pending';
        let appliedPaymentMethod = rest.payment_method || orderData.payment_method || rest.paymentMethod || orderData.paymentMethod || (user?.account_type === 'credit' ? 'credit' : 'stripe');
        const rawZelleRef = rest.zelle_reference || orderData.zelle_reference;
        const appliedZelleReference = rawZelleRef ? String(rawZelleRef).trim() : null;
        const rawZelleReceipt = rest.zelle_receipt_url || orderData.zelle_receipt_url;
        const appliedZelleReceiptUrl = rawZelleReceipt ? String(rawZelleReceipt).trim() : null;
        const isCheckPayment = String(appliedPaymentMethod || '').trim().toUpperCase() === 'CHECK' ||
            String(orderData.paymentMethod || orderData.payment_method || rest.paymentMethod || rest.payment_method || '').trim().toUpperCase() === 'CHECK';
        const rawCheckImage = orderData.checkImageUrl ||
            orderData.check_image_url ||
            orderData.checkPhoto ||
            orderData.check_photo ||
            rest.checkImageUrl ||
            rest.check_image_url ||
            rest.checkPhoto ||
            rest.check_photo;
        const appliedCheckImageUrl = rawCheckImage ? String(rawCheckImage).trim() : null;
        if (isCheckPayment) {
            if (!appliedCheckImageUrl) {
                throw new common_1.BadRequestException('Foto del cheque es obligatoria para pagos con cheque');
            }
            appliedPaymentStatus = 'pending_check_verification';
        }
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
        const packagingFee = 0;
        const packagingDiscount = 0;
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
        }
        let deliveryFee = 0;
        if (appliedDeliveryType === 'pickup') {
            deliveryFee = 0;
        }
        else if (user?.delivery_fee !== null && user?.delivery_fee !== undefined && Number(user.delivery_fee) > 0) {
            deliveryFee = Number(user.delivery_fee);
        }
        else {
            if (this.mileageFreightService && (orderData.miles !== undefined || orderData.dest_lat !== undefined)) {
                const miles = orderData.miles !== undefined
                    ? Number(orderData.miles)
                    : this.mileageFreightService.calculateDistanceMiles(Number(orderData.dest_lat), Number(orderData.dest_lng));
                const serviceType = orderData.freight_service_type || 'shared';
                const quote = this.mileageFreightService.calculateFreight(miles, serviceType);
                deliveryFee = quote.cost;
            }
            else if (orderData.delivery_fee !== undefined) {
                deliveryFee = Number(orderData.delivery_fee);
            }
            else {
                deliveryFee = Number(user?.delivery_fee || 0);
            }
        }
        if (isNaN(deliveryFee) || deliveryFee < 0) {
            deliveryFee = 0;
        }
        else if (deliveryFee > 150) {
            deliveryFee = 150;
        }
        let isComplementary = false;
        if (appliedDeliveryDate && appliedDeliveryType !== 'pickup') {
            const activeSameDateOrders = await this.orderRepository.find({
                where: {
                    user_id: userId,
                    delivery_date: appliedDeliveryDate,
                },
            });
            const validExisting = activeSameDateOrders.filter(o => o.status !== 'cancelled' && o.status !== 'Cancelado' && (!appliedAddressId || !o.address_id || o.address_id === appliedAddressId));
            if (validExisting.length > 0 || orderData.is_complementary === true) {
                isComplementary = true;
                deliveryFee = 0.00;
            }
        }
        let appliedNotes = orderData.notes || '';
        if (isComplementary && !appliedNotes.includes('Complementario a orden existente')) {
            appliedNotes = appliedNotes ? `${appliedNotes}\n[Complementario a orden existente]` : '[Complementario a orden existente]';
        }
        let activeStoreDiscount = 0;
        let storeDiscountReason = null;
        if (this.systemConfigsService && typeof this.systemConfigsService.getStoreDiscount === 'function') {
            try {
                const storeDiscount = await this.systemConfigsService.getStoreDiscount();
                if (storeDiscount &&
                    storeDiscount.is_active === true &&
                    Number(storeDiscount.percentage) > 0 &&
                    (!storeDiscount.valid_until || new Date() <= new Date(storeDiscount.valid_until))) {
                    activeStoreDiscount = Number(storeDiscount.percentage);
                    storeDiscountReason = storeDiscount.reason || 'Descuento general de tienda';
                }
            }
            catch (err) {
                console.error('[OrdersService] Error fetching store general discount:', err);
            }
        }
        const userGeneralDiscount = (user?.general_discount !== null && user?.general_discount !== undefined && Number(user.general_discount) > 0)
            ? Number(user.general_discount)
            : 0;
        if (activeStoreDiscount > 50 || userGeneralDiscount > 50) {
            throw new common_1.BadRequestException('El porcentaje de descuento no puede exceder el 50%');
        }
        const appliedDiscountPercentage = Math.max(activeStoreDiscount, userGeneralDiscount);
        if (appliedDiscountPercentage > 50) {
            throw new common_1.BadRequestException('El porcentaje de descuento no puede exceder el 50%');
        }
        let globalDiscountAmount = 0;
        let globalDiscountReason = null;
        let globalDiscountPercentage = 0;
        if (appliedDiscountPercentage > 0) {
            globalDiscountPercentage = appliedDiscountPercentage;
            if (activeStoreDiscount >= userGeneralDiscount && activeStoreDiscount > 0) {
                globalDiscountReason = storeDiscountReason || 'Descuento general de tienda';
            }
            else {
                globalDiscountReason = `Descuento particular del cliente (${userGeneralDiscount}%)`;
            }
            const alreadyDiscountedAtItemLevel = Boolean(user?.productDiscounts && user.productDiscounts.length > 0 && userGeneralDiscount > 0);
            if (alreadyDiscountedAtItemLevel) {
                if (activeStoreDiscount > userGeneralDiscount) {
                    const deltaPercentage = activeStoreDiscount - userGeneralDiscount;
                    globalDiscountAmount = Math.round(itemsTotal * (deltaPercentage / 100) * 100) / 100;
                }
                else {
                    globalDiscountAmount = 0;
                }
            }
            else {
                globalDiscountAmount = Math.round(itemsTotal * (globalDiscountPercentage / 100) * 100) / 100;
            }
        }
        let storeCreditApplied = 0;
        const requestedStoreCredit = Number(orderData.store_credit_applied || 0);
        const userCreditBalance = Number(user?.credit_balance || 0);
        const grossTotal = Math.max(0, Math.round((itemsTotal - globalDiscountAmount + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100);
        if (requestedStoreCredit > 0 && userCreditBalance > 0) {
            storeCreditApplied = Math.min(requestedStoreCredit, userCreditBalance, grossTotal);
        }
        const finalTotal = Math.max(0, Math.round((grossTotal - storeCreditApplied + Number.EPSILON) * 100) / 100);
        if (finalTotal === 0 && storeCreditApplied > 0) {
            appliedPaymentMethod = 'store_credit';
            appliedPaymentStatus = 'paid';
        }
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
        const rawStatus = otherData.status;
        const initialStatus = rawStatus ? this.normalizeStatus(rawStatus) : 'pending';
        const isDirectlyConfirmed = initialStatus === 'confirmed';
        const savedOrderId = await this.dataSource.transaction(async (manager) => {
            let invoiceNumber = null;
            if (isDirectlyConfirmed && !otherData.is_preliminary && !otherData.draft) {
                invoiceNumber = await this.getNextInvoiceNumber(manager);
            }
            const orderToCreate = manager.create(order_entity_1.Order, {
                ...otherData,
                status: initialStatus,
                invoice_number: invoiceNumber,
                delivery_date: appliedDeliveryDate,
                payment_due_date: appliedPaymentDueDate,
                address_id: appliedAddressId,
                delivery_type: appliedDeliveryType,
                delivery_address_text: appliedDeliveryAddressText,
                user_id: userId,
                total: finalTotal,
                payment_method: appliedPaymentMethod,
                zelle_reference: appliedZelleReference,
                zelle_receipt_url: appliedZelleReceiptUrl,
                check_number: orderData.check_number || orderData.checkNumber || rest.check_number || rest.checkNumber || null,
                check_bank: orderData.check_bank || orderData.checkBank || rest.check_bank || rest.checkBank || null,
                check_amount: orderData.check_amount !== undefined ? Number(orderData.check_amount) : orderData.checkAmount !== undefined ? Number(orderData.checkAmount) : null,
                check_image_url: appliedCheckImageUrl,
                check_verified: Boolean(orderData.check_verified || orderData.checkVerified || rest.check_verified || rest.checkVerified),
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
                is_complementary: isComplementary,
                store_credit_applied: storeCreditApplied,
                global_discount_amount: globalDiscountAmount,
                global_discount_reason: globalDiscountReason,
                global_discount_percentage: globalDiscountPercentage,
                notes: appliedNotes,
            });
            const savedResult = await manager.save(order_entity_1.Order, orderToCreate);
            const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;
            if (storeCreditApplied > 0 && user) {
                user.credit_balance = Math.max(0, Math.round((userCreditBalance - storeCreditApplied) * 100) / 100);
                await manager.save(user_entity_1.User, user);
            }
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
        if (appliedPaymentStatus === 'paid' && this.mailService && typeof this.mailService.sendEnglishInvoice === 'function' && user?.email) {
            this.mailService.sendEnglishInvoice(createdOrder, user.email).catch(err => {
                console.error('[OrdersService] Error sending initial English invoice:', err?.message || err);
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
        const normalizedStatus = this.validateStatusTransition(order.status, status, userRole);
        order.status = normalizedStatus;
        if (normalizedStatus === 'confirmed' && !order.invoice_number) {
            order.invoice_number = await this.getNextInvoiceNumber();
        }
        return this.orderRepository.save(order);
    }
    async completeCheckout(id, userRole) {
        const order = await this.findOne(id);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        const currentNorm = this.normalizeStatus(order.status);
        if (currentNorm === 'cancelled') {
            throw new common_1.BadRequestException('Cannot complete checkout for a cancelled order');
        }
        if (currentNorm === 'pending') {
            order.status = 'confirmed';
        }
        if (!order.invoice_number) {
            order.invoice_number = await this.getNextInvoiceNumber();
        }
        const saved = await this.orderRepository.save(order);
        if (saved.payment_status === 'paid' && this.mailService && typeof this.mailService.sendEnglishInvoice === 'function') {
            const user = await this.userRepository.findOne({ where: { id: saved.user_id } });
            if (user?.email) {
                this.mailService.sendEnglishInvoice(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending English invoice on completeCheckout:', err?.message || err);
                });
            }
        }
        return saved;
    }
    async assignDelivery(id, deliveryUserId) {
        const order = await this.findOne(id);
        order.delivery_user_id = deliveryUserId;
        return this.orderRepository.save(order);
    }
    async update(id, updateData, userRole) {
        const order = await this.findOne(id);
        const oldTotal = Number(order.total) || 0;
        const oldPaymentStatus = order.payment_status;
        const oldStatus = order.status;
        const { status, total, delivery_date, address_id, motivo, items, payment_status, paymentStatus } = updateData;
        if (status) {
            const normalizedStatus = this.validateStatusTransition(order.status, status, userRole);
            order.status = normalizedStatus;
            if (normalizedStatus === 'confirmed' && !order.invoice_number) {
                order.invoice_number = await this.getNextInvoiceNumber();
            }
        }
        if (payment_status !== undefined || paymentStatus !== undefined) {
            order.payment_status = payment_status || paymentStatus;
            if (order.payment_status === 'paid' && updateData.pending_balance === undefined) {
                order.pending_balance = 0;
            }
            if (order.payment_status === 'paid' && this.normalizeStatus(order.status) !== 'cancelled') {
                if (this.normalizeStatus(order.status) === 'pending') {
                    order.status = 'confirmed';
                }
                if (!order.invoice_number) {
                    order.invoice_number = await this.getNextInvoiceNumber();
                }
            }
        }
        if (updateData.delivery_fee_charged !== undefined || updateData.delivery_fee !== undefined) {
            const rawFee = updateData.delivery_fee_charged !== undefined ? updateData.delivery_fee_charged : updateData.delivery_fee;
            const parsedFee = Number(rawFee);
            if (isNaN(parsedFee) || parsedFee < 0 || parsedFee > 150) {
                throw new common_1.BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $150.00');
            }
            order.delivery_fee_charged = parsedFee;
        }
        if (updateData.discount_percentage !== undefined || updateData.global_discount_percentage !== undefined) {
            const rawDiscount = updateData.discount_percentage !== undefined ? updateData.discount_percentage : updateData.global_discount_percentage;
            const parsedDiscount = Number(rawDiscount);
            if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 50) {
                throw new common_1.BadRequestException('El porcentaje de descuento no puede exceder el 50%');
            }
            order.global_discount_percentage = parsedDiscount;
        }
        if (updateData.stripe_payment_id !== undefined) {
            order.stripe_payment_id = updateData.stripe_payment_id;
        }
        if (updateData.refunded_amount !== undefined) {
            order.refunded_amount = Number(updateData.refunded_amount);
        }
        if (updateData.credit_note_number !== undefined) {
            order.credit_note_number = updateData.credit_note_number;
        }
        if (((updateData.refunded_amount !== undefined && Number(updateData.refunded_amount) > 0) || Number(order.refunded_amount) > 0) && !order.credit_note_number) {
            const year = new Date().getFullYear();
            const shortId = (order.id || '').toString().replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
            order.credit_note_number = `NC-${year}-${shortId.padStart(4, '0')}`;
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
        if (updateData.zelle_receipt_url !== undefined) {
            order.zelle_receipt_url = updateData.zelle_receipt_url;
        }
        if (updateData.zelle_reference !== undefined) {
            order.zelle_reference = updateData.zelle_reference;
        }
        const incomingMethod = updateData.payment_method || updateData.paymentMethod;
        if (incomingMethod !== undefined) {
            order.payment_method = incomingMethod;
        }
        const isCheckPaymentUpdate = String(order.payment_method || '').trim().toUpperCase() === 'CHECK';
        if (isCheckPaymentUpdate && (incomingMethod !== undefined || updateData.payment_status === 'paid' || updateData.paymentStatus === 'paid')) {
            const checkPhoto = updateData.checkImageUrl || updateData.check_image_url || updateData.checkPhoto || updateData.check_photo || order.check_image_url;
            if (!checkPhoto || typeof checkPhoto !== 'string' || !checkPhoto.trim()) {
                throw new common_1.BadRequestException('Foto del cheque es obligatoria para pagos con cheque');
            }
            order.check_image_url = checkPhoto.trim();
        }
        if (updateData.check_image_url !== undefined || updateData.checkImageUrl !== undefined) {
            order.check_image_url = updateData.check_image_url || updateData.checkImageUrl;
        }
        if (updateData.check_number !== undefined || updateData.checkNumber !== undefined) {
            order.check_number = updateData.check_number || updateData.checkNumber;
        }
        if (updateData.check_bank !== undefined || updateData.checkBank !== undefined) {
            order.check_bank = updateData.check_bank || updateData.checkBank;
        }
        if (updateData.check_amount !== undefined || updateData.checkAmount !== undefined) {
            order.check_amount = Number(updateData.check_amount ?? updateData.checkAmount);
        }
        if (updateData.check_verified !== undefined || updateData.checkVerified !== undefined) {
            order.check_verified = Boolean(updateData.check_verified ?? updateData.checkVerified);
        }
        if (updateData.pending_balance !== undefined) {
            order.pending_balance = Number(updateData.pending_balance);
        }
        if (updateData.delivery_fee !== undefined || updateData.delivery_fee_charged !== undefined) {
            order.delivery_fee_charged = Number(updateData.delivery_fee ?? updateData.delivery_fee_charged ?? 0);
        }
        if (updateData.notes !== undefined && !motivo) {
            order.notes = updateData.notes;
        }
        if (updateData.delivery_user_id !== undefined) {
            order.delivery_user_id = updateData.delivery_user_id;
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
            if (total !== undefined) {
                order.total = total;
            }
            else {
                order.total = result.total;
            }
        }
        else if (total !== undefined) {
            order.total = total;
        }
        if (oldPaymentStatus === 'paid' && Number(order.total) < oldTotal) {
            const diff = Math.round((oldTotal - Number(order.total)) * 100) / 100;
            const client = await this.userRepository.findOne({ where: { id: order.user_id } });
            if (client) {
                client.credit_balance = Math.round(((Number(client.credit_balance) || 0) + diff) * 100) / 100;
                await this.userRepository.save(client);
            }
        }
        const saved = await this.orderRepository.save(order);
        const isNowPaidOrApproved = (saved.payment_status === 'paid' || saved.status === 'approved' || saved.status === 'aprobado');
        const wasPaidOrApproved = (oldPaymentStatus === 'paid' || oldStatus === 'approved' || oldStatus === 'aprobado');
        if (isNowPaidOrApproved && !wasPaidOrApproved && this.mailService && typeof this.mailService.sendEnglishInvoice === 'function') {
            const client = await this.userRepository.findOne({ where: { id: saved.user_id } });
            if (client?.email) {
                this.mailService.sendEnglishInvoice(saved, client.email).catch(err => {
                    console.error('[OrdersService] Error sending English invoice on order status update:', err?.message || err);
                });
            }
        }
        return this.findOne(id);
    }
    getPaymentsService() {
        return this.paymentsService;
    }
    async approveZellePayment(orderId) {
        const order = await this.findOne(orderId);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        order.payment_status = 'paid';
        if (this.normalizeStatus(order.status) === 'pending') {
            order.status = 'confirmed';
        }
        if (!order.invoice_number) {
            order.invoice_number = await this.getNextInvoiceNumber();
        }
        const saved = await this.orderRepository.save(order);
        const user = await this.userRepository.findOne({ where: { id: order.user_id } });
        if (user?.email) {
            if (this.mailService && typeof this.mailService.sendOrderReceipt === 'function') {
                this.mailService.sendOrderReceipt(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending zelle approved receipt email:', err?.message || err);
                });
            }
            if (this.mailService && typeof this.mailService.sendEnglishInvoice === 'function') {
                this.mailService.sendEnglishInvoice(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending English invoice on zelle approval:', err?.message || err);
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
        const saved = await this.orderRepository.save(order);
        if (this.mailService && typeof this.mailService.sendZelleRejectionAlert === 'function') {
            const user = await this.userRepository.findOne({ where: { id: order.user_id } });
            const customerEmail = user?.email || order.user?.email;
            if (customerEmail) {
                this.mailService.sendZelleRejectionAlert(saved, customerEmail, reason || 'Comprobante no coincide con el depósito bancario').catch(err => {
                    console.error('[OrdersService] Error sending zelle rejection email:', err?.message || err);
                });
            }
        }
        return saved;
    }
    async approveCheckPayment(orderId, notes) {
        const order = await this.findOne(orderId);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        if (order.status === 'cancelled' || order.status === 'Cancelado') {
            throw new common_1.BadRequestException('Cannot approve checkout for a cancelled order');
        }
        order.payment_status = 'paid';
        if (this.normalizeStatus(order.status) === 'pending' || order.status === 'pending' || order.status === 'Pedido') {
            order.status = 'Pedido Enviado';
        }
        if (!order.invoice_number) {
            order.invoice_number = await this.getNextInvoiceNumber();
        }
        if (notes) {
            order.notes = order.notes ? `${order.notes}\n[Aprobación Cheque]: ${notes}` : `[Aprobación Cheque]: ${notes}`;
        }
        const saved = await this.orderRepository.save(order);
        if (this.checkPaymentsService) {
            try {
                const existing = await this.checkPaymentsService.findByOrder(saved.id);
                if (!existing || existing.length === 0) {
                    const today = new Date().toISOString().split('T')[0];
                    await this.checkPaymentsService.registerCheck({
                        order_id: saved.id,
                        check_number: saved.check_number || `CHK-${saved.invoice_number || saved.id.slice(0, 8)}`,
                        bank_name: saved.check_bank || 'Banco Verificado',
                        amount: Number(saved.check_amount) || Number(saved.total) || 0,
                        received_date: today,
                        notes: notes || 'Aprobado desde panel de administración',
                        user_id: saved.user_id,
                        status: 'IN_HAND',
                    });
                }
            }
            catch (checkErr) {
                console.error('[OrdersService] Error registering check payment in reconciliation:', checkErr?.message || checkErr);
            }
        }
        const user = await this.userRepository.findOne({ where: { id: order.user_id } });
        if (user?.email && this.mailService) {
            if (typeof this.mailService.sendOrderReceipt === 'function') {
                this.mailService.sendOrderReceipt(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending check approved receipt email:', err?.message || err);
                });
            }
            if (typeof this.mailService.sendEnglishInvoice === 'function') {
                this.mailService.sendEnglishInvoice(saved, user.email).catch(err => {
                    console.error('[OrdersService] Error sending English invoice on check approval:', err?.message || err);
                });
            }
        }
        return saved;
    }
    async rejectCheckPayment(orderId, reason) {
        const order = await this.findOne(orderId);
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        order.payment_status = 'unpaid';
        order.status = 'Cancelado';
        if (reason) {
            order.notes = `[Rechazo Cheque]: ${reason}\n${order.notes || ''}`;
        }
        const saved = await this.orderRepository.save(order);
        return saved;
    }
    async settleBatch(userId, userRole, dto) {
        if (!dto || !Array.isArray(dto.order_ids) || dto.order_ids.length === 0) {
            throw new common_1.BadRequestException('Debe proporcionar una lista no vacía de order_ids');
        }
        if (!dto.payment_method || typeof dto.payment_method !== 'string' || !dto.payment_method.trim()) {
            throw new common_1.BadRequestException('El método de pago es obligatorio para la liquidación');
        }
        const cleanMethod = dto.payment_method.trim().toLowerCase();
        if (cleanMethod === 'check') {
            const checkPhoto = dto.checkImageUrl || dto.check_image_url || dto.checkPhoto || dto.check_photo;
            if (!checkPhoto || typeof checkPhoto !== 'string' || !checkPhoto.trim()) {
                throw new common_1.BadRequestException('Foto del cheque es obligatoria para pagos con cheque');
            }
        }
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
    validateMutationCutoff(order, referenceDate) {
        const now = referenceDate || new Date();
        const allowedStatuses = ['pending', 'confirmed', 'pedido enviado'];
        const currentStatus = (order.status || '').toLowerCase().trim();
        if (!allowedStatuses.includes(currentStatus)) {
            throw new common_1.BadRequestException('Solo se pueden modificar órdenes en estado pending o confirmed');
        }
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
        const nowParts = nyDateFormatter.formatToParts(now);
        const yrNow = nowParts.find(p => p.type === 'year')?.value || '1970';
        const moNow = nowParts.find(p => p.type === 'month')?.value || '01';
        const daNow = nowParts.find(p => p.type === 'day')?.value || '01';
        const nyNowDateStr = `${yrNow}-${moNow}-${daNow}`;
        const nowTimeParts = nyTimeFormatter.formatToParts(now);
        let nyNowHour = parseInt(nowTimeParts.find(p => p.type === 'hour')?.value || '0', 10);
        if (nyNowHour === 24)
            nyNowHour = 0;
        const orderCreatedAt = order.created_at ? new Date(order.created_at) : now;
        const orderParts = nyDateFormatter.formatToParts(orderCreatedAt);
        const yrOrd = orderParts.find(p => p.type === 'year')?.value || '1970';
        const moOrd = orderParts.find(p => p.type === 'month')?.value || '01';
        const daOrd = orderParts.find(p => p.type === 'day')?.value || '01';
        const nyOrderDateStr = `${yrOrd}-${moOrd}-${daOrd}`;
        if (nyNowDateStr > nyOrderDateStr) {
            throw new common_1.BadRequestException('Corte de producción superado. No se pueden modificar items');
        }
        if (nyNowHour >= 12) {
            throw new common_1.BadRequestException('Corte de producción superado. No se pueden modificar items');
        }
    }
    async mutateOrderItems(id, body, userId, userRole, referenceDateOverride) {
        const order = await this.findOne(id);
        if (!order) {
            throw new common_1.NotFoundException(`Order ${id} not found`);
        }
        if (userRole !== 'admin' && userId && order.user_id !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para modificar esta orden');
        }
        const refDate = body.referenceDate
            ? new Date(body.referenceDate)
            : (referenceDateOverride || new Date());
        this.validateMutationCutoff(order, refDate);
        if (body.zelle_receipt_url !== undefined) {
            order.zelle_receipt_url = body.zelle_receipt_url;
            if (order.payment_method === 'zelle') {
                order.payment_status = 'pending_zelle_verification';
            }
        }
        if (body.zelle_reference !== undefined) {
            order.zelle_reference = body.zelle_reference;
        }
        if (body.items && Array.isArray(body.items)) {
            let itemsToCalculate = [];
            if (body.replaceItems === true) {
                itemsToCalculate = body.items.map((i) => ({
                    productId: Number(i.productId || i.product_id),
                    quantity: Number(i.quantity),
                })).filter(i => i.quantity > 0);
            }
            else {
                const itemMap = new Map();
                if (order.items && Array.isArray(order.items)) {
                    for (const existingItem of order.items) {
                        const pid = Number(existingItem.product_id || existingItem.product?.id);
                        if (pid) {
                            itemMap.set(pid, Number(existingItem.quantity) || 0);
                        }
                    }
                }
                for (const updateItem of body.items) {
                    const pid = Number(updateItem.productId || updateItem.product_id);
                    const qty = Number(updateItem.quantity);
                    if (qty <= 0) {
                        itemMap.delete(pid);
                    }
                    else {
                        itemMap.set(pid, qty);
                    }
                }
                itemsToCalculate = Array.from(itemMap.entries()).map(([productId, quantity]) => ({
                    productId,
                    quantity,
                }));
            }
            if (itemsToCalculate.length === 0) {
                throw new common_1.BadRequestException('La orden debe contener al menos un producto');
            }
            const result = await this.calculateOrderPricesAndTotal(order.user_id, itemsToCalculate);
            await this.orderItemRepository.delete({ order_id: order.id });
            const newOrderItems = result.validatedItems.map((item) => ({
                product_id: item.product_id,
                price_at_time: item.price_at_time,
                quantity: item.quantity,
                order_id: order.id,
            }));
            order.items = await this.orderItemRepository.save(newOrderItems);
            const itemsTotal = result.total;
            const oldTotal = Number(order.total) || 0;
            const packagingFee = 0;
            const packagingDiscount = 0;
            const feeMethod = (order.payment_method === 'stripe' || order.payment_method === 'card')
                ? 'STRIPE_CARD'
                : (order.payment_method === 'ach' || order.payment_method === 'ach_debit')
                    ? 'ACH'
                    : String(order.payment_method || '').toUpperCase();
            const feeAmount = fee_calculator_service_1.FeeCalculatorService.calculateFee(itemsTotal, feeMethod);
            let appliedTaxAmount = 0.00;
            if (order.tax_exempt) {
                appliedTaxAmount = 0.00;
            }
            else if (order.tax_rate && Number(order.tax_rate) > 0) {
                appliedTaxAmount = Math.round(itemsTotal * (Number(order.tax_rate) / 100) * 100) / 100;
            }
            const deliveryFee = Number(order.delivery_fee_charged) || 0;
            let discountAmount = 0;
            if (order.global_discount_percentage && Number(order.global_discount_percentage) > 0) {
                discountAmount = Math.round(itemsTotal * (Number(order.global_discount_percentage) / 100) * 100) / 100;
                order.global_discount_amount = discountAmount;
            }
            const newTotal = Math.round((itemsTotal - discountAmount + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100;
            order.packaging_fee = packagingFee;
            order.packaging_discount = packagingDiscount;
            order.fee_amount = feeAmount;
            order.fee_method = order.fee_method || feeMethod;
            order.tax_amount = appliedTaxAmount;
            order.total = newTotal;
            const delta = Math.round((newTotal - oldTotal) * 100) / 100;
            if (delta < 0) {
                const refundAmount = Math.abs(delta);
                if ((order.payment_method === 'stripe' || order.payment_method === 'card') &&
                    (order.payment_status === 'paid' || order.stripe_payment_id)) {
                    if (this.paymentsService && typeof this.paymentsService.createRefund === 'function') {
                        try {
                            await this.paymentsService.createRefund({
                                orderId: order.id,
                                amount: refundAmount,
                                reason: body.reason || 'Ajuste de orden pre-corte (disminución de items)',
                            });
                        }
                        catch (refErr) {
                            console.warn(`[OrdersService] createRefund error: ${refErr?.message || refErr}. Fallback a nota de crédito.`);
                            order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
                            order.refund_reason = `Saldo a favor / Nota de crédito: $${refundAmount.toFixed(2)}`;
                        }
                    }
                    else {
                        order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
                        order.refund_reason = `Saldo a favor / Nota de crédito: $${refundAmount.toFixed(2)}`;
                    }
                }
                else {
                    const creditNote = `[SALDO A FAVOR] Crédito de $${refundAmount.toFixed(2)} registrado por ajuste de orden.`;
                    order.notes = order.notes ? `${order.notes}\n${creditNote}` : creditNote;
                    order.refund_reason = creditNote;
                    order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
                }
                if (order.payment_status === 'paid' || order.payment_status === 'partially_paid') {
                    const clientUser = await this.userRepository.findOne({ where: { id: order.user_id } });
                    if (clientUser) {
                        clientUser.credit_balance = Math.round(((Number(clientUser.credit_balance) || 0) + refundAmount) * 100) / 100;
                        await this.userRepository.save(clientUser);
                    }
                }
                order.pending_balance = 0;
            }
            else if (delta > 0) {
                if (order.payment_status === 'paid') {
                    order.pending_balance = delta;
                    order.payment_status = 'partially_paid';
                    const balanceNote = `[BALANCE PENDIENTE] Saldo pendiente de pago por ajuste: $${delta.toFixed(2)}.`;
                    order.notes = order.notes ? `${order.notes}\n${balanceNote}` : balanceNote;
                }
                else {
                    order.pending_balance = newTotal;
                }
            }
        }
        const savedOrder = await this.orderRepository.save(order);
        if ((savedOrder.payment_status === 'paid' || savedOrder.status === 'approved' || savedOrder.status === 'aprobado') && this.mailService && typeof this.mailService.sendEnglishInvoice === 'function') {
            const clientUser = await this.userRepository.findOne({ where: { id: savedOrder.user_id } });
            if (clientUser?.email) {
                this.mailService.sendEnglishInvoice(savedOrder, clientUser.email).catch(err => {
                    console.error('[OrdersService] Error sending English invoice after adminEdit:', err?.message || err);
                });
            }
        }
        return this.findOne(order.id);
    }
    async disableOrder(id, reason) {
        const order = await this.findOne(id);
        const auditLog = `[ORDEN INHABILITADA POR ADMINISTRACIÓN: ${reason || 'Compra de prueba'} - ${new Date().toISOString()}]\n`;
        order.status = 'cancelled';
        order.notes = `${auditLog}${order.notes || ''}`;
        return this.orderRepository.save(order);
    }
    async bulkDisableOrders(orderIds, reason) {
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            throw new common_1.BadRequestException('orderIds debe ser un arreglo no vacío');
        }
        let affected = 0;
        for (const id of orderIds) {
            await this.disableOrder(id, reason);
            affected++;
        }
        return { affected };
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
    __param(11, (0, common_1.Optional)()),
    __param(11, (0, common_1.Inject)((0, common_1.forwardRef)(() => payments_service_1.PaymentsService))),
    __param(12, (0, common_1.Optional)()),
    __param(12, (0, common_1.Inject)((0, common_1.forwardRef)(() => check_payments_service_1.CheckPaymentsService))),
    __param(13, (0, common_1.Optional)()),
    __param(14, (0, common_1.Optional)()),
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
        mileage_freight_service_1.MileageFreightService,
        payments_service_1.PaymentsService,
        check_payments_service_1.CheckPaymentsService,
        address_validation_service_1.AddressValidationService,
        system_configs_service_1.SystemConfigsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map