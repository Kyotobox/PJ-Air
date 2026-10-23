import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send order receipt email without throwing error', async () => {
    const mockOrder = {
      id: 'order-mail-test-123',
      total: 150.00,
      delivery_date: '2026-11-10',
      delivery_fee_charged: 15.00,
      payment_status: 'paid',
      items: [
        { product: { name: 'Pan de Masa Madre' }, quantity: 10, price_at_time: 13.50 }
      ],
    };

    const result = await service.sendOrderReceipt(mockOrder, 'test-customer@example.com');
    expect(typeof result).toBe('boolean');
  });

  it('should send admin new order alert without throwing error', async () => {
    const mockOrder = {
      id: 'order-admin-alert-789',
      total: 350.00,
      delivery_date: '2026-11-12',
      delivery_type: 'saved',
      delivery_address_text: 'Av. Libertador 450, Local 3',
      payment_status: 'credit',
      items: [
        { product_name: 'Baguette Rústica', quantity: 50, price_at_time: 7.00 }
      ],
    };

    const result = await service.sendAdminNewOrderAlert(mockOrder, 'restaurante@example.com', 'Restaurante Gourmet');
    expect(typeof result).toBe('boolean');
  });

  it('should send refund receipt email without throwing error', async () => {
    const mockOrder = {
      id: 'order-refund-test-456',
      total: 200.00,
    };

    const refundData = {
      refundedAmount: 50.00,
      totalRefunded: 50.00,
      reason: 'Ajuste comercial por faltante de empaque',
    };

    const result = await service.sendRefundReceipt(mockOrder, 'test-customer@example.com', refundData);
    expect(typeof result).toBe('boolean');
  });

  it('should send standing order confirmation email without throwing error', async () => {
    const mockScheduledOrder = {
      id: 'sched-test-999',
      title: 'Suscripción Restaurante Semanal',
      delivery_days_json: JSON.stringify(['mon', 'wed', 'fri']),
      delivery_time: '07:30',
      delivery_type: 'saved',
      payment_method: 'credit',
      total: 420.00,
      items_json: JSON.stringify([
        { productName: 'Croissant Mantequilla', quantity: 30, price: 3.50 },
        { productName: 'Pan de Campo 800g', quantity: 20, price: 6.00 },
      ]),
    };

    const result = await service.sendStandingOrderConfirmation(
      mockScheduledOrder,
      'chef@restaurante.com',
      'Chef Principal'
    );
    expect(typeof result).toBe('boolean');
  });

  it('should send credit alert email without throwing error', async () => {
    const result = await service.sendCreditAlert('test-customer@example.com', 'Cliente Mayorista', 1200, 1000, true);
    expect(typeof result).toBe('boolean');
  });

  it('should send payment failed alert email without throwing error', async () => {
    const result = await service.sendPaymentFailedAlert(
      'test-customer@example.com',
      'Cliente Mayorista',
      'order-failed-123',
      180.00,
      'Fondos insuficientes en la tarjeta'
    );
    expect(typeof result).toBe('boolean');
  });
});
