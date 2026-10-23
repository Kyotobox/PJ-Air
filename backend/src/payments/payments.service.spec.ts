import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { BadRequestException } from '@nestjs/common';

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
});
