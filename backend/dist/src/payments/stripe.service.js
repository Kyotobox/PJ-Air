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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = exports.PaymentGatewayException = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../config");
class PaymentGatewayException extends common_1.BadRequestException {
    constructor(message) {
        super(message);
        this.name = 'PaymentGatewayException';
    }
}
exports.PaymentGatewayException = PaymentGatewayException;
let StripeService = StripeService_1 = class StripeService {
    stripe = null;
    logger = new common_1.Logger(StripeService_1.name);
    constructor() {
        const key = config_1.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
        if (key) {
            this.stripe = new stripe_1.default(key, {
                apiVersion: '2024-06-20',
            });
            this.logger.log('Stripe client initialized in StripeService.');
        }
        else {
            this.logger.warn('STRIPE_SECRET_KEY not set in StripeService.');
        }
    }
    setStripeClient(client) {
        this.stripe = client;
    }
    getStripeClient() {
        return this.stripe;
    }
    async createSetupIntent(paramsOrCustomerId, options) {
        let customerId;
        let ein;
        let terms_version = 'v2026.10.29';
        let userId;
        let customMetadata = {};
        if (typeof paramsOrCustomerId === 'string') {
            customerId = paramsOrCustomerId;
            if (options) {
                if (options.ein)
                    ein = options.ein;
                if (options.terms_version)
                    terms_version = options.terms_version;
                if (options.metadata)
                    customMetadata = options.metadata;
            }
        }
        else if (paramsOrCustomerId && typeof paramsOrCustomerId === 'object') {
            customerId = paramsOrCustomerId.customerId;
            userId = paramsOrCustomerId.userId;
            ein = paramsOrCustomerId.ein;
            if (paramsOrCustomerId.terms_version)
                terms_version = paramsOrCustomerId.terms_version;
            if (paramsOrCustomerId.metadata)
                customMetadata = paramsOrCustomerId.metadata;
        }
        if (!customerId || !customerId.trim()) {
            throw new common_1.BadRequestException('Customer ID is required to create a SetupIntent');
        }
        if (!this.stripe) {
            throw new PaymentGatewayException('Stripe client is not initialized or STRIPE_SECRET_KEY is missing');
        }
        try {
            const metadata = {
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
            const setupParams = {
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
        }
        catch (err) {
            this.logger.error(`Failed to create Stripe SetupIntent: ${err.message}`);
            if (err instanceof common_1.BadRequestException) {
                throw err;
            }
            throw new PaymentGatewayException(`Stripe SetupIntent error: ${err.message}`);
        }
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StripeService);
//# sourceMappingURL=stripe.service.js.map