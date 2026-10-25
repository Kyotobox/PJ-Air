import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { MailService } from '../mail/mail.service';

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
    private mailService?: MailService,
  ) {}

  validateCutoffTime(deliveryDateStr?: string, referenceDate?: Date, cutoffHour = 12): void {
    if (!deliveryDateStr) return;

    const now = referenceDate || new Date();
    const nyDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const nyTimeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });

    const nyDateStr = nyDateFormatter.format(now); // YYYY-MM-DD
    const nyTimeStr = nyTimeFormatter.format(now);
    const nyHour = parseInt(nyTimeStr.split(':')[0], 10);

    const [todayY, todayM, todayD] = nyDateStr.split('-').map(Number);
    const todayNY = new Date(Date.UTC(todayY, todayM - 1, todayD));
    const tomorrowNY = new Date(todayNY);
    tomorrowNY.setUTCDate(tomorrowNY.getUTCDate() + 1);

    const yrT = tomorrowNY.getUTCFullYear();
    const moT = String(tomorrowNY.getUTCMonth() + 1).padStart(2, '0');
    const daT = String(tomorrowNY.getUTCDate()).padStart(2, '0');
    const tomorrowStr = `${yrT}-${moT}-${daT}`;

    const targetDate = deliveryDateStr.split('T')[0].split(' ')[0];

    if (targetDate < nyDateStr) {
      throw new BadRequestException('La fecha de entrega no puede ser en el pasado.');
    }
    if (targetDate === nyDateStr) {
      throw new BadRequestException('No se permiten entregas para el mismo día de la orden.');
    }

    if (nyHour >= cutoffHour && targetDate <= tomorrowStr) {
      throw new BadRequestException(
        `Corte de producción superado (${cutoffHour}:00 PM ET). No se permiten pedidos para entrega el día siguiente (${tomorrowStr}). Próxima entrega disponible a partir de 2 días hábiles.`
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
    const appliedPaymentDueDate = paymentDueDate || (rest as any).payment_due_date;
    const appliedAddressId = addressId || (rest as any).address_id || null;
    const appliedDeliveryAddressText = deliveryAddressText || (rest as any).delivery_address_text || null;
    let appliedPaymentStatus = paymentStatus || (rest as any).payment_status || 'pending';

    const appliedPaymentMethod = (rest as any).payment_method || (orderData as any).payment_method || (user?.account_type === 'credit' ? 'credit' : 'stripe');
    const rawZelleRef = (rest as any).zelle_reference || (orderData as any).zelle_reference;
    const appliedZelleReference = rawZelleRef ? String(rawZelleRef).trim() : null;

    // Validate 12:00 PM cutoff time for next-day deliveries
    this.validateCutoffTime(appliedDeliveryDate);

    // Packaging & Handling Fee (3.5%) & Direct Payment Bonus
    const packagingFee = Math.round(itemsTotal * 0.035 * 100) / 100;
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
    } else if (appliedPaymentMethod === 'stripe') {
      packagingDiscount = 0; // Gateway fee protection
    } else if (appliedPaymentMethod === 'credit') {
      packagingDiscount = packagingFee; // Credit orders do not pay gateway surcharge
    }

    const deliveryFee = appliedDeliveryType === 'pickup' ? 0 : Number(user?.delivery_fee || 0);
    const finalTotal = Math.round((itemsTotal + packagingFee - packagingDiscount + deliveryFee + Number.EPSILON) * 100) / 100;

    let shouldSendCreditAlert = false;
    let isOverdraftAlert = false;
    let prospectiveCreditTotal = 0;
    let clientCreditLimit = 0;

    // Credit gate validation for B2B accounts
    if (user?.account_type === 'credit') {
      const unpaidOrders = (user.orders || []).filter(
        (o: any) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado'
      );
      const usedCredit = unpaidOrders.reduce((acc: number, o: any) => {
        const netOrderDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
        return acc + netOrderDebt;
      }, 0);
      clientCreditLimit = Number(user.credit_limit || 0);
      prospectiveCreditTotal = Math.round((usedCredit + finalTotal + Number.EPSILON) * 100) / 100;
      const isOverride = Boolean(user.credit_override);

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
        packaging_fee: packagingFee,
        packaging_discount: packagingDiscount,
        delivery_fee_charged: deliveryFee,
        payment_status: appliedPaymentStatus,
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
}
