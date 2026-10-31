import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { Address } from '../addresses/address.entity';
import { ZonesService } from '../zones/zones.service';
import { MailService } from '../mail/mail.service';
import { CreditService } from '../credit/credit.service';
import { FeeCalculatorService } from './fee-calculator.service';
import { MileageFreightService } from '../logistics/mileage-freight.service';
import { PaymentsService } from '../payments/payments.service';
import { AddressValidationService } from '../addresses/address-validation.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    @Optional()
    @InjectRepository(Address)
    private addressRepository?: Repository<Address>,
    @Optional()
    private zonesService?: ZonesService,
    @Optional()
    private mailService?: MailService,
    @Optional()
    private creditService?: CreditService,
    @Optional()
    private feeCalculatorService?: FeeCalculatorService,
    @Optional()
    private mileageFreightService?: MileageFreightService,
    @Optional()
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService?: PaymentsService,
    @Optional()
    private addressValidationService?: AddressValidationService,
  ) {}

  validateCutoffTime(deliveryDateStr?: string, referenceDate?: Date, cutoffHour = 12): void {
    if (!deliveryDateStr) return;

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
    const nyDateStr = `${yr}-${mo}-${da}`; // YYYY-MM-DD

    const timeParts = nyTimeFormatter.formatToParts(now);
    const nyHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);

    const pastCutoff = nyHour >= cutoffHour;
    const daysToAdd = pastCutoff ? 3 : 2;

    const minDateNY = new Date(Date.UTC(Number(yr), Number(mo) - 1, Number(da)));
    minDateNY.setUTCDate(minDateNY.getUTCDate() + daysToAdd);

    const yrMin = minDateNY.getUTCFullYear();
    const moMin = String(minDateNY.getUTCMonth() + 1).padStart(2, '0');
    const daMin = String(minDateNY.getUTCDate()).padStart(2, '0');
    const minDeliveryDateStr = `${yrMin}-${moMin}-${daMin}`;

    const targetDate = deliveryDateStr.split('T')[0].split(' ')[0];

    if (targetDate < minDeliveryDateStr) {
      if (targetDate < nyDateStr) {
        throw new BadRequestException('La fecha de entrega no puede ser en el pasado.');
      }
      if (targetDate === nyDateStr) {
        throw new BadRequestException('No se permiten entregas para el mismo día de la orden. Lead time mínimo de 48 horas requerido.');
      }
      throw new BadRequestException(
        pastCutoff
          ? `Corte de producción superado (${cutoffHour}:00 PM ET). Para pedidos después de las 12 PM, la fecha de entrega más temprana es ${minDeliveryDateStr} (T+3).`
          : `Lead time de producción de 48h requerido. La fecha de entrega más temprana es ${minDeliveryDateStr} (T+2).`
      );
    }
  }

  private validateStatusTransition(currentStatus: string, newStatus: string, userRole?: string) {
    if (userRole === 'admin') return;

    const validTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'shipped', 'cancelled'],
      'confirmed': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': [],
    };
    
    const current = currentStatus?.toLowerCase() || 'pending';
    const next = newStatus?.toLowerCase() || 'pending';

    if (current === next) return;

    const allowed = validTransitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private async calculateOrderPricesAndTotal(userId: string, items: any[]): Promise<{ validatedItems: any[], total: number }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['productDiscounts']
    });
    if (!user) throw new NotFoundException('User not found');

    const productIds = Array.from(
      new Set(
        items
          .map(item => Number(item.productId || item.product_id))
          .filter(id => !isNaN(id) && id > 0)
      )
    );

    const products = productIds.length > 0
      ? await this.productRepository.find({ where: { id: In(productIds) } })
      : [];
    const productMap = new Map<number, Product>(products.map(p => [p.id, p]));

    let calculatedTotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const productId = Number(item.productId || item.product_id);
      const product = productMap.get(productId);
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      const quantity = Number(item.quantity) || 0;
      if (quantity < 1) {
        throw new BadRequestException('Validation Error: Item quantity must be at least 1');
      }

      let finalPrice = Number(product.price);

      const productDiscount = user.productDiscounts?.find(d => d.product_id === product.id);
      if (productDiscount) {
        if (productDiscount.special_price !== null && productDiscount.special_price !== undefined && Number(productDiscount.special_price) > 0) {
          finalPrice = Number(productDiscount.special_price);
        } else if (productDiscount.discount_percentage !== null && productDiscount.discount_percentage !== undefined && Number(productDiscount.discount_percentage) > 0) {
          finalPrice = Number(product.price) * (1 - Number(productDiscount.discount_percentage) / 100);
        }
      } else if (user.general_discount !== null && user.general_discount !== undefined && Number(user.general_discount) > 0) {
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

  async findInRange(startDate: string, endDate: string, userId?: string): Promise<Order[]> {
    console.log('findInRange called with:', { startDate, endDate, userId });
    
    // Normalize input to date string: YYYY-MM-DD
    const rawStart = startDate.split(' ')[0].split('T')[0];
    const rawEnd = endDate.split(' ')[0].split('T')[0];

    // Widened range query to cover any timezone / production date batch offsets
    const startD = new Date(rawStart + 'T12:00:00');
    startD.setDate(startD.getDate() - 2); 
    const endD = new Date(rawEnd + 'T12:00:00');
    endD.setDate(endD.getDate() + 2);
    
    const queryStart = startD.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const queryEnd = endD.toISOString().split('T')[0] + 'T23:59:59.999Z';

    const qb = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('product.category', 'category') // LOAD CATEGORY FOR REPORT GROUPING
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
    
    // Client-side production date timezone conversion logic
    const getProductionDate = (dateVal: any) => {
      if (!dateVal) return '';
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return '';
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

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({ 
      relations: ['items', 'items.product', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address'],
      order: { created_at: 'DESC' },
      take: 100
    });
  }

  async findByUser(userId: string): Promise<Order[]> {
    return this.orderRepository.find({ 
      where: { user_id: userId },
      relations: ['items', 'items.product', 'address'],
      order: { created_at: 'DESC' }
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['items', 'items.product', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address']
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(userId: string, orderData: any): Promise<Order> {
    const { items, ...rest } = orderData;
    const { deliveryDate, paymentDueDate, addressId, deliveryType, deliveryAddressText, paymentStatus, ...otherData } = rest;

    let itemsTotal = 0;
    let validatedItems: any[] = [];

    if (items && items.length > 0) {
      const result = await this.calculateOrderPricesAndTotal(userId, items);
      validatedItems = result.validatedItems;
      itemsTotal = result.total;
    }

    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      relations: ['orders', 'profile']
    });
    const appliedDeliveryType = deliveryType || (rest as any).delivery_type || 'saved';
    const appliedDeliveryDate = deliveryDate || (rest as any).delivery_date;
    const appliedAddressId = addressId || (rest as any).address_id || null;
    let appliedDeliveryAddressText = deliveryAddressText || (rest as any).delivery_address_text || null;

    // TASK-54-01: Validar dirección ad-hoc si viene en checkout
    if (appliedDeliveryAddressText && this.addressValidationService) {
      try {
        const validated = await this.addressValidationService.validateAndGeocode(appliedDeliveryAddressText);
        appliedDeliveryAddressText = validated.formatted_address;
        if (!(orderData as any).dest_lat) (orderData as any).dest_lat = validated.lat;
        if (!(orderData as any).dest_lng) (orderData as any).dest_lng = validated.lng;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    if (appliedAddressId && this.addressRepository && (!(orderData as any).dest_lat || !(orderData as any).dest_lng)) {
      try {
        const addr = await this.addressRepository.findOne({ where: { id: appliedAddressId } });
        if (addr && addr.lat && addr.lng) {
          (orderData as any).dest_lat = addr.refined_lat || addr.lat;
          (orderData as any).dest_lng = addr.refined_lng || addr.lng;
        }
      } catch (_) {}
    }
    let appliedPaymentStatus = paymentStatus || (rest as any).payment_status || 'pending';

    const appliedPaymentMethod = (rest as any).payment_method || (orderData as any).payment_method || (user?.account_type === 'credit' ? 'credit' : 'stripe');
    const rawZelleRef = (rest as any).zelle_reference || (orderData as any).zelle_reference;
    const appliedZelleReference = rawZelleRef ? String(rawZelleRef).trim() : null;
    const rawZelleReceipt = (rest as any).zelle_receipt_url || (orderData as any).zelle_receipt_url;
    const appliedZelleReceiptUrl = rawZelleReceipt ? String(rawZelleReceipt).trim() : null;

    // TASK-43-04: Deterministic payment_due_date calculation
    // If credit order: created_at + 7 days (ISO YYYY-MM-DD)
    // Sad Path (§6): If not credit, payment_due_date must be null
    let appliedPaymentDueDate: string | null = null;
    if (appliedPaymentMethod === 'credit') {
      if (this.creditService) {
        appliedPaymentDueDate = this.creditService.calculatePaymentDueDate();
      } else {
        const now = new Date();
        const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const yr = dueDate.getUTCFullYear();
        const mo = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
        const da = String(dueDate.getUTCDate()).padStart(2, '0');
        appliedPaymentDueDate = `${yr}-${mo}-${da}`;
      }
    } else {
      appliedPaymentDueDate = null;
    }

    // Validate 12:00 PM cutoff time for next-day deliveries
    this.validateCutoffTime(appliedDeliveryDate);

    // TASK-47-04: Calculate processing fee via FeeCalculatorService
    const feeMethod = (appliedPaymentMethod === 'stripe' || appliedPaymentMethod === 'card')
      ? 'STRIPE_CARD'
      : (appliedPaymentMethod === 'ach' || appliedPaymentMethod === 'ach_debit')
        ? 'ACH'
        : String(appliedPaymentMethod || '').toUpperCase();

    let feeAmount = FeeCalculatorService.calculateFee(itemsTotal, feeMethod);
    if ((orderData as any).fee_amount !== undefined && (orderData as any).fee_amount !== null) {
      feeAmount = Number((orderData as any).fee_amount);
    }
    const appliedFeeMethod = (orderData as any).fee_method || feeMethod;

    // Packaging & Handling Fee (3.5%) & Direct Payment Bonus
    let packagingFee = Math.round(itemsTotal * 0.035 * 100) / 100;
    let packagingDiscount = 0;

    if (appliedPaymentMethod === 'zelle') {
      if (!appliedZelleReference) {
        throw new BadRequestException('El número de referencia o confirmación de Zelle es obligatorio para pagos con Zelle.');
      }

      // Check for duplicate reference in active orders
      const existingZelle = await this.orderRepository.createQueryBuilder('order')
        .where('LOWER(TRIM(order.zelle_reference)) = LOWER(:ref)', { ref: appliedZelleReference })
        .andWhere('order.status NOT IN (:...cancelled)', { cancelled: ['cancelled', 'Cancelado'] })
        .getOne();

      if (existingZelle) {
        throw new BadRequestException(`El número de referencia Zelle "${appliedZelleReference}" ya ha sido registrado en otra orden activa.`);
      }

      appliedPaymentStatus = 'pending_zelle_verification';
      packagingDiscount = packagingFee; // Direct payment discount completely offsets fee
    } else if (appliedPaymentMethod === 'stripe' || appliedPaymentMethod === 'card') {
      packagingDiscount = 0; // Gateway fee protection
    } else if (appliedPaymentMethod === 'ach' || appliedPaymentMethod === 'ach_debit') {
      packagingFee = feeAmount;
      packagingDiscount = 0;
    } else if (appliedPaymentMethod === 'credit') {
      packagingDiscount = packagingFee; // Credit orders do not pay gateway surcharge
    } else if (appliedPaymentMethod === 'check' || appliedPaymentMethod === 'cash') {
      packagingDiscount = packagingFee;
    }

    // Precedence Matrix for Delivery Fee:
    // 1. Pickup: always $0.00.
    // 2. VIP special fee set on user profile (user.delivery_fee > 0): takes precedence.
    // 3. Zone resolution based on delivery ZIP and min_free_delivery_amount threshold.
    // 4. Contingency fallback fee ($15.00) if unmapped.
    let deliveryFee = 0;
    if (appliedDeliveryType === 'pickup') {
      deliveryFee = 0;
    } else if (user?.delivery_fee !== null && user?.delivery_fee !== undefined && Number(user.delivery_fee) > 0) {
      deliveryFee = Number(user.delivery_fee);
    } else if (this.mileageFreightService && ((orderData as any).miles !== undefined || (orderData as any).dest_lat !== undefined)) {
      const miles = (orderData as any).miles !== undefined
        ? Number((orderData as any).miles)
        : this.mileageFreightService.calculateDistanceMiles(Number((orderData as any).dest_lat), Number((orderData as any).dest_lng));
      const serviceType = (orderData as any).freight_service_type || 'shared';
      const quote = this.mileageFreightService.calculateFreight(miles, serviceType);
      deliveryFee = quote.cost;
    } else if (this.zonesService) {
      let zip: string | null = (orderData as any).zip_code || (orderData as any).zip || (rest as any).zip_code || (rest as any).zip || null;
      if (!zip && appliedAddressId && this.addressRepository) {
        try {
          const addr = await this.addressRepository.findOne({ where: { id: appliedAddressId } });
          const match = addr?.address?.match(/\b\d{5}\b/);
          if (match) zip = match[0];
        } catch (_) {}
      }
      if (!zip && appliedDeliveryAddressText) {
        const match = appliedDeliveryAddressText.match(/\b\d{5}\b/);
        if (match) zip = match[0];
      }

      if (zip) {
        const zone = await this.zonesService.resolveZip(zip);
        if (zone) {
          if (
            zone.min_free_delivery_amount !== null &&
            zone.min_free_delivery_amount !== undefined &&
            Number(zone.min_free_delivery_amount) > 0 &&
            itemsTotal >= Number(zone.min_free_delivery_amount)
          ) {
            deliveryFee = 0;
          } else {
            deliveryFee = Number(zone.base_fee);
          }
        } else {
          deliveryFee = 15.00; // Contingency fallback for unmapped ZIP
        }
      } else {
        deliveryFee = 15.00; // Contingency fallback when delivery requested without ZIP
      }
    } else {
      deliveryFee = Number(user?.delivery_fee || 0);
    }
    const finalTotal = Math.round((itemsTotal + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100;

    let shouldSendCreditAlert = false;
    let isOverdraftAlert = false;
    let prospectiveCreditTotal = 0;
    let clientCreditLimit = 0;

    // Credit gate validation for B2B accounts
    if (user?.account_type === 'credit' || appliedPaymentMethod === 'credit') {
      let usedCredit = 0;
      if (this.creditService) {
        clientCreditLimit = await this.creditService.getCreditLimit(userId);
        usedCredit = await this.creditService.getUsedCredit(userId);
      } else {
        const unpaidOrders = (user?.orders || []).filter(
          (o: any) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado'
        );
        usedCredit = unpaidOrders.reduce((acc: number, o: any) => {
          const netOrderDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
          return acc + netOrderDebt;
        }, 0);
        clientCreditLimit = Number(user?.credit_limit || 0);
      }

      prospectiveCreditTotal = Math.round((usedCredit + finalTotal + Number.EPSILON) * 100) / 100;
      const isOverride = Boolean(user?.credit_override);

      if (prospectiveCreditTotal > clientCreditLimit && !isOverride) {
        throw new BadRequestException(
          `Límite de crédito excedido: Tu límite es de $${clientCreditLimit.toFixed(2)}, tienes $${usedCredit.toFixed(2)} pendiente y esta orden suma $${finalTotal.toFixed(2)}. Contacta a la administración para una autorización.`
        );
      }

      if (prospectiveCreditTotal > clientCreditLimit && isOverride) {
        shouldSendCreditAlert = true;
        isOverdraftAlert = true;
      } else if (prospectiveCreditTotal >= clientCreditLimit * 0.8 && prospectiveCreditTotal <= clientCreditLimit) {
        shouldSendCreditAlert = true;
        isOverdraftAlert = false;
      }
    }

    // TASK-46-06: Tax Exemption Engine (0% Sales Tax for ST-120 certified users & Official NYS DTF Legend)
    const isUserTaxExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt || (orderData as any).tax_exempt);
    const taxId = user?.profile?.tax_id || user?.tax_id || (orderData as any).tax_id || null;

    let appliedTaxAmount = 0.00;
    let appliedTaxRate = 0.00;
    let appliedTaxExempt = false;
    let appliedTaxLegend: string | null = null;

    if (isUserTaxExempt) {
      appliedTaxAmount = 0.00;
      appliedTaxRate = 0.00;
      appliedTaxExempt = true;
      appliedTaxLegend = `Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business. NY Resale / Tax ID: ${taxId || 'N/A'}`;
    } else {
      appliedTaxAmount = Number((orderData as any).tax_amount || 0);
      appliedTaxRate = Number((orderData as any).tax_rate || 0);
      appliedTaxExempt = false;
      appliedTaxLegend = null;
    }

    const savedOrderId = await this.dataSource.transaction(async (manager) => {
      const orderToCreate = manager.create(Order, {
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
        zelle_receipt_url: appliedZelleReceiptUrl,
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

      const savedResult = await manager.save(Order, orderToCreate);
      const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;

      if (validatedItems.length > 0) {
        const orderItems = validatedItems.map((item: any) => manager.create(OrderItem, {
          product_id: item.product_id,
          price_at_time: item.price_at_time,
          quantity: item.quantity,
          order_id: savedOrder.id,
        }));
        await manager.save(OrderItem, orderItems);
      }

      return savedOrder.id;
    });

    const createdOrder = await this.findOne(savedOrderId);

    // TASK-37-01: Disparar recibo de compra al cliente de forma asíncrona no bloqueante
    if (this.mailService && typeof this.mailService.sendOrderReceipt === 'function' && user?.email) {
      this.mailService.sendOrderReceipt(createdOrder, user.email).catch(err => {
        console.error('[OrdersService] Error sending order receipt email:', err?.message || err);
      });
    }

    // TASK-37-02: Disparar alerta a producción y operaciones de forma asíncrona no bloqueante
    if (this.mailService && typeof this.mailService.sendAdminNewOrderAlert === 'function') {
      const clientName = user?.profile?.full_name || 'Cliente Mayorista';
      this.mailService.sendAdminNewOrderAlert(createdOrder, user?.email, clientName).catch(err => {
        console.error('[OrdersService] Error sending admin new order alert email:', err?.message || err);
      });
    }

    if (shouldSendCreditAlert && this.mailService && user?.email) {
      const clientName = user.profile?.full_name || 'Cliente B2B';
      this.mailService.sendCreditAlert(
        user.email,
        clientName,
        prospectiveCreditTotal,
        clientCreditLimit,
        isOverdraftAlert,
      ).catch(err => {
        console.error('[OrdersService] Error sending credit alert email:', err?.message || err);
      });
    }

    return createdOrder;
  }

  async updateStatus(id: string, status: string, userRole?: string): Promise<Order> {
    const order = await this.findOne(id);
    this.validateStatusTransition(order.status, status, userRole);
    order.status = status;
    return this.orderRepository.save(order);
  }

  async assignDelivery(id: string, deliveryUserId: string): Promise<Order> {
    const order = await this.findOne(id);
    order.delivery_user_id = deliveryUserId;
    return this.orderRepository.save(order);
  }

  async update(id: string, updateData: any, userRole?: string): Promise<Order> {
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
    if (updateData.zelle_receipt_url !== undefined) {
      order.zelle_receipt_url = updateData.zelle_receipt_url;
    }
    if (updateData.zelle_reference !== undefined) {
      order.zelle_reference = updateData.zelle_reference;
    }
    if (updateData.pending_balance !== undefined) {
      order.pending_balance = Number(updateData.pending_balance);
    }

    if (motivo) {
      const originalLines = (order.items || []).map(item => 
        `${item.quantity} Unidades de ${item.product?.name || 'Producto'}, precio unitario: ${item.price_at_time}, subtotal: ${(item.quantity * item.price_at_time).toFixed(2)}`
      ).join('; ');
      
      const auditLog = `El pedido ha sido modificado por: ${motivo}, pedido original: ${originalLines}, total original: ${Number(order.total || 0).toFixed(2)}. Modificado el ${new Date().toLocaleString('es-ES')}.\n`;
      
      order.notes = auditLog + (order.notes || '');
    }

    if (delivery_date) order.delivery_date = delivery_date;
    if (address_id) order.address_id = address_id;
    
    if (items && Array.isArray(items)) {
      order.items = [];
      await this.orderItemRepository.delete({ order_id: id });
      
      const result = await this.calculateOrderPricesAndTotal(order.user_id, items);
      
      const newItems = result.validatedItems.map((item: any) => ({
        product_id: item.product_id,
        price_at_time: item.price_at_time,
        quantity: item.quantity,
        order_id: id,
      }));
      
      order.items = await this.orderItemRepository.save(newItems);
      order.total = result.total;
    } else if (total !== undefined) {
      order.total = total;
    }
    
    await this.orderRepository.save(order);
    return this.findOne(id);
  }

  async approveZellePayment(orderId: string): Promise<Order> {
    const order = await this.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
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

  async rejectZellePayment(orderId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    order.payment_status = 'unpaid';
    order.status = 'Cancelado';
    if (reason) {
      order.notes = `[Rechazo Zelle]: ${reason}\n${order.notes || ''}`;
    }
    return this.orderRepository.save(order);
  }

  /**
   * TASK-48-04: Liquidación por lotes de facturas a crédito.
   * Aplica FeeCalculatorService de acuerdo al método de pago y libera cupo en tiempo real.
   */
  async settleBatch(
    userId: string,
    userRole: string,
    dto: { order_ids: string[]; payment_method: string; payment_reference?: string },
  ) {
    if (!dto || !Array.isArray(dto.order_ids) || dto.order_ids.length === 0) {
      throw new BadRequestException('Debe proporcionar una lista no vacía de order_ids');
    }

    if (!dto.payment_method || typeof dto.payment_method !== 'string' || !dto.payment_method.trim()) {
      throw new BadRequestException('El método de pago es obligatorio para la liquidación');
    }

    const cleanMethod = dto.payment_method.trim().toLowerCase();
    const orders = await this.orderRepository.find({
      where: { id: In(dto.order_ids) },
      relations: ['items'],
    });

    if (orders.length !== dto.order_ids.length) {
      const foundIds = orders.map((o) => o.id);
      const missing = dto.order_ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(`No se encontraron las órdenes: ${missing.join(', ')}`);
    }

    for (const order of orders) {
      if (userRole !== 'admin' && order.user_id !== userId) {
        throw new ForbiddenException(`No tiene autorización para liquidar la orden #${order.id}`);
      }
      if (order.status === 'cancelled' || order.status === 'Cancelado') {
        throw new BadRequestException(`La orden #${order.id.slice(0, 8)} está cancelada y no puede ser liquidada`);
      }
      if (order.payment_status === 'paid') {
        throw new BadRequestException(`La orden #${order.id.slice(0, 8)} ya se encuentra pagada`);
      }
    }

    // Cálculo determinista del fee vía FeeCalculatorService
    const feeCalc = this.feeCalculatorService || new FeeCalculatorService();
    const orderNetDebts = orders.map((o) =>
      Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0))
    );
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

    // Calcular nuevo cupo disponible tras la liberación de las facturas
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

  /**
   * TASK-48-05: Top de SKUs más comprados por el cliente para reorden 1-clic.
   */
  async getFrequentProducts(userId: string): Promise<any[]> {
    if (!userId) {
      throw new BadRequestException('UserId es obligatorio');
    }

    const orders = await this.orderRepository.find({
      where: { user_id: userId },
      relations: ['items', 'items.product'],
      order: { created_at: 'DESC' },
    });

    const validOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'Cancelado');

    const productCountMap = new Map<number, { product: Product; count: number; totalQuantity: number; lastOrdered: Date }>();

    for (const order of validOrders) {
      for (const item of (order.items || [])) {
        if (!item.product) continue;
        const pId = item.product.id;
        const existing = productCountMap.get(pId);
        if (existing) {
          existing.count += 1;
          existing.totalQuantity += Number(item.quantity) || 1;
          if (new Date(order.created_at) > existing.lastOrdered) {
            existing.lastOrdered = new Date(order.created_at);
          }
        } else {
          productCountMap.set(pId, {
            product: item.product,
            count: 1,
            totalQuantity: Number(item.quantity) || 1,
            lastOrdered: new Date(order.created_at),
          });
        }
      }
    }

    let results: Array<any> = Array.from(productCountMap.values())
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

  validateMutationCutoff(order: Order, referenceDate?: Date): void {
    const now = referenceDate || new Date();

    const allowedStatuses = ['pending', 'confirmed', 'pedido enviado'];
    const currentStatus = (order.status || '').toLowerCase().trim();
    if (!allowedStatuses.includes(currentStatus)) {
      throw new BadRequestException('Solo se pueden modificar órdenes en estado pending o confirmed');
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
    const nyNowHour = parseInt(nowTimeParts.find(p => p.type === 'hour')?.value || '0', 10);

    const orderCreatedAt = order.created_at ? new Date(order.created_at) : now;
    const orderParts = nyDateFormatter.formatToParts(orderCreatedAt);
    const yrOrd = orderParts.find(p => p.type === 'year')?.value || '1970';
    const moOrd = orderParts.find(p => p.type === 'month')?.value || '01';
    const daOrd = orderParts.find(p => p.type === 'day')?.value || '01';
    const nyOrderDateStr = `${yrOrd}-${moOrd}-${daOrd}`;

    if (nyNowDateStr > nyOrderDateStr) {
      throw new BadRequestException('Corte de producción superado. No se pueden modificar items');
    }

    if (nyNowHour >= 12) {
      throw new BadRequestException('Corte de producción superado. No se pueden modificar items');
    }
  }

  async mutateOrderItems(
    id: string,
    body: {
      items?: any[];
      zelle_receipt_url?: string;
      zelle_reference?: string;
      reason?: string;
      replaceItems?: boolean;
      referenceDate?: Date | string;
    },
    userId?: string,
    userRole?: string,
    referenceDateOverride?: Date,
  ): Promise<Order> {
    const order = await this.findOne(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    if (userRole !== 'admin' && userId && order.user_id !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar esta orden');
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
      let itemsToCalculate: Array<{ productId: number; quantity: number }> = [];

      if (body.replaceItems === true) {
        itemsToCalculate = body.items.map((i: any) => ({
          productId: Number(i.productId || i.product_id),
          quantity: Number(i.quantity),
        })).filter(i => i.quantity > 0);
      } else {
        const itemMap = new Map<number, number>();
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
          } else {
            itemMap.set(pid, qty);
          }
        }
        itemsToCalculate = Array.from(itemMap.entries()).map(([productId, quantity]) => ({
          productId,
          quantity,
        }));
      }

      if (itemsToCalculate.length === 0) {
        throw new BadRequestException('La orden debe contener al menos un producto');
      }

      const result = await this.calculateOrderPricesAndTotal(order.user_id, itemsToCalculate);

      await this.orderItemRepository.delete({ order_id: order.id });

      const newOrderItems = result.validatedItems.map((item: any) => ({
        product_id: item.product_id,
        price_at_time: item.price_at_time,
        quantity: item.quantity,
        order_id: order.id,
      }));
      order.items = await this.orderItemRepository.save(newOrderItems);

      const itemsTotal = result.total;
      const oldTotal = Number(order.total) || 0;

      const packagingFee = Math.round(itemsTotal * 0.035 * 100) / 100;
      let packagingDiscount = 0;
      if (
        order.payment_method === 'zelle' ||
        order.payment_method === 'credit' ||
        order.payment_method === 'check' ||
        order.payment_method === 'cash'
      ) {
        packagingDiscount = packagingFee;
      }

      const feeMethod = (order.payment_method === 'stripe' || order.payment_method === 'card')
        ? 'STRIPE_CARD'
        : (order.payment_method === 'ach' || order.payment_method === 'ach_debit')
          ? 'ACH'
          : String(order.payment_method || '').toUpperCase();
      const feeAmount = FeeCalculatorService.calculateFee(itemsTotal, feeMethod);

      let appliedTaxAmount = 0.00;
      if (order.tax_exempt) {
        appliedTaxAmount = 0.00;
      } else if (order.tax_rate && Number(order.tax_rate) > 0) {
        appliedTaxAmount = Math.round(itemsTotal * (Number(order.tax_rate) / 100) * 100) / 100;
      }

      const deliveryFee = Number(order.delivery_fee_charged) || 0;
      const newTotal = Math.round((itemsTotal + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100;

      order.packaging_fee = packagingFee;
      order.packaging_discount = packagingDiscount;
      order.fee_amount = feeAmount;
      order.fee_method = order.fee_method || feeMethod;
      order.tax_amount = appliedTaxAmount;
      order.total = newTotal;

      const delta = Math.round((newTotal - oldTotal) * 100) / 100;

      if (delta < 0) {
        const refundAmount = Math.abs(delta);
        if (
          (order.payment_method === 'stripe' || order.payment_method === 'card') &&
          (order.payment_status === 'paid' || order.stripe_payment_id)
        ) {
          if (this.paymentsService && typeof this.paymentsService.createRefund === 'function') {
            try {
              await this.paymentsService.createRefund({
                orderId: order.id,
                amount: refundAmount,
                reason: body.reason || 'Ajuste de orden pre-corte (disminución de items)',
              });
            } catch (refErr: any) {
              console.warn(`[OrdersService] createRefund error: ${refErr?.message || refErr}. Fallback a nota de crédito.`);
              order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
              order.refund_reason = `Saldo a favor / Nota de crédito: $${refundAmount.toFixed(2)}`;
            }
          } else {
            order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
            order.refund_reason = `Saldo a favor / Nota de crédito: $${refundAmount.toFixed(2)}`;
          }
        } else {
          const creditNote = `[SALDO A FAVOR] Crédito de $${refundAmount.toFixed(2)} registrado por ajuste de orden.`;
          order.notes = order.notes ? `${order.notes}\n${creditNote}` : creditNote;
          order.refund_reason = creditNote;
          order.refunded_amount = Math.round(((Number(order.refunded_amount) || 0) + refundAmount) * 100) / 100;
        }
        order.pending_balance = 0;
      } else if (delta > 0) {
        if (order.payment_status === 'paid') {
          order.pending_balance = delta;
          order.payment_status = 'partially_paid';
          const balanceNote = `[BALANCE PENDIENTE] Saldo pendiente de pago por ajuste: $${delta.toFixed(2)}.`;
          order.notes = order.notes ? `${order.notes}\n${balanceNote}` : balanceNote;
        } else {
          order.pending_balance = newTotal;
        }
      }
    }

    await this.orderRepository.save(order);
    return this.findOne(order.id);
  }
}
