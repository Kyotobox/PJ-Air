import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: any;
  let usersService: any;
  let mailService: any;

  beforeEach(async () => {
    ordersService = {
      update: jest.fn().mockResolvedValue({ id: 'order-1', payment_status: 'paid' }),
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        payment_status: 'pending',
        total: 100,
        user: { email: 'client@example.com' },
      }),
      findAll: jest.fn().mockResolvedValue([]),
    };

    usersService = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@example.com' }),
      updateStripeCustomerId: jest.fn().mockResolvedValue({ id: 'user-1', stripe_customer_id: 'cus_123' }),
    };

    mailService = {
      sendOrderReceipt: jest.fn().mockResolvedValue(true),
      sendRefundReceipt: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: OrdersService, useValue: ordersService },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject payment intent if amount is less than 0.50', async () => {
    await expect(service.createPaymentIntent({ amount: 0.20 })).rejects.toThrow(BadRequestException);
  });

  it('should generate a payment intent with clientSecret and paymentIntentId for valid amount', async () => {
    const result = await service.createPaymentIntent({
      amount: 150.00,
      currency: 'usd',
      orderId: 'order-999',
      customerEmail: 'client@example.com',
    });

    expect(result).toHaveProperty('clientSecret');
    expect(result).toHaveProperty('paymentIntentId');
    expect(result.amount).toBe(150.00);
  });

  it('should reconcile order via webhook event payment_intent.succeeded and dispatch sendOrderReceipt', async () => {
    const webhookEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          metadata: { orderId: 'order-reconciled-789' },
          receipt_email: 'client@example.com',
        },
      },
    };

    ordersService.findOne.mockResolvedValueOnce({
      id: 'order-reconciled-789',
      total: 100,
      payment_status: 'paid',
      user: { email: 'client@example.com' },
    });

    const result = await service.handleWebhook(webhookEvent);
    expect(result.received).toBe(true);
    expect(ordersService.update).toHaveBeenCalledWith('order-reconciled-789', { payment_status: 'paid', stripe_payment_id: 'pi_test_123' }, 'admin');
    
    // Give non-blocking async a microtick
    await new Promise(r => setTimeout(r, 10));
    expect(mailService.sendOrderReceipt).toHaveBeenCalled();
  });

  it('should reconcile order via checkout.session.completed and dispatch sendOrderReceipt', async () => {
    const webhookEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_cs_999',
          metadata: { orderId: 'order-settled-111', type: 'settlement' },
          customer_details: { email: 'settled-client@example.com' },
        },
      },
    };

    ordersService.findOne.mockResolvedValueOnce({
      id: 'order-settled-111',
      total: 250,
      payment_status: 'paid',
      user: { email: 'settled-client@example.com' },
    });

    const result = await service.handleWebhook(webhookEvent);
    expect(result.received).toBe(true);
    expect(ordersService.update).toHaveBeenCalledWith('order-settled-111', { payment_status: 'paid', stripe_payment_id: 'pi_cs_999' }, 'admin');
    
    await new Promise(r => setTimeout(r, 10));
    expect(mailService.sendOrderReceipt).toHaveBeenCalled();
  });

  it('should dispatch sendRefundReceipt on createRefund', async () => {
    const mockOrder = {
      id: 'order-refund-123',
      total: 200,
      refunded_amount: 0,
      user_id: 'user-1',
      user: { email: 'refund-target@example.com' },
    };
    ordersService.findOne.mockResolvedValue(mockOrder);

    const result = await service.createRefund({
      orderId: 'order-refund-123',
      amount: 50,
      reason: 'Devolución de bandeja',
    });

    expect(result.success).toBe(true);
    expect(result.refundedAmount).toBe(50);
    expect(result.paymentStatus).toBe('partially_refunded');

    await new Promise(r => setTimeout(r, 10));
    expect(mailService.sendRefundReceipt).toHaveBeenCalledWith(
      mockOrder,
      'refund-target@example.com',
      {
        refundedAmount: 50,
        totalRefunded: 50,
        reason: 'Devolución de bandeja',
      }
    );
  });

  describe('Sprint 47: Credit Settlement Processing Fee (TASK-47-03)', () => {
    it('should apply 3.5% fee on credit settlement when paying with card without absorbing it', async () => {
      ordersService.findOne.mockResolvedValueOnce({
        id: 'order-credit-settle-01',
        total: 200,
        refunded_amount: 0,
        payment_status: 'pending',
        user: { email: 'credit-buyer@example.com' },
      });

      const res = await service.createSettlementLink({
        orderId: 'order-credit-settle-01',
        paymentMethod: 'STRIPE_CARD',
      });

      // 200 * 0.035 = 7.00. Total to charge = 207.00
      expect(res.balance).toBe(200);
      expect(res.feeAmount).toBe(7.00);
      expect(res.feeMethod).toBe('STRIPE_CARD');
      expect(res.amount).toBe(207.00);
    });

    it('should apply 0.8% fee capped at $5.00 on credit settlement when paying with ACH', async () => {
      ordersService.findOne.mockResolvedValueOnce({
        id: 'order-credit-settle-ach',
        total: 1000,
        refunded_amount: 0,
        payment_status: 'pending',
        user: { email: 'ach-buyer@example.com' },
      });

      const res = await service.createSettlementLink({
        orderId: 'order-credit-settle-ach',
        paymentMethod: 'ACH',
      });

      // 1000 * 0.008 = 8.00 -> capped at 5.00. Total to charge = 1005.00
      expect(res.balance).toBe(1000);
      expect(res.feeAmount).toBe(5.00);
      expect(res.feeMethod).toBe('ACH');
      expect(res.amount).toBe(1005.00);
    });

    it('TASK-71-08 Happy Path: should settle strictly pending_balance ($350) when order has remaining balance (total $2523.83)', async () => {
      ordersService.findOne.mockResolvedValueOnce({
        id: 'order-f8f17c1a-partial',
        total: 2523.83,
        refunded_amount: 0,
        payment_status: 'partially_paid',
        pending_balance: 350.00,
        user: { email: 'kneadtoeatbakery@gmail.com' },
      });

      const res = await service.createSettlementLink({
        orderId: 'order-f8f17c1a-partial',
        paymentMethod: 'STRIPE_CARD',
      });

      // 350 * 0.035 = 12.25. Total to charge = 362.25
      expect(res.balance).toBe(350.00);
      expect(res.feeAmount).toBe(12.25);
      expect(res.feeMethod).toBe('STRIPE_CARD');
      expect(res.amount).toBe(362.25);
      expect(res.orderId).toBe('order-f8f17c1a-partial');
    });

    it('TASK-71-08 Sad Path: should throw BadRequestException when order is already fully paid with pending_balance 0', async () => {
      ordersService.findOne.mockResolvedValueOnce({
        id: 'order-already-paid',
        total: 200,
        refunded_amount: 0,
        payment_status: 'paid',
        pending_balance: 0,
        user: { email: 'buyer@example.com' },
      });

      await expect(service.createSettlementLink({
        orderId: 'order-already-paid',
        paymentMethod: 'STRIPE_CARD',
      })).rejects.toThrow(BadRequestException);
    });

    it('TASK-71-08 Sad Path: should throw NotFoundException when order does not exist', async () => {
      ordersService.findOne.mockResolvedValueOnce(null);

      await expect(service.createSettlementLink({
        orderId: 'non-existent-order',
        paymentMethod: 'STRIPE_CARD',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('Sprint S70: Live Stripe & Mock Eradication (TASK-S70-07)', () => {
    it('should return empty list when user has no saved payment methods (zero seeded mocks)', async () => {
      usersService.findOne.mockResolvedValueOnce({
        id: 'user-no-cards',
        email: 'real@jhoanes.com',
        stripe_customer_id: null,
      });

      const methods = await service.getPaymentMethods('user-no-cards');
      expect(methods).toEqual([]);
      expect(methods.length).toBe(0);
    });

    it('should throw BadRequestException on createPaymentIntent if Stripe is uninitialized (sad path)', async () => {
      (service as any).stripe = null;
      await expect(service.createPaymentIntent({
        amount: 50.00,
        currency: 'usd',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on createSetupIntent if Stripe is uninitialized (sad path)', async () => {
      (service as any).stripe = null;
      await expect(service.createSetupIntent('user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on getOrCreateCustomer if Stripe is uninitialized (sad path)', async () => {
      (service as any).stripe = null;
      await expect(service.getOrCreateCustomer('user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
