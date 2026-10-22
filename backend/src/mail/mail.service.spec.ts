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

  it('should send credit alert email without throwing error', async () => {
    const result = await service.sendCreditAlert('test-customer@example.com', 'Cliente Mayorista', 1200, 1000, true);
    expect(typeof result).toBe('boolean');
  });
});
