import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {
    if (STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20' as any,
      });
      this.logger.log('Stripe client initialized successfully.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set. Payment intents will operate in mock mode.');
    }
  }

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    orderId?: string;
    customerEmail?: string;
    description?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string; amount: number }> {
    const { amount, currency = 'usd', orderId, customerEmail, description } = data;
    
    if (!amount || amount < 0.5) {
      throw new BadRequestException('Amount must be at least $0.50 USD');
    }

    const amountInCents = Math.round(amount * 100);

    if (!this.stripe) {
      return {
        clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
        paymentIntentId: `pi_mock_${Date.now()}`,
        amount,
      };
    }

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        description: description || `Order ${orderId || 'Checkout'} - Jhoanes Wholesale`,
        receipt_email: customerEmail,
        metadata: {
          orderId: orderId || '',
          customerEmail: customerEmail || '',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: intent.client_secret || '',
        paymentIntentId: intent.id,
        amount,
      };
    } catch (err: any) {
      this.logger.error(`Stripe error: ${err.message}`);
      throw new BadRequestException(`Stripe error: ${err.message}`);
    }
  }

  async createSettlementLink(data: {
    orderId?: string;
    clientId?: string;
    clientEmail?: string;
  }): Promise<{
    url: string;
    clientSecret?: string;
    paymentIntentId?: string;
    amount?: number;
    totalDebt?: number;
    orderId?: string;
    orderCount?: number;
    customerEmail?: string;
  }> {
    const { orderId, clientId, clientEmail } = data;

    // Single order settlement
    if (orderId) {
      const order = await this.ordersService.findOne(orderId);
      if (!order) throw new NotFoundException(`Order ${orderId} not found`);

      const totalNum = Number(order.total) || 0;
      const refundedNum = Number(order.refunded_amount) || 0;
      const balance = Math.max(0, Math.round((totalNum - refundedNum) * 100) / 100);

      if (balance <= 0) {
        throw new BadRequestException(`Order ${orderId} is already fully paid or refunded`);
      }

      const email = order.user?.email || clientEmail || 'client@jhoanes.com';

      // Create PaymentIntent for in-app Stripe Elements checkout
      const intent = await this.createPaymentIntent({
        amount: balance,
        orderId: order.id,
        customerEmail: email,
        description: `Liquidación Factura #${order.id.slice(0, 8)} - Panadería Jhoanes Wholesale`,
      });

      let checkoutUrl = `https://testing.jhoanes.com/orders/${order.id}`;

      if (this.stripe) {
        try {
          const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            client_reference_id: order.id,
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: `Liquidación Factura #${order.id.slice(0, 8)}`,
                    description: `Pago de cartera B2B - Pedido #${order.id}`,
                  },
                  unit_amount: Math.round(balance * 100),
                },
                quantity: 1,
              },
            ],
            metadata: {
              orderId: order.id,
              type: 'settlement',
              customerEmail: email,
            },
            success_url: `https://testing.jhoanes.com/orders/${order.id}?settled=true`,
            cancel_url: `https://testing.jhoanes.com/orders/${order.id}?cancelled=true`,
          });
          if (session.url) checkoutUrl = session.url;
        } catch (sessionErr: any) {
          this.logger.warn(`Could not create Stripe Checkout Session: ${sessionErr.message}`);
        }
      }

      return {
        url: checkoutUrl,
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.paymentIntentId,
        amount: balance,
        orderId: order.id,
        customerEmail: email,
      };
    }

    // Client-level portfolio debt settlement
    let user: any = null;
    if (clientId) {
      user = await this.usersService.findOne(clientId);
    } else if (clientEmail) {
      user = await this.usersService.findByEmail(clientEmail);
      if (user) {
        user = await this.usersService.findOne(user.id);
      }
    }

    if (!user) {
      throw new BadRequestException('Either orderId, clientId, or clientEmail must be provided');
    }

    const pendingOrders = (user.orders || []).filter(
      (o: any) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado'
    );

    const totalDebt = pendingOrders.reduce((sum: number, o: any) => {
      const net = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
      return sum + net;
    }, 0);

    const roundedDebt = Math.round(totalDebt * 100) / 100;
    if (roundedDebt <= 0) {
      return {
        url: `https://testing.jhoanes.com/orders`,
        totalDebt: 0,
        orderCount: 0,
        customerEmail: user.email,
      };
    }

    let checkoutUrl = `https://testing.jhoanes.com/orders?pay_debt=${user.id}`;
    if (this.stripe) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: user.email,
          client_reference_id: user.id,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Liquidación Cartera B2B - ${user.profile?.full_name || user.email}`,
                  description: `Liquidación de ${pendingOrders.length} orden(es) de crédito comercial pendientes`,
                },
                unit_amount: Math.round(roundedDebt * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId: user.id,
            type: 'account_settlement',
            orderIds: pendingOrders.map((o: any) => o.id).join(','),
          },
          success_url: `https://testing.jhoanes.com/orders?settled=true`,
          cancel_url: `https://testing.jhoanes.com/orders?cancelled=true`,
        });
        if (session.url) checkoutUrl = session.url;
      } catch (err: any) {
        this.logger.warn(`Stripe session error for account settlement: ${err.message}`);
      }
    }

    return {
      url: checkoutUrl,
      totalDebt: roundedDebt,
      orderCount: pendingOrders.length,
      customerEmail: user.email,
    };
  }

  async createRefund(data: {
    orderId: string;
    amount?: number;
    reason?: string;
  }): Promise<{
    success: boolean;
    orderId: string;
    refundedAmount: number;
    totalRefunded: number;
    paymentStatus: string;
    reason: string;
  }> {
    const { orderId, amount, reason } = data;
    const order = await this.ordersService.findOne(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const orderTotal = Number(order.total) || 0;
    const currentRefunded = Number(order.refunded_amount) || 0;
    const maxRefundable = Math.max(0, Math.round((orderTotal - currentRefunded) * 100) / 100);

    if (maxRefundable <= 0) {
      throw new BadRequestException(`Order ${orderId} has already been fully refunded`);
    }

    const refundAmount = (amount !== undefined && amount > 0)
      ? Math.min(Math.round(Number(amount) * 100) / 100, maxRefundable)
      : maxRefundable;

    // Call Stripe if Stripe client is initialized and order has a Stripe charge/payment intent
    if (this.stripe && order.stripe_payment_id) {
      try {
        const stripeReason = ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason || '')
          ? (reason as any)
          : 'requested_by_customer';

        await this.stripe.refunds.create({
          payment_intent: order.stripe_payment_id,
          amount: Math.round(refundAmount * 100),
          reason: stripeReason,
          metadata: {
            orderId: order.id,
            customReason: reason || 'Ajuste administrativo comercial',
          },
        });
        this.logger.log(`Stripe refund created for order ${order.id}: $${refundAmount}`);
      } catch (err: any) {
        this.logger.warn(`Stripe refund call warning: ${err.message}. Applying local reconciliation.`);
      }
    }

    const newTotalRefunded = Math.round((currentRefunded + refundAmount) * 100) / 100;
    const isFull = newTotalRefunded >= orderTotal;
    const newPaymentStatus = isFull ? 'refunded' : 'partially_refunded';
    const auditReason = reason || (isFull ? 'Reembolso total emitido' : 'Reembolso parcial emitido');

    await this.ordersService.update(order.id, {
      payment_status: newPaymentStatus,
      refunded_amount: newTotalRefunded,
      refund_reason: auditReason,
    }, 'admin');

    this.logger.log(`Order ${order.id} refunded by $${refundAmount}. New status: ${newPaymentStatus}`);

    return {
      success: true,
      orderId: order.id,
      refundedAmount: refundAmount,
      totalRefunded: newTotalRefunded,
      paymentStatus: newPaymentStatus,
      reason: auditReason,
    };
  }

  async handleWebhook(rawBody: any, signature?: string): Promise<{ received: boolean; status: string }> {
    let event: Stripe.Event;

    if (this.stripe && STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        this.logger.error(`Webhook signature verification failed: ${err.message}`);
        throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
      }
    } else {
      event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    }

    this.logger.log(`Received Stripe Webhook event: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data?.object as Stripe.PaymentIntent;
      const orderId = paymentIntent?.metadata?.orderId;
      if (orderId) {
        this.logger.log(`Reconciling order ${orderId} as PAID via Webhook.`);
        await this.ordersService.update(orderId, {
          payment_status: 'paid',
          stripe_payment_id: paymentIntent.id,
        }, 'admin');
      }
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data?.object as Stripe.Checkout.Session;
      const orderId = session?.metadata?.orderId || session?.client_reference_id;
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      if (orderId && session.metadata?.type === 'settlement') {
        this.logger.log(`Checkout session completed for settlement of order ${orderId}`);
        await this.ordersService.update(orderId, {
          payment_status: 'paid',
          stripe_payment_id: paymentIntentId,
        }, 'admin');
      } else if (session.metadata?.type === 'account_settlement' && session.metadata?.orderIds) {
        const orderIds = session.metadata.orderIds.split(',').filter(Boolean);
        for (const oId of orderIds) {
          try {
            await this.ordersService.update(oId, {
              payment_status: 'paid',
              stripe_payment_id: paymentIntentId,
            }, 'admin');
          } catch (e: any) {
            this.logger.warn(`Failed reconciling batch settlement for order ${oId}: ${e.message}`);
          }
        }
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data?.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;
      const amountRefunded = charge.amount_refunded / 100;
      this.logger.log(`Charge refunded webhook for intent ${paymentIntentId}: $${amountRefunded}`);

      if (paymentIntentId) {
        try {
          const orders = await this.ordersService.findAll();
          const target = orders.find((o) => o.stripe_payment_id === paymentIntentId);
          if (target) {
            const isFull = charge.refunded || amountRefunded >= Number(target.total);
            await this.ordersService.update(target.id, {
              payment_status: isFull ? 'refunded' : 'partially_refunded',
              refunded_amount: amountRefunded,
            }, 'admin');
          }
        } catch (e: any) {
          this.logger.warn(`Failed handling charge.refunded webhook: ${e.message}`);
        }
      }
    }

    return { received: true, status: event.type };
  }
}
