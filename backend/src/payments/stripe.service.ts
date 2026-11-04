import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '../config';

export class PaymentGatewayException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}

export interface CreateSetupIntentParams {
  customerId?: string;
  userId?: string;
  ein?: string;
  terms_version?: string;
  metadata?: Record<string, any>;
}

export interface SetupIntentResult {
  client_secret: string;
  clientSecret: string;
  id: string;
  customerId: string;
}

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor() {
    const key = STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2024-06-20' as any,
      });
      this.logger.log('Stripe client initialized in StripeService.');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set in StripeService.');
    }
  }

  setStripeClient(client: Stripe | null) {
    this.stripe = client;
  }

  getStripeClient(): Stripe | null {
    return this.stripe;
  }

  /**
   * Generates a Stripe SetupIntent for B2B wholesale card-on-file tokenization ($0.00 charge)
   * with legally binding audit metadata (NY ESRA / E-SIGN Act compliant).
   */
  async createSetupIntent(
    paramsOrCustomerId: CreateSetupIntentParams | string,
    options?: { ein?: string; terms_version?: string; metadata?: Record<string, any> }
  ): Promise<SetupIntentResult> {
    let customerId: string | undefined;
    let ein: string | undefined;
    let terms_version: string = 'v2026.10.29';
    let userId: string | undefined;
    let customMetadata: Record<string, any> = {};

    if (typeof paramsOrCustomerId === 'string') {
      customerId = paramsOrCustomerId;
      if (options) {
        if (options.ein) ein = options.ein;
        if (options.terms_version) terms_version = options.terms_version;
        if (options.metadata) customMetadata = options.metadata;
      }
    } else if (paramsOrCustomerId && typeof paramsOrCustomerId === 'object') {
      customerId = paramsOrCustomerId.customerId;
      userId = paramsOrCustomerId.userId;
      ein = paramsOrCustomerId.ein;
      if (paramsOrCustomerId.terms_version) terms_version = paramsOrCustomerId.terms_version;
      if (paramsOrCustomerId.metadata) customMetadata = paramsOrCustomerId.metadata;
    }

    if (!customerId || !customerId.trim()) {
      throw new BadRequestException('Customer ID is required to create a SetupIntent');
    }

    if (!this.stripe) {
      throw new PaymentGatewayException('Stripe client is not initialized or STRIPE_SECRET_KEY is missing');
    }

    try {
      const metadata: Record<string, string> = {
        source: 'b2b_wholesale_onboarding',
        ein: ein || '',
        terms_version: terms_version || 'v2026.10.29',
      };

      if (userId) {
        metadata.userId = userId;
      }

      for (const [key, val] of Object.entries(customMetadata)) {
        if (val !== undefined && val !== null) {
          metadata[key] = String(val);
        }
      }

      const setupParams: any = {
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata,
      };

      const setupIntent = await this.stripe.setupIntents.create(setupParams);

      if (!setupIntent.client_secret) {
        throw new PaymentGatewayException('Stripe failed to return a valid client_secret');
      }

      return {
        client_secret: setupIntent.client_secret,
        clientSecret: setupIntent.client_secret,
        id: setupIntent.id,
        customerId,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create Stripe SetupIntent: ${err.message}`);
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new PaymentGatewayException(`Stripe SetupIntent error: ${err.message}`);
    }
  }
}
