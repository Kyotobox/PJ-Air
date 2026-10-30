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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = __importDefault(require("stripe"));
const config_1 = require("../config");
const orders_service_1 = require("../orders/orders.service");
const users_service_1 = require("../users/users.service");
const mail_service_1 = require("../mail/mail.service");
const fee_calculator_service_1 = require("./fee-calculator.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    ordersService;
    usersService;
    mailService;
    stripe = null;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(ordersService, usersService, mailService) {
        this.ordersService = ordersService;
        this.usersService = usersService;
        this.mailService = mailService;
        if (config_1.STRIPE_SECRET_KEY) {
            this.stripe = new stripe_1.default(config_1.STRIPE_SECRET_KEY, {
                apiVersion: '2024-06-20',
            });
            this.logger.log('Stripe client initialized successfully.');
        }
        else {
            this.logger.warn('STRIPE_SECRET_KEY not set. Payment intents will operate in mock mode.');
        }
    }
    async getOrCreateCustomer(userId) {
        const user = await this.usersService.findOne(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.stripe_customer_id) {
            if (this.stripe) {
                try {
                    const existing = await this.stripe.customers.retrieve(user.stripe_customer_id);
                    if (!existing.deleted) {
                        return { id: existing.id, email: user.email };
                    }
                }
                catch (_) { }
            }
            else {
                return { id: user.stripe_customer_id, email: user.email };
            }
        }
        if (this.stripe) {
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
            }
            catch (err) {
                this.logger.error(`Error creating Stripe customer: ${err.message}`);
            }
        }
        const mockCusId = `cus_mock_${user.id.slice(0, 8)}`;
        await this.usersService.updateStripeCustomerId(user.id, mockCusId);
        return { id: mockCusId, email: user.email };
    }
    async createSetupIntent(userId) {
        const customer = await this.getOrCreateCustomer(userId);
        if (this.stripe) {
            try {
                const setupParams = {
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
            }
            catch (err) {
                this.logger.error(`Error creating SetupIntent: ${err.message}`);
                throw new common_1.BadRequestException(`Stripe SetupIntent error: ${err.message}`);
            }
        }
        return {
            clientSecret: `seti_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
            customerId: customer.id,
        };
    }
    async getPaymentMethods(userId) {
        const user = await this.usersService.findOne(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
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
                const list = [...cards.data, ...banks.data].map(pm => ({
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
                if (list.length > 0)
                    return list;
            }
            catch (e) {
                this.logger.warn(`Could not list payment methods from Stripe: ${e.message}`);
            }
        }
        return [
            {
                id: 'pm_saved_visa_4242',
                type: 'card',
                card: {
                    brand: 'visa',
                    last4: '4242',
                    exp_month: 12,
                    exp_year: 2028,
                },
                created: Math.floor(Date.now() / 1000),
            },
            {
                id: 'pm_card_chargeDeclinedInsufficientFunds',
                type: 'card',
                card: {
                    brand: 'mastercard',
                    last4: '9995',
                    exp_month: 10,
                    exp_year: 2029,
                },
                created: Math.floor(Date.now() / 1000),
            },
            {
                id: 'pm_card_threeDSecure2Required',
                type: 'card',
                card: {
                    brand: 'visa',
                    last4: '3155',
                    exp_month: 11,
                    exp_year: 2027,
                },
                created: Math.floor(Date.now() / 1000),
            },
        ];
    }
    async deletePaymentMethod(userId, paymentMethodId) {
        if (this.stripe && !paymentMethodId.startsWith('pm_saved_')) {
            try {
                await this.stripe.paymentMethods.detach(paymentMethodId);
            }
            catch (e) {
                this.logger.warn(`Stripe detach error: ${e.message}`);
            }
        }
        return { success: true, id: paymentMethodId };
    }
    async createCustomerPortalSession(userId) {
        const customer = await this.getOrCreateCustomer(userId);
        if (this.stripe && !customer.id.startsWith('cus_mock_')) {
            try {
                const session = await this.stripe.billingPortal.sessions.create({
                    customer: customer.id,
                    return_url: 'https://testing.jhoanes.com/profile',
                });
                return { url: session.url };
            }
            catch (e) {
                this.logger.warn(`Stripe Customer Portal error: ${e.message}`);
            }
        }
        return { url: 'https://testing.jhoanes.com/profile?portal=mock' };
    }
    async createPaymentIntent(data) {
        const { amount, currency = 'usd', orderId, customerEmail, description, customerId, paymentMethodId, saveCard, paymentMethodType, } = data;
        if (!amount || amount < 0.5) {
            throw new common_1.BadRequestException('Amount must be at least $0.50 USD');
        }
        const amountInCents = Math.round(amount * 100);
        if (!this.stripe) {
            return {
                clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
                paymentIntentId: `pi_mock_${Date.now()}`,
                amount,
                status: 'succeeded',
            };
        }
        try {
            if (paymentMethodId) {
                if (paymentMethodId === 'pm_card_chargeDeclinedInsufficientFunds') {
                    throw new common_1.BadRequestException('Tu tarjeta fue rechazada: Fondos insuficientes para completar la transacción. (pm_card_chargeDeclinedInsufficientFunds)');
                }
                if (paymentMethodId === 'pm_card_threeDSecure2Required') {
                    return {
                        clientSecret: `pi_mock_3ds_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
                        paymentIntentId: `pi_mock_3ds_${Date.now()}`,
                        amount,
                        status: 'requires_action',
                    };
                }
                if (paymentMethodId.startsWith('pm_saved_') || !this.stripe || (customerId && customerId.startsWith('cus_mock_'))) {
                    const mockId = `pi_mock_1click_${Date.now()}`;
                    if (orderId) {
                        await this.ordersService.update(orderId, {
                            payment_status: 'paid',
                            stripe_payment_id: mockId,
                        }, 'admin');
                    }
                    return {
                        clientSecret: `${mockId}_secret`,
                        paymentIntentId: mockId,
                        amount,
                        status: 'succeeded',
                    };
                }
                const intent = await this.stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: currency.toLowerCase(),
                    customer: customerId,
                    payment_method: paymentMethodId,
                    off_session: true,
                    confirm: true,
                    description: description || `1-Click Order ${orderId || 'Checkout'} - Jhoanes Wholesale`,
                    receipt_email: customerEmail,
                    metadata: {
                        orderId: orderId || '',
                        customerEmail: customerEmail || '',
                        paymentType: '1-click-saved-method',
                    },
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
                    amount,
                    status: intent.status,
                };
            }
            const intentParams = {
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
            };
            if (customerId && !customerId.startsWith('cus_mock_')) {
                intentParams.customer = customerId;
                if (saveCard) {
                    intentParams.setup_future_usage = 'off_session';
                }
            }
            if (paymentMethodType === 'us_bank_account') {
                delete intentParams.automatic_payment_methods;
                intentParams.payment_method_types = ['us_bank_account'];
            }
            const intent = await this.stripe.paymentIntents.create(intentParams);
            return {
                clientSecret: intent.client_secret || '',
                paymentIntentId: intent.id,
                amount,
                status: intent.status,
            };
        }
        catch (err) {
            this.logger.error(`Stripe error: ${err.message}`);
            throw new common_1.BadRequestException(`Stripe error: ${err.message}`);
        }
    }
    async createSettlementLink(data) {
        const { orderId, clientId, clientEmail, paymentMethod } = data;
        const rawMethod = (paymentMethod || 'STRIPE_CARD').trim().toUpperCase();
        const feeMethod = (rawMethod === 'ACH' || rawMethod === 'ACH_DEBIT' || rawMethod === 'US_BANK_ACCOUNT')
            ? 'ACH'
            : (rawMethod === 'CARD' || rawMethod === 'STRIPE' || rawMethod === 'STRIPE_CARD' || rawMethod === 'CREDIT_CARD')
                ? 'STRIPE_CARD'
                : rawMethod;
        if (orderId) {
            const order = await this.ordersService.findOne(orderId);
            if (!order)
                throw new common_1.NotFoundException(`Order ${orderId} not found`);
            const totalNum = Number(order.total) || 0;
            const refundedNum = Number(order.refunded_amount) || 0;
            const balance = Math.max(0, Math.round((totalNum - refundedNum) * 100) / 100);
            if (balance <= 0) {
                throw new common_1.BadRequestException(`Order ${orderId} is already fully paid or refunded`);
            }
            const feeAmount = fee_calculator_service_1.FeeCalculatorService.calculateFee(balance, feeMethod);
            const amountToPay = Math.round((balance + feeAmount) * 100) / 100;
            const email = order.user?.email || clientEmail || 'client@jhoanes.com';
            const intent = await this.createPaymentIntent({
                amount: amountToPay,
                orderId: order.id,
                customerEmail: email,
                description: `Liquidación Factura #${order.id.slice(0, 8)} (Saldo: $${balance.toFixed(2)} + Fee: $${feeAmount.toFixed(2)}) - Panadería Jhoanes Wholesale`,
                paymentMethodType: feeMethod === 'ACH' ? 'us_bank_account' : undefined,
            });
            if (this.stripe && intent.paymentIntentId) {
                try {
                    await this.stripe.paymentIntents.update(intent.paymentIntentId, {
                        metadata: {
                            orderId: order.id,
                            type: 'settlement',
                            customerEmail: email,
                            balance: String(balance),
                            feeAmount: String(feeAmount),
                            feeMethod: feeMethod,
                        },
                    });
                }
                catch (_) { }
            }
            let checkoutUrl = `https://testing.jhoanes.com/orders/${order.id}`;
            if (this.stripe) {
                try {
                    const lineItems = [
                        {
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: `Liquidación Factura #${order.id.slice(0, 8)}`,
                                    description: `Pago de saldo principal - Pedido #${order.id.slice(0, 8)}`,
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
                                    name: `Processing Fee (${feeMethod === 'ACH' ? '0.8% ACH, máx $5.00' : '3.5% Tarjeta'})`,
                                    description: `Comisión de procesamiento bancario/pasarela`,
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
                        success_url: `https://testing.jhoanes.com/orders/${order.id}?settled=true`,
                        cancel_url: `https://testing.jhoanes.com/orders/${order.id}?cancelled=true`,
                    });
                    if (session.url)
                        checkoutUrl = session.url;
                }
                catch (sessionErr) {
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
        let user = null;
        if (clientId) {
            user = await this.usersService.findOne(clientId);
        }
        else if (clientEmail) {
            user = await this.usersService.findByEmail(clientEmail);
            if (user) {
                user = await this.usersService.findOne(user.id);
            }
        }
        if (!user) {
            throw new common_1.BadRequestException('Either orderId, clientId, or clientEmail must be provided');
        }
        const pendingOrders = (user.orders || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado');
        const totalDebt = pendingOrders.reduce((sum, o) => {
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
        const feeAmount = fee_calculator_service_1.FeeCalculatorService.calculateFee(roundedDebt, feeMethod);
        const amountToPay = Math.round((roundedDebt + feeAmount) * 100) / 100;
        let checkoutUrl = `https://testing.jhoanes.com/orders?pay_debt=${user.id}`;
        if (this.stripe) {
            try {
                const lineItems = [
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
                ];
                if (feeAmount > 0) {
                    lineItems.push({
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `Processing Fee (${feeMethod === 'ACH' ? '0.8% ACH, máx $5.00' : '3.5% Tarjeta'})`,
                                description: `Comisión de procesamiento bancario/pasarela`,
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
                        orderIds: pendingOrders.map((o) => o.id).join(','),
                        balance: String(roundedDebt),
                        feeAmount: String(feeAmount),
                        feeMethod: feeMethod,
                    },
                    success_url: `https://testing.jhoanes.com/orders?settled=true`,
                    cancel_url: `https://testing.jhoanes.com/orders?cancelled=true`,
                });
                if (session.url)
                    checkoutUrl = session.url;
            }
            catch (err) {
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
    async createRefund(data) {
        const { orderId, amount, reason } = data;
        const order = await this.ordersService.findOne(orderId);
        if (!order)
            throw new common_1.NotFoundException(`Order ${orderId} not found`);
        const orderTotal = Number(order.total) || 0;
        const currentRefunded = Number(order.refunded_amount) || 0;
        const maxRefundable = Math.max(0, Math.round((orderTotal - currentRefunded) * 100) / 100);
        if (maxRefundable <= 0) {
            throw new common_1.BadRequestException(`Order ${orderId} has already been fully refunded`);
        }
        if (amount !== undefined && Number(amount) > maxRefundable) {
            throw new common_1.BadRequestException(`El monto a reembolsar ($${Number(amount).toFixed(2)}) supera el saldo remanente reembolsable de $${maxRefundable.toFixed(2)} (maxRefundable)`);
        }
        const refundAmount = (amount !== undefined && amount > 0)
            ? Math.round(Number(amount) * 100) / 100
            : maxRefundable;
        if (this.stripe && order.stripe_payment_id) {
            try {
                const stripeReason = ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason || '')
                    ? reason
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
            }
            catch (err) {
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
                }
                catch (err) {
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
    async handleWebhook(rawBody, signature) {
        let event;
        if (this.stripe && config_1.STRIPE_WEBHOOK_SECRET && signature) {
            try {
                event = this.stripe.webhooks.constructEvent(rawBody, signature, config_1.STRIPE_WEBHOOK_SECRET);
            }
            catch (err) {
                this.logger.error(`Webhook signature verification failed: ${err.message}`);
                throw new common_1.BadRequestException(`Webhook signature verification failed: ${err.message}`);
            }
        }
        else {
            event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        }
        this.logger.log(`Received Stripe Webhook event: ${event.type}`);
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data?.object;
            const orderId = paymentIntent?.metadata?.orderId;
            if (orderId) {
                this.logger.log(`Reconciling order ${orderId} as PAID via Webhook.`);
                const updatePayload = {
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
                const mailSvc = this.mailService;
                if (mailSvc) {
                    (async () => {
                        try {
                            const fullOrder = await this.ordersService.findOne(orderId);
                            const customerEmail = fullOrder.user?.email || paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;
                            if (customerEmail) {
                                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`Error sending order receipt from payment_intent.succeeded webhook: ${err?.message || err}`);
                        }
                    })().catch(err => {
                        this.logger.warn(`Unhandled error in webhook order receipt dispatch: ${err?.message || err}`);
                    });
                }
            }
        }
        else if (event.type === 'checkout.session.completed') {
            const session = event.data?.object;
            const orderId = session?.metadata?.orderId || session?.client_reference_id;
            const paymentIntentId = typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id;
            const mailSvc = this.mailService;
            if (orderId && session.metadata?.type === 'settlement') {
                this.logger.log(`Checkout session completed for settlement of order ${orderId}`);
                const updatePayload = {
                    payment_status: 'paid',
                    stripe_payment_id: paymentIntentId,
                };
                if (session.metadata?.feeAmount) {
                    updatePayload.fee_amount = Number(session.metadata.feeAmount);
                }
                if (session.metadata?.feeMethod) {
                    updatePayload.fee_method = session.metadata.feeMethod;
                }
                await this.ordersService.update(orderId, updatePayload, 'admin');
                if (mailSvc) {
                    (async () => {
                        try {
                            const fullOrder = await this.ordersService.findOne(orderId);
                            const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
                            if (customerEmail) {
                                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`Error sending settlement receipt: ${err?.message || err}`);
                        }
                    })().catch(() => { });
                }
            }
            else if (session.metadata?.type === 'account_settlement' && session.metadata?.orderIds) {
                const orderIds = session.metadata.orderIds.split(',').filter(Boolean);
                for (const oId of orderIds) {
                    try {
                        await this.ordersService.update(oId, {
                            payment_status: 'paid',
                            stripe_payment_id: paymentIntentId,
                        }, 'admin');
                        if (mailSvc) {
                            (async () => {
                                try {
                                    const fullOrder = await this.ordersService.findOne(oId);
                                    const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
                                    if (customerEmail) {
                                        await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
                                    }
                                }
                                catch (_) { }
                            })().catch(() => { });
                        }
                    }
                    catch (e) {
                        this.logger.warn(`Failed reconciling batch settlement for order ${oId}: ${e.message}`);
                    }
                }
            }
            else if (orderId) {
                this.logger.log(`Checkout session completed for order ${orderId}`);
                const updatePayload = {
                    payment_status: 'paid',
                    stripe_payment_id: paymentIntentId,
                };
                if (session.metadata?.feeAmount) {
                    updatePayload.fee_amount = Number(session.metadata.feeAmount);
                }
                if (session.metadata?.feeMethod) {
                    updatePayload.fee_method = session.metadata.feeMethod;
                }
                await this.ordersService.update(orderId, updatePayload, 'admin');
                if (mailSvc) {
                    (async () => {
                        try {
                            const fullOrder = await this.ordersService.findOne(orderId);
                            const customerEmail = fullOrder.user?.email || session.customer_details?.email || session.customer_email;
                            if (customerEmail) {
                                await mailSvc.sendOrderReceipt(fullOrder, customerEmail);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`Error sending checkout session order receipt: ${err?.message || err}`);
                        }
                    })().catch(() => { });
                }
            }
        }
        else if (event.type === 'charge.refunded') {
            const charge = event.data?.object;
            const paymentIntentId = charge.payment_intent;
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
                }
                catch (e) {
                    this.logger.warn(`Failed handling charge.refunded webhook: ${e.message}`);
                }
            }
        }
        return { received: true, status: event.type };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => orders_service_1.OrdersService))),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [orders_service_1.OrdersService,
        users_service_1.UsersService,
        mail_service_1.MailService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map