import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionCron } from './collection.cron';
import { Order } from '../orders/order.entity';
import { MailService } from '../mail/mail.service';
import { SmsService } from '../sms/sms.service';

describe('CollectionCron', () => {
  let cron: CollectionCron;
  let mockOrderRepository: any;
  let mockMailService: any;
  let mockSmsService: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockOrderRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    mockMailService = {
      sendOverdueInvoiceAlert: jest.fn().mockResolvedValue(true),
    };

    mockSmsService = {
      sendOverdueAlert: jest.fn().mockResolvedValue({ success: true, sid: 'SM123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionCron,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
      ],
    }).compile();

    cron = module.get<CollectionCron>(CollectionCron);
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  describe('Happy Path (TASK-44-01 & TASK-44-04)', () => {
    it('should query overdue orders and trigger Email and SMS notifications for eligible clients', async () => {
      const mockOverdueOrders = [
        {
          id: 'ord-overdue-001',
          total: 250.00,
          payment_due_date: '2026-10-20',
          payment_status: 'pending',
          status: 'En Producción',
          items: [{ product: { name: 'Pan Gallego' }, quantity: 10, price_at_time: 25.00 }],
          user: {
            email: 'cliente1@restaurante.com',
            profile: {
              company_name: 'Restaurante Los Olivos',
              phone: '+17185550111',
              phone_verified: true,
            },
          },
        },
        {
          id: 'ord-overdue-002',
          total: 180.50,
          payment_due_date: '2026-10-25',
          payment_status: 'pending',
          status: 'Pedido Recibido',
          items: [{ product: { name: 'Croissants' }, quantity: 30, price_at_time: 6.00 }],
          user: {
            email: 'cliente2@cafeteria.com',
            profile: {
              full_name: 'Juan Perez',
              phone: '+17185550222',
              phone_verified: false, // Sad path: unverified phone should NOT receive SMS
            },
          },
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockOverdueOrders);

      const summary = await cron.handleDailyOverdueCheck();

      expect(mockOrderRepository.createQueryBuilder).toHaveBeenCalledWith('order');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('order.payment_due_date IS NOT NULL');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.payment_due_date <= :todayNY',
        expect.objectContaining({ todayNY: expect.any(String) }),
      );

      // Verificación de envío de correos
      expect(mockMailService.sendOverdueInvoiceAlert).toHaveBeenCalledTimes(2);
      expect(mockMailService.sendOverdueInvoiceAlert).toHaveBeenCalledWith(
        'cliente1@restaurante.com',
        expect.objectContaining({
          id: 'ord-overdue-001',
          total: 250.00,
          payment_due_date: '2026-10-20',
          clientName: 'Restaurante Los Olivos',
        }),
      );

      // Verificación de SMS diferido sólo para cliente con phone_verified === true
      expect(mockSmsService.sendOverdueAlert).toHaveBeenCalledTimes(1);
      expect(mockSmsService.sendOverdueAlert).toHaveBeenCalledWith(
        '+17185550111',
        expect.stringContaining('Panaderia Jhoanes: Su orden #ord-over ($250.00) vencio el 2026-10-20'),
      );

      expect(summary).toEqual({
        processed: 2,
        emailsSent: 2,
        smsSent: 1,
        errors: 0,
      });
    });
  });

  describe('Sad Path (§6 & Guardrails)', () => {
    it('should handle order with missing user email without crashing', async () => {
      const mockOverdueOrders = [
        {
          id: 'ord-no-email-003',
          total: 99.00,
          payment_due_date: '2026-10-22',
          payment_status: 'pending',
          status: 'En Producción',
          user: null, // Sin usuario asociado
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockOverdueOrders);

      const summary = await cron.handleDailyOverdueCheck();

      expect(mockMailService.sendOverdueInvoiceAlert).not.toHaveBeenCalled();
      expect(mockSmsService.sendOverdueAlert).not.toHaveBeenCalled();
      expect(summary.processed).toBe(1);
      expect(summary.emailsSent).toBe(0);
      expect(summary.errors).toBe(0);
    });

    it('should catch individual order errors and continue processing subsequent orders', async () => {
      const mockOverdueOrders = [
        {
          id: 'ord-failing-004',
          total: 100.00,
          payment_due_date: '2026-10-21',
          payment_status: 'pending',
          status: 'En Producción',
          user: { email: 'fail@example.com' },
        },
        {
          id: 'ord-success-005',
          total: 200.00,
          payment_due_date: '2026-10-22',
          payment_status: 'pending',
          status: 'En Producción',
          user: { email: 'success@example.com' },
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockOverdueOrders);
      mockMailService.sendOverdueInvoiceAlert
        .mockRejectedValueOnce(new Error('SMTP connection timed out'))
        .mockResolvedValueOnce(true);

      const summary = await cron.handleDailyOverdueCheck();

      expect(summary.processed).toBe(2);
      expect(summary.emailsSent).toBe(1);
      expect(summary.errors).toBe(1);
    });

    it('should catch database query failure safely', async () => {
      mockQueryBuilder.getMany.mockRejectedValue(new Error('Database lock error'));

      const summary = await cron.handleDailyOverdueCheck();

      expect(summary.processed).toBe(0);
      expect(summary.errors).toBe(1);
    });
  });
});
