import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { XeroService } from '../xero/xero.service';

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
    @Inject(forwardRef(() => XeroService))
    private xeroService?: XeroService,
  ) {}

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

    let calculatedTotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const productId = item.productId || item.product_id;
      const product = await this.productRepository.findOne({ where: { id: Number(productId) } });
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

  async findInRange(startDate: string, endDate: string, userId?: string, filterBy: 'created_at' | 'delivery_date' = 'created_at'): Promise<Order[]> {
    console.log('findInRange called with:', { startDate, endDate, userId, filterBy });
    
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
      .leftJoinAndSelect('order.address', 'address');

    if (filterBy === 'delivery_date') {
      qb.where('order.delivery_date >= :rawStart', { rawStart })
        .andWhere('order.delivery_date <= :rawEnd', { rawEnd });
    } else {
      qb.where('order.created_at >= :start', { start: queryStart })
        .andWhere('order.created_at <= :end', { end: queryEnd });
    }

    if (userId) {
      qb.andWhere('order.user_id = :userId', { userId });
    }

    qb.orderBy('order.created_at', 'DESC');
    
    const allMatching = await qb.getMany();
    
    if (filterBy === 'delivery_date') {
      return allMatching;
    }

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
      relations: ['items', 'items.product', 'items.product.category', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address'],
      order: { created_at: 'DESC' },
      take: 100,
      relationLoadStrategy: 'query'
    });
  }

  async findByUser(userId: string): Promise<Order[]> {
    return this.orderRepository.find({ 
      where: { user_id: userId },
      relations: ['items', 'items.product', 'address'],
      order: { created_at: 'DESC' },
      relationLoadStrategy: 'query'
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['items', 'items.product', 'items.product.category', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address'],
      relationLoadStrategy: 'query'
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(userId: string, orderData: any): Promise<Order> {
    const { items, ...rest } = orderData;
    const { deliveryDate, paymentDueDate, addressId, deliveryType, deliveryAddressText, ...otherData } = rest;

    let finalTotal = 0;
    let validatedItems: any[] = [];

    if (items && items.length > 0) {
      const result = await this.calculateOrderPricesAndTotal(userId, items);
      validatedItems = result.validatedItems;
      finalTotal = result.total;
    }

    const orderToCreate = this.orderRepository.create({
      ...otherData,
      delivery_date: deliveryDate,
      payment_due_date: paymentDueDate,
      address_id: addressId || null,
      delivery_type: deliveryType || 'saved',
      delivery_address_text: deliveryAddressText || null,
      user_id: userId,
      total: finalTotal,
      payment_gateway: rest.paymentGateway || rest.payment_gateway || 'bank_transfer',
      payment_transaction_id: rest.paymentTransactionId || rest.payment_transaction_id || null,
      payment_status: rest.paymentStatus || rest.payment_status || 'unpaid',
    });
    
    const savedResult = await this.orderRepository.save(orderToCreate);
    const savedOrder = Array.isArray(savedResult) ? savedResult[0] : savedResult;

    if (validatedItems.length > 0) {
      const orderItems = validatedItems.map((item: any) => ({
        product_id: item.product_id,
        price_at_time: item.price_at_time,
        quantity: item.quantity,
        order_id: savedOrder.id,
      }));
      await this.orderItemRepository.save(orderItems);
    }

    return this.findOne(savedOrder.id);
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

  async updatePaymentInfo(
    orderId: string,
    data: {
      payment_status?: string;
      payment_gateway?: string;
      payment_transaction_id?: string;
    }
  ): Promise<Order> {
    const order = await this.findOne(orderId);
    if (data.payment_status) order.payment_status = data.payment_status;
    if (data.payment_gateway !== undefined) order.payment_gateway = data.payment_gateway;
    if (data.payment_transaction_id !== undefined) {
      order.payment_transaction_id = data.payment_transaction_id;
    }
    await this.orderRepository.save(order);

    // Auto-sync with Xero when marked as paid
    if (data.payment_status === 'paid' && this.xeroService) {
      this.xeroService.syncOrderToXero(orderId).catch(err => {
        console.error(`[XERO AUTO-SYNC ERROR] Order ${orderId}:`, err);
      });
    }

    return this.findOne(orderId);
  }

  async update(id: string, updateData: any, userRole?: string): Promise<Order> {
    const order = await this.findOne(id);
    const { status, total, delivery_date, address_id, motivo, items } = updateData;
    
    if (status) {
      this.validateStatusTransition(order.status, status, userRole);
      order.status = status;
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
}
