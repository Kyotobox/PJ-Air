import { Injectable, BadRequestException, NotFoundException, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { FeeCalculatorService } from './fee-calculator.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    @Optional()
    private readonly mailService?: MailService,
  ) {
    if (STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-06-20' as any,
      });
      this.logger.log('Stripe client initialized successfully.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set. Real payment processing requires a valid Stripe key.');
    }
  }

  async getOrCreateCustomer(userId: string): Promise<{ id: string; email: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!this.stripe) {
      throw new BadRequestException('Stripe service is not configured');
    }

    if (user.stripe_customer_id && !user.stripe_customer_id.startsWith('cus_mock_')) {
      try {
        const existing = await this.stripe.customers.retrieve(user.stripe_customer_id);
        if (!(existing as any).deleted) {
          return { id: existing.id, email: user.email };
        }
      } catch (_) {}
    }

    // Create new Stripe Customer
    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.profile?.full_name || user.email,
        phone: user.profile?.phone || undefined,
        metadata: {
          userId: user.id,
          accountType: user.account_type || 'cash',
        },
      });
      await this.usersService.updateStripeCustomerId(user.id, customer.id);
      this.logger.log(`Created Stripe Customer ${customer.id} for user ${user.id}`);
      return { id: customer.id, email: user.email };
    } catch (err: any) {
      this.logger.error(`Error creating Stripe customer: ${err.message}`);
      throw new BadRequestException(`Error creating Stripe customer: ${err.message}`);
    }
  }

  async createSetupIntent(userId: string): Promise<{ clientSecret: string; customerId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe service is not configured');
    }

    const customer = await this.getOrCreateCustomer(userId);

    try {
      const setupParams: any = {
        customer: customer.id,
        payment_method_types: ['card', 'us_bank_account'],
        usage: 'off_session',
        metadata: {
          userId,
        },
      };
      const setupIntent = await this.stripe.setupIntents.create(setupParams);
      return {
        clientSecret: setupIntent.client_secret || '',
        customerId: customer.id,
      };
    } catch (err: any) {
      this.logger.error(`Error creating SetupIntent: ${err.message}`);
      throw new BadRequestException(`Stripe SetupIntent error: ${err.message}`);
    }
  }

  async getPaymentMethods(userId: string): Promise<any[]> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    if (this.stripe && user.stripe_customer_id && !user.stripe_customer_id.startsWith('cus_mock_')) {
      try {
        const cards = await this.stripe.paymentMethods.list({
          customer: user.stripe_customer_id,
          type: 'card',
        });
        const banks = await this.stripe.paymentMethods.list({
          customer: user.stripe_customer_id,
          type: 'us_bank_account',
        });

        return [...cards.data, ...banks.data].map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          } : undefined,
          us_bank_account: pm.us_bank_account ? {
            bank_name: pm.us_bank_account.bank_name,
            last4: pm.us_bank_account.last4,
            routing_number: pm.us_bank_account.routing_number,
          } : undefined,
          created: pm.created,
        }));
      } catch (e: any) {
        this.logger.warn(`Could not list payment methods from Stripe: ${e.message}`);
      }
    }

    // Return empty list if no saved payment methods in Stripe
    return [];
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string): Promise<{ success: boolean; id: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe service is not configured');
    }
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (e: any) {
      this.logger.warn(`Stripe detach error: ${e.message}`);
      throw new BadRequestException(`Could not remove payment method: ${e.message}`);
    }
    return { success: true, id: paymentMethodId };
  }

  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe service is not configured');
    }
    const customer = await this.getOrCreateCustomer(userId);

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: 'https://app.jhoanes.com/profile',
      });
      return { url: session.url };
    } catch (e: any) {
      this.logger.warn(`Stripe Customer Portal error: ${e.message}`);
      throw new BadRequestException(`Stripe Customer Portal error: ${e.message}`);
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    if (!this.stripe || !paymentIntentId) return null;
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err: any) {
      this.logger.warn(`Could not retrieve PaymentIntent ${paymentIntentId}: ${err?.message}`);
      return null;
    }
  }

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    orderId?: string;
    customerEmail?: string;
    description?: string;
    customerId?: string;
    paymentMethodId?: string;
    saveCard?: boolean;
    paymentMethodType?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string; amount: number; status?: string }> {
    const {
      amount,
      currency = 'usd',
      orderId,
      customerEmail,
      description,
      customerId,
      paymentMethodId,
      saveCard,
      paymentMethodType,
    } = data;

    let targetAmount = amount;
    let fetchedOrder: any = null;
    if (orderId && this.ordersService) {
      try {
        const order = await this.ordersService.findOne(orderId);
        if (order) {
          fetchedOrder = order;
          const orderTotal = Number(order.total) || 0;
          const pendingBal = (order.pending_balance !== null && order.pending_balance !== undefined && Number(order.pending_balance) > 0)
            ? Number(order.pending_balance)
            : null;
          const authoritativeAmount = pendingBal !== null ? pendingBal : orderTotal;
          if (authoritativeAmount > 0) {
            targetAmount = authoritativeAmount;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not verify authoritative order amount for order ${orderId}: ${err?.message}`);
      }
    }
    
    if (!targetAmount || targetAmount < 0.5) {
      throw new BadRequestException('Amount must be at least $0.50 USD');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe service is not configured');
    }

    const amountInCents = Math.round(targetAmount * 100);
    const invoiceNumber = fetchedOrder?.invoice_number || (orderId ? orderId.slice(0, 8) : '');
    const clientName = fetchedOrder?.user?.profile?.full_name || fetchedOrder?.user?.name || customerEmail || 'Cliente Mayorista';

    let resolvedDescription = description;
    if (orderId) {
      if (!resolvedDescription || resolvedDescription.includes(orderId)) {
        resolvedDescription = `Invoice ${invoiceNumber} — ${clientName}`;
      }
    } else if (!resolvedDescription) {
      resolvedDescription = 'Order Checkout - Jhoanes Wholesale';
    }

    try {
      // 1-Click Checkout with an existing saved payment method
      if (paymentMethodId) {
        const metadata: Record<string, string> = {
          orderId: orderId || '',
          customerEmail: customerEmail || '',
          paymentType: '1-click-saved-method',
        };
        if (invoiceNumber) {
          metadata.invoice_number = invoiceNumber;
        }

        const intent = await this.stripe.paymentIntents.create({
          amount: amountInCents,
          currency: currency.toLowerCase(),
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: resolvedDescription,
          receipt_email: customerEmail,
          metadata,
        });

        if (orderId && intent.status === 'succeeded') {
          await this.ordersService.update(orderId, {
            payment_status: 'paid',
            stripe_payment_id: intent.id,
          }, 'admin');
        }

        return {
          clientSecret: intent.client_secret || '',
          paymentIntentId: intent.id,
          amount: targetAmount,
          status: intent.status,
        };
      }

      // Standard / Interactive Intent with ACH Support enabled
      const metadata: Record<string, string> = {
        orderId: orderId || '',
        customerEmail: customerEmail || '',
      };
      if (invoiceNumber) {
        metadata.invoice_number = invoiceNumber;
      }

      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        description: resolvedDescription,
        receipt_email: customerEmail,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      };

      if (customerId && !customerId.startsWith('cus_mock_')) {
        intentParams.customer = customerId;
        if (saveCard) {
          intentParams.setup_future_usage = 'off_session';
        }
      }

      if (paymentMethodType === 'us_bank_account') {
        delete (intentParams as any).automatic_payment_methods;
        (intentParams as any).payment_method_types = ['us_bank_account'];
      }

      const intent = await this.stripe.paymentIntents.create(intentParams);

      return {
        clientSecret: intent.client_secret || '',
        paymentIntentId: intent.id,
        amount: targetAmount,
        status: intent.status,
      };
    } catch (err: any) {
      this.logger.error(`Stripe error: ${err.message}`);
      throw new BadRequestException(`Stripe error: ${err.message}`);
    }
  }

  /**
   * TASK-94-03: Sincroniza en tiempo real el invoice_number oficial consecutivo
   * en la descripción y metadatos del PaymentIntent de Stripe.
   */
  async syncInvoiceToStripe(orderId: string, invoiceNumber: string, paymentIntentId?: string): Promise<boolean> {
    if (!this.stripe || !invoiceNumber) return false;
    try {
      let targetIntentId = paymentIntentId;
      const order = await this.ordersService.findOne(orderId);
      if (!targetIntentId) {
        targetIntentId = order?.stripe_payment_id || undefined;
      }
      if (!targetIntentId || !targetIntentId.startsWith('pi_')) {
        return false;
      }

      const clientName = order?.user?.profile?.full_name || order?.user?.email || 'Customer';
      await this.stripe.paymentIntents.update(targetIntentId, {
        description: `Invoice ${invoiceNumber} — ${clientName}`,
        metadata: {
          invoice_number: invoiceNumber,
          orderId: order?.id || orderId,
        },
      });
      this.logger.log(`[StripeSync] Successfully synced invoice ${invoiceNumber} to PaymentIntent ${targetIntentId}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`[StripeSync] Could not sync invoice ${invoiceNumber} to Stripe: ${err.message}`);
      return false;
    }
  }

  async createSettlementLink(data: {
    orderId?: string;
    clientId?: string;
    clientEmail?: string;
    paymentMethod?: string;
  }): Promise<{
    url: string;
    clientSecret?: string;
    paymentIntentId?: string;
    amount?: number;
    balance?: number;
    feeAmount?: number;
    feeMethod?: string;
    totalDebt?: number;
    orderId?: string;
    orderCount?: number;
    customerEmail?: string;
  }> {
    const { orderId, clientId, clientEmail, paymentMethod } = data;

    // Normalize payment method for fee calculation (TASK-47-03)
    const rawMethod = (paymentMethod || 'STRIPE_CARD').trim().toUpperCase();
    const feeMethod = (rawMethod === 'ACH' || rawMethod === 'ACH_DEBIT' || rawMethod === 'US_BANK_ACCOUNT')
      ? 'ACH'
      : (rawMethod === 'CARD' || rawMethod === 'STRIPE' || rawMethod === 'STRIPE_CARD' || rawMethod === 'CREDIT_CARD')
        ? 'STRIPE_CARD'
        : rawMethod;

    // Single order settlement
    if (orderId) {
      const order = await this.ordersService.findOne(orderId);
      if (!order) throw new NotFoundException(`Order ${orderId} not found`);

      const totalNum = Number(order.total) || 0;
      const refundedNum = Number(order.refunded_amount) || 0;
      const pendingBal = (order.pending_balance !== null && order.pending_balance !== undefined)
        ? Number(order.pending_balance)
        : null;

      // If order has an explicit pending balance (e.g. after partial payment or fee adjustment), settle strictly that balance
      const balance = (pendingBal !== null && pendingBal > 0)
        ? Math.max(0, Math.round(pendingBal * 100) / 100)
        : Math.max(0, Math.round((totalNum - refundedNum) * 100) / 100);

      if (balance <= 0 || (order.payment_status === 'paid' && (!pendingBal || pendingBal <= 0))) {
        throw new BadRequestException(`Order ${orderId} is already fully paid or refunded`);
      }

      // TASK-47-03: Calculate processing fee without absorbing it
      const feeAmount = FeeCalculatorService.calculateFee(balance, feeMethod);
      const amountToPay = Math.round((balance + feeAmount) * 100) / 100;

      const email = order.user?.email || clientEmail || 'client@jhoanes.com';

      // Create PaymentIntent for in-app Stripe Elements checkout
      const invoiceLabel = order.invoice_number || order.id.slice(0, 8);
      const intent = await this.createPaymentIntent({
        amount: amountToPay,
        orderId: order.id,
        customerEmail: email,
        description: (feeAmount > 0)
          ? `Invoice Settlement #${invoiceLabel} (Balance: $${balance.toFixed(2)} + Fee: $${feeAmount.toFixed(2)}) - Jhoanes Bakery Wholesale`
          : `Invoice Settlement #${invoiceLabel} (Balance: $${balance.toFixed(2)}) - Jhoanes Bakery Wholesale`,
        paymentMethodType: feeMethod === 'ACH' ? 'us_bank_account' : undefined,
      });

      // Update intent metadata to carry fee details
      if (this.stripe && intent.paymentIntentId) {
        try {
          await this.stripe.paymentIntents.update(intent.paymentIntentId, {
            metadata: {
              orderId: order.id,
              invoice_number: invoiceLabel,
              type: (pendingBal !== null && pendingBal > 0) ? 'partial_settlement' : 'settlement',
              customerEmail: email,
              balance: String(balance),
              feeAmount: String(feeAmount),
              feeMethod: feeMethod,
            },
          });
        } catch (_) {}
      }

      const baseUrl = (process.env.SITE_URL || 'https://app.jhoanes.com').replace('http://', 'https://').replace(/\/$/, '');
      let checkoutUrl = `${baseUrl}/orders/${order.id}`;

      if (this.stripe) {
        try {
          const lineItems: any[] = [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Invoice Settlement #${order.id.slice(0, 8)}`,
                  description: `Order balance settlement - Order #${order.id.slice(0, 8)}`,
                },
                unit_amount: Math.round(balance * 100),
              },
              quantity: 1,
            },
          ];

          if (feeAmount > 0) {
            lineItems.push({
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Processing Fee (${feeMethod === 'ACH' ? '0.8% ACH, max $5.00' : 'Processing Fee'})`,
                  description: `Banking / payment gateway processing fee`,
                },
                unit_amount: Math.round(feeAmount * 100),
              },
              quantity: 1,
            });
          }

          const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            client_reference_id: order.id,
            line_items: lineItems,
            metadata: {
              orderId: order.id,
              type: 'settlement',
              customerEmail: email,
              balance: String(balance),
              feeAmount: String(feeAmount),
              feeMethod: feeMethod,
            },
            success_url: `${baseUrl}/orders/${order.id}?settled=true`,
            cancel_url: `${baseUrl}/orders/${order.id}?cancelled=true`,
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
        amount: amountToPay,
        balance: balance,
        feeAmount: feeAmount,
        feeMethod: feeMethod,
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
      const pendingBal = (o.pending_balance !== null && o.pending_balance !== undefined) ? Number(o.pending_balance) : null;
      const net = (pendingBal !== null && pendingBal > 0)
        ? pendingBal
        : Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
      return sum + net;
    }, 0);

    const baseUrl = (process.env.SITE_URL || 'https://app.jhoanes.com').replace('http://', 'https://').replace(/\/$/, '');
    const roundedDebt = Math.round(totalDebt * 100) / 100;
    if (roundedDebt <= 0) {
      return {
        url: `${baseUrl}/orders`,
        totalDebt: 0,
        orderCount: 0,
        customerEmail: user.email,
      };
    }

    const feeAmount = FeeCalculatorService.calculateFee(roundedDebt, feeMethod);
    const amountToPay = Math.round((roundedDebt + feeAmount) * 100) / 100;

    let checkoutUrl = `${baseUrl}/orders?pay_debt=${user.id}`;
    if (this.stripe) {
      try {
        const lineItems: any[] = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `B2B Account Debt Settlement - ${user.profile?.full_name || user.email}`,
                description: `Settlement of ${pendingOrders.length} pending commercial credit order(s)`,
              },
              unit_amount: Math.round(roundedDebt * 100),
            },
            quantity: 1,
          },
        ];

        if (feeAmount > 0) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Processing Fee (${feeMethod === 'ACH' ? '0.8% ACH, max $5.00' : 'Processing Fee'})`,
                description: `Banking / payment gateway processing fee`,
              },
              unit_amount: Math.round(feeAmount * 100),
            },
            quantity: 1,
          });
        }

        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: user.email,
          client_reference_id: user.id,
          line_items: lineItems,
          metadata: {
            userId: user.id,
            type: 'account_settlement',
            orderIds: pendingOrders.map((o: any) => o.id).join(','),
            balance: String(roundedDebt),
            feeAmount: String(feeAmount),
            feeMethod: feeMethod,
          },
          success_url: `${baseUrl}/orders?settled=true`,
          cancel_url: `${baseUrl}/orders?cancelled=true`,
        });
        if (session.url) checkoutUrl = session.url;
      } catch (err: any) {
        this.logger.warn(`Stripe session error for account settlement: ${err.message}`);
      }
    }

    return {
      url: checkoutUrl,
      totalDebt: roundedDebt,
      amount: amountToPay,
      feeAmount: feeAmount,
      feeMethod: feeMethod,
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

    if (amount !== undefined && Number(amount) > maxRefundable) {
      throw new BadRequestException(
        `El monto a reembolsar ($${Number(amount).toFixed(2)}) supera el saldo remanente reembolsable de $${maxRefundable.toFixed(2)} (maxRefundable)`
      );
    }

    const refundAmount = (amount !== undefined && amount > 0)
      ? Math.round(Number(amount) * 100) / 100
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

    // TASK-37-03: Disparar comprobante de reembolso al cliente de forma asíncrona no bloqueante
    const mailSvc = this.mailService;
    if (mailSvc) {
      (async () => {
        try {
          let customerEmail = order.user?.email;
          if (!customerEmail && order.user_id) {
            const u = await this.usersService.findOne(order.user_id);
            customerEmail = u?.email;
          }
          if (customerEmail) {
            await mailSvc.sendRefundReceipt(order, customerEmail, {
              refundedAmount: refundAmount,
              totalRefunded: newTotalRefunded,
              reason: auditReason,
            });
          }
        } catch (err: any) {
          this.logger.warn(`Error dispatching refund receipt email: ${err?.message || err}`);
        }
      })().catch(err => {
        this.logger.warn(`Unhandled error in refund receipt email dispatch: ${err?.message || err}`);
      });
    }

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
        const updatePayload: any = {
          payment_status: 'paid',
          stripe_payment_id: paymentIntent.id,
        };
        if (paymentIntent?.metadata?.feeAmount) {
          updatePayload.fee_amount = Number(paymentIntent.metadata.feeAmount);
        }
        if (paymentIntent?.metadata?.feeMethod) {
          updatePayload.fee_method = paymentIntent.metadata.feeMethod;
        }
        await this.ordersService.update(orderId, updatePayload, 'admin');

        // TASK-94-03: Sincronizar en Stripe el invoice_number oficial consecutivo
        try {
          const reconciledOrder = await this.ordersService.findOne(orderId);
          if (reconciledOrder?.invoice_number) {
            await this.syncInvoiceToStripe(orderId, reconciledOrder.invoice_number, paymentIntent.id);
          }
        } catch (syncErr: any) {
          this.logger.warn(`Could not sync invoice_number after webhook reconcile: ${syncErr?.message || syncErr}`);
        }

        // TASK-37-01: Disparar recibo de compra tras conciliar webhook payment_intent.succeeded
        const mailSvc = this.mailService;
        if (mailSvc) {
          (async () => {
            try {
              const fullOrder = await this.ordersService.findOne(orderId);
              const customerEmail = fullOrder.user?.email || paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;
              if (customerEmail) {
                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
              }
              if (typeof mailSvc.sendAdminNewOrderAlert === 'function') {
                const clientName = fullOrder.user?.profile?.full_name || 'Cliente Mayorista';
                await mailSvc.sendAdminNewOrderAlert(fullOrder, customerEmail || undefined, clientName);
              }
            } catch (err: any) {
              this.logger.warn(`Error sending order receipt from payment_intent.succeeded webhook: ${err?.message || err}`);
            }
          })().catch(err => {
            this.logger.warn(`Unhandled error in webhook order receipt dispatch: ${err?.message || err}`);
          });
        }
      }
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data?.object as Stripe.Checkout.Session;
      const orderId = session?.metadata?.orderId || session?.client_reference_id;
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      const mailSvc = this.mailService;

      if (orderId && session.metadata?.type === 'settlement') {
        this.logger.log(`Checkout session completed for settlement of order ${orderId}`);
        const updatePayload: any = {
          payment_status: 'paid',
          stripe_payment_id: paymentIntentId,
          pending_balance: 0,
        };
        if (session.metadata?.feeAmount) {
          updatePayload.fee_amount = Number(session.metadata.feeAmount);
        }
        if (session.metadata?.feeMethod) {
          updatePayload.fee_method = session.metadata.feeMethod;
        }
        await this.ordersService.update(orderId, updatePayload, 'admin');

        // TASK-94-03: Sincronizar en Stripe el invoice_number oficial consecutivo
        try {
          const reconciledOrder = await this.ordersService.findOne(orderId);
          if (reconciledOrder?.invoice_number && paymentIntentId) {
            await this.syncInvoiceToStripe(orderId, reconciledOrder.invoice_number, paymentIntentId);
          }
        } catch (syncErr: any) {
          this.logger.warn(`Could not sync invoice_number after checkout session reconcile: ${syncErr?.message || syncErr}`);
        }

        if (mailSvc) {
          (async () => {
            try {
              const fullOrder = await this.ordersService.findOne(orderId);
              const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
              if (customerEmail) {
                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
              }
              if (typeof mailSvc.sendAdminNewOrderAlert === 'function') {
                const clientName = fullOrder.user?.profile?.full_name || 'Cliente Mayorista';
                await mailSvc.sendAdminNewOrderAlert(fullOrder, customerEmail || undefined, clientName);
              }
            } catch (err: any) {
              this.logger.warn(`Error sending settlement receipt: ${err?.message || err}`);
            }
          })().catch(() => {});
        }
      } else if (session.metadata?.type === 'account_settlement' && session.metadata?.orderIds) {
        const orderIds = session.metadata.orderIds.split(',').filter(Boolean);
        for (const oId of orderIds) {
          try {
            await this.ordersService.update(oId, {
              payment_status: 'paid',
              stripe_payment_id: paymentIntentId,
              pending_balance: 0,
            }, 'admin');

            if (mailSvc) {
              (async () => {
                try {
                  const fullOrder = await this.ordersService.findOne(oId);
                  const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
                  if (customerEmail) {
                    await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
                  }
                } catch (_) {}
              })().catch(() => {});
            }
          } catch (e: any) {
            this.logger.warn(`Failed reconciling batch settlement for order ${oId}: ${e.message}`);
          }
        }
      } else if (orderId) {
        this.logger.log(`Checkout session completed for order ${orderId}`);
        const updatePayload: any = {
          payment_status: 'paid',
          stripe_payment_id: paymentIntentId,
          pending_balance: 0,
        };
        if (session.metadata?.feeAmount) {
          updatePayload.fee_amount = Number(session.metadata.feeAmount);
        }
        if (session.metadata?.feeMethod) {
          updatePayload.fee_method = session.metadata.feeMethod;
        }
        await this.ordersService.update(orderId, updatePayload, 'admin');

        // TASK-94-03: Sincronizar en Stripe el invoice_number oficial consecutivo
        try {
          const reconciledOrder = await this.ordersService.findOne(orderId);
          if (reconciledOrder?.invoice_number && paymentIntentId) {
            await this.syncInvoiceToStripe(orderId, reconciledOrder.invoice_number, paymentIntentId);
          }
        } catch (syncErr: any) {
          this.logger.warn(`Could not sync invoice_number after checkout session reconcile: ${syncErr?.message || syncErr}`);
        }

        if (mailSvc) {
          (async () => {
            try {
              const fullOrder = await this.ordersService.findOne(orderId);
              const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
              if (customerEmail) {
                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
              }
              if (typeof mailSvc.sendAdminNewOrderAlert === 'function') {
                const clientName = fullOrder.user?.profile?.full_name || 'Cliente Mayorista';
                await mailSvc.sendAdminNewOrderAlert(fullOrder, customerEmail || undefined, clientName);
              }
            } catch (err: any) {
              this.logger.warn(`Error sending checkout session order receipt: ${err?.message || err}`);
            }
          })().catch(() => {});
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
