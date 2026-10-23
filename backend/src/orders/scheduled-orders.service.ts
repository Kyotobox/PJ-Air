import { Injectable, NotFoundException, ForbiddenException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledOrder } from './scheduled-order.entity';
import { OrdersService } from './orders.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class ScheduledOrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledOrdersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ScheduledOrder)
    private readonly scheduledRepo: Repository<ScheduledOrder>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly ordersService: OrdersService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    this.logger.log('ScheduledOrdersService initialized.');
    // Periodic check every 15 minutes for standing order dispatch window
    this.timer = setInterval(() => {
      this.checkAndAutoDispatch().catch((err) => {
        this.logger.error(`Error in automated standing order dispatch: ${err.message}`);
      });
    }, 15 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async create(userId: string, data: Partial<ScheduledOrder>): Promise<ScheduledOrder> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException('User not found');

    const id = `sched_${Date.now()}_${randomUUID().slice(0, 8)}`;
    
    // Parse items to compute estimated total if not provided
    let computedTotal = Number(data.total) || 0;
    if (!computedTotal && data.items_json) {
      try {
        const items = JSON.parse(data.items_json);
        if (Array.isArray(items)) {
          computedTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
        }
      } catch (_) {}
    }

    const scheduled = this.scheduledRepo.create({
      id,
      user_id: userId,
      title: data.title || 'Suscripción Semanal Mayorista',
      items_json: data.items_json || '[]',
      delivery_days_json: data.delivery_days_json || '["mon","wed","fri"]',
      delivery_time: data.delivery_time || '08:00',
      delivery_type: data.delivery_type || 'saved',
      address_id: data.address_id || undefined,
      payment_method: data.payment_method || (user.account_type === 'credit' ? 'credit' : 'stripe'),
      active: data.active !== undefined ? data.active : true,
      total: Math.round(computedTotal * 100) / 100,
    });

    const saved = (await this.scheduledRepo.save(scheduled)) as ScheduledOrder;
    this.logger.log(`Created ScheduledOrder ${saved.id} for user ${userId}`);

    // TASK-37-03: Confirmación al cliente de su suscripción semanal fija
    if (this.mailService && user?.email) {
      const clientName = user.profile?.full_name || user.email;
      this.mailService.sendStandingOrderConfirmation(
        saved,
        user.email,
        clientName,
      ).catch(err => {
        this.logger.warn(`Error sending standing order confirmation email: ${err?.message || err}`);
      });
    }

    return saved;
  }

  async findAll(): Promise<ScheduledOrder[]> {
    return this.scheduledRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<ScheduledOrder[]> {
    return this.scheduledRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ScheduledOrder> {
    const item = await this.scheduledRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!item) throw new NotFoundException(`ScheduledOrder ${id} not found`);
    return item;
  }

  async update(id: string, userId: string, isAdmin: boolean, data: Partial<ScheduledOrder>): Promise<ScheduledOrder> {
    const existing = await this.findOne(id);
    if (!isAdmin && existing.user_id !== userId) {
      throw new ForbiddenException('Cannot edit another user subscription');
    }

    if (data.items_json) {
      existing.items_json = data.items_json;
      try {
        const items = JSON.parse(data.items_json);
        if (Array.isArray(items)) {
          existing.total = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
        }
      } catch (_) {}
    }

    if (data.title !== undefined) existing.title = data.title;
    if (data.delivery_days_json !== undefined) existing.delivery_days_json = data.delivery_days_json;
    if (data.delivery_time !== undefined) existing.delivery_time = data.delivery_time;
    if (data.delivery_type !== undefined) existing.delivery_type = data.delivery_type;
    if (data.address_id !== undefined) existing.address_id = data.address_id;
    if (data.payment_method !== undefined) existing.payment_method = data.payment_method;
    if (data.active !== undefined) existing.active = data.active;
    if (data.total !== undefined) existing.total = Number(data.total);

    return this.scheduledRepo.save(existing);
  }

  async remove(id: string, userId: string, isAdmin: boolean): Promise<{ success: boolean; id: string }> {
    const existing = await this.findOne(id);
    if (!isAdmin && existing.user_id !== userId) {
      throw new ForbiddenException('Cannot delete another user subscription');
    }
    await this.scheduledRepo.delete(id);
    return { success: true, id };
  }

  /**
   * Generates orders for active subscriptions whose delivery day matches today (or forced day).
   */
  async executeScheduledOrders(forcedDay?: string): Promise<{
    processed: number;
    generatedOrders: any[];
    errors: any[];
  }> {
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const currentDay = (forcedDay || dayMap[now.getDay()]).toLowerCase();

    const activeSubscriptions = await this.scheduledRepo.find({
      where: { active: true },
      relations: ['user'],
    });

    const generatedOrders: any[] = [];
    const errors: any[] = [];

    for (const sub of activeSubscriptions) {
      try {
        let days: string[] = [];
        try {
          days = JSON.parse(sub.delivery_days_json);
        } catch (_) {
          days = ['mon', 'wed', 'fri'];
        }

        const isMatchingDay = days.some(d => d.toLowerCase().startsWith(currentDay.slice(0, 3)));
        if (!isMatchingDay) continue;

        // Prevent generating duplicate orders for the same day (unless forced)
        if (!forcedDay && sub.last_run) {
          const lastDate = new Date(sub.last_run).toDateString();
          if (lastDate === now.toDateString()) {
            this.logger.debug(`Subscription ${sub.id} already ran today.`);
            continue;
          }
        }

        // Parse items
        let items: any[] = [];
        try {
          items = JSON.parse(sub.items_json);
        } catch (_) {}

        if (!items || items.length === 0) continue;

        // Graceful handling of deactivated/deleted products
        const validItems: any[] = [];
        const omittedProducts: string[] = [];

        for (const item of items) {
          const pId = Number(item.productId || item.id);
          if (isNaN(pId) || pId <= 0) {
            validItems.push(item);
            continue;
          }
          const prod = await this.productRepo.findOne({ where: { id: pId } });
          if (!prod || prod.is_deleted) {
            omittedProducts.push(item.productName || `ID ${pId}`);
          } else {
            validItems.push(item);
          }
        }

        if (validItems.length === 0) {
          this.logger.warn(`Subscription ${sub.id} skipped: todos los productos están desactivados (${omittedProducts.join(', ')}).`);
          errors.push({
            scheduledId: sub.id,
            userEmail: sub.user?.email,
            title: sub.title,
            error: `Omitida: Todos los productos de la suscripción están desactivados (${omittedProducts.join(', ')})`,
          });
          continue;
        }

        let warningNotice = '';
        if (omittedProducts.length > 0) {
          warningNotice = ` [Aviso: Se omitieron productos desactivados del catálogo: ${omittedProducts.join(', ')}]`;
        }

        // Build order payload
        const orderPayload = {
          items: validItems.map(item => ({
            productId: item.productId || item.id,
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
          })),
          deliveryType: sub.delivery_type || 'saved',
          addressId: sub.address_id || undefined,
          deliveryAddressText: sub.delivery_type === 'pickup' ? 'Pick Up en Panadería' : undefined,
          deliveryDate: now.toISOString().split('T')[0],
          notes: `[Standing Order / Suscripción Mayorista] Recurrencia: ${sub.title}${warningNotice}`,
        };

        const createdOrder = await this.ordersService.create(sub.user_id, orderPayload);

        // Check if subscription simulates a failed card payment
        const isSimulatedDecline = sub.payment_method === 'pm_card_chargeDeclinedInsufficientFunds' || sub.payment_method === 'failed_card';
        if (isSimulatedDecline) {
          // Mark order with payment_status: 'failed'
          await this.ordersService.update(createdOrder.id, {
            payment_status: 'failed',
          }, 'admin');

          // Send payment failed alert email
          if (sub.user?.email) {
            await this.mailService.sendPaymentFailedAlert(
              sub.user.email,
              sub.user.profile?.full_name || sub.user.email,
              createdOrder.id,
              createdOrder.total,
              'Tarjeta de crédito rechazada por fondos insuficientes (pm_card_chargeDeclinedInsufficientFunds)'
            ).catch(() => {});
          }

          this.logger.warn(`Cobro automático fallido para orden ${createdOrder.id} de la suscripción ${sub.id}. Cron continúa con aislamiento de fallo.`);

          errors.push({
            scheduledId: sub.id,
            orderId: createdOrder.id,
            userEmail: sub.user?.email,
            payment_status: 'failed',
            error: 'Tarjeta rechazada por fondos insuficientes (pm_card_chargeDeclinedInsufficientFunds)',
          });
        } else {
          generatedOrders.push({
            scheduledId: sub.id,
            orderId: createdOrder.id,
            userEmail: sub.user?.email,
            total: createdOrder.total,
            status: createdOrder.status,
            payment_status: createdOrder.payment_status,
          });
        }
        
        // Update subscription last_run
        sub.last_run = now;
        await this.scheduledRepo.save(sub);

        this.logger.log(`Generated automatic order ${createdOrder.id} for scheduled subscription ${sub.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to dispatch subscription ${sub.id}: ${err.message}`);
        errors.push({ scheduledId: sub.id, error: err.message });
      }
    }

    return {
      processed: generatedOrders.length,
      generatedOrders,
      errors,
    };
  }

  /**
   * Forecasts bakery production quantities and scheduled orders for the next N days.
   */
  async getProjections(daysAhead = 7): Promise<any[]> {
    const activeSubs = await this.scheduledRepo.find({
      where: { active: true },
      relations: ['user'],
    });

    const dayCodes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayNamesEs = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const now = new Date();
    const projections = [];

    // Pre-load all products to have clean product names
    const allProducts = await this.productRepo.find();
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() + i);
      const dayIndex = targetDate.getDay();
      const dayCode = dayCodes[dayIndex];
      const dateStr = targetDate.toISOString().split('T')[0];

      let orderCount = 0;
      let estimatedRevenue = 0;
      const productTotals: Record<string, { id: string; name: string; quantity: number }> = {};
      const matchingSubs: any[] = [];

      for (const sub of activeSubs) {
        let days: string[] = [];
        try {
          days = JSON.parse(sub.delivery_days_json);
        } catch (_) {
          days = [];
        }

        const matches = days.some(d => d.toLowerCase().startsWith(dayCode.slice(0, 3)));
        if (matches) {
          orderCount++;
          estimatedRevenue += Number(sub.total) || 0;
          matchingSubs.push({
            id: sub.id,
            clientName: sub.user?.email || 'Cliente B2B',
            title: sub.title,
            deliveryTime: sub.delivery_time,
            total: sub.total,
          });

          try {
            const items = JSON.parse(sub.items_json);
            for (const item of items) {
              const pId = item.productId || item.id;
              const prod = productMap.get(pId);
              const pName = item.productName || prod?.name || `Producto ${pId.slice(0, 6)}`;
              const qty = Number(item.quantity) || 1;

              if (!productTotals[pId]) {
                productTotals[pId] = { id: pId, name: pName, quantity: 0 };
              }
              productTotals[pId].quantity += qty;
            }
          } catch (_) {}
        }
      }

      projections.push({
        date: dateStr,
        dayName: dayNamesEs[dayIndex],
        dayCode,
        orderCount,
        estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
        standingOrders: matchingSubs,
        productionList: Object.values(productTotals),
      });
    }

    return projections;
  }

  private async checkAndAutoDispatch() {
    const hour = new Date().getHours();
    // Typical wholesale dispatch window (e.g. 05:00 AM)
    if (hour === 5) {
      await this.executeScheduledOrders();
    }
  }
}
