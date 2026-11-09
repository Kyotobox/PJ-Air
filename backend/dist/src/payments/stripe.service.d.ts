import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
export declare class PaymentGatewayException extends BadRequestException {
    constructor(message: string);
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
export declare class StripeService {
    private stripe;
    private readonly logger;
    constructor();
    setStripeClient(client: Stripe | null): void;
    getStripeClient(): Stripe | null;
    createSetupIntent(paramsOrCustomerId: CreateSetupIntentParams | string, options?: {
        ein?: string;
        terms_version?: string;
        metadata?: Record<string, any>;
    }): Promise<SetupIntentResult>;
}
