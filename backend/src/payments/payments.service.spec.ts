import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: any;

  beforeEach(async () => {
    ordersService = {
      update: jest.fn().mockResolvedValue({ id: 'order-1', payment_status: 'paid' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: OrdersService, useValue: ordersService },
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

  it('should reconcile order via webhook event payment_intent.succeeded', async () => {
    const webhookEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          metadata: { orderId: 'order-reconciled-789' },
        },
      },
    };

    const result = await service.handleWebhook(webhookEvent);
    expect(result.received).toBe(true);
    expect(ordersService.update).toHaveBeenCalledWith('order-reconciled-789', { payment_status: 'paid' }, 'admin');
  });
});
