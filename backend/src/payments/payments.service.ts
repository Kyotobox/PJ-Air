import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly ordersService: OrdersService) {
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
        await this.ordersService.update(orderId, { payment_status: 'paid' }, 'admin');
      }
    }

    return { received: true, status: event.type };
  }
}
