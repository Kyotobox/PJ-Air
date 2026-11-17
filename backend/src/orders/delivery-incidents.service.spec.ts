import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DeliveryIncidentsService } from './delivery-incidents.service';
import { DeliveryIncident } from './entities/delivery-incident.entity';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

describe('DeliveryIncidentsService', () => {
  let service: DeliveryIncidentsService;
  let incidentRepo: jest.Mocked<Repository<DeliveryIncident>>;
  let orderRepo: jest.Mocked<Repository<Order>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const mockIncidentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'mock-incident-uuid' })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: entity.id || 'mock-incident-uuid' })),
    };

    const mockOrderRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const mockMailService = {
      sendStoreCreditCard: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryIncidentsService,
        {
          provide: getRepositoryToken(DeliveryIncident),
          useValue: mockIncidentRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<DeliveryIncidentsService>(DeliveryIncidentsService);
    incidentRepo = module.get(getRepositoryToken(DeliveryIncident));
    orderRepo = module.get(getRepositoryToken(Order));
    userRepo = module.get(getRepositoryToken(User));
    mailService = module.get(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateVoucherCode', () => {
    it('should generate SC-YYYY-0001 when no previous incidents exist', async () => {
      incidentRepo.find.mockResolvedValue([]);
      incidentRepo.findOne.mockResolvedValue(null);

      const code = await service.generateVoucherCode(2026);
      expect(code).toBe('SC-2026-0001');
    });

    it('should increment sequence when previous incident exists', async () => {
      incidentRepo.find.mockResolvedValue([
        { voucher_code: 'SC-2026-0007' } as DeliveryIncident,
      ]);

      const code = await service.generateVoucherCode(2026);
      expect(code).toBe('SC-2026-0008');
    });

    it('should handle transition between single and multi-digit correlatives', async () => {
      incidentRepo.find.mockResolvedValue([
        { voucher_code: 'SC-2026-0099' } as DeliveryIncident,
      ]);

      const code = await service.generateVoucherCode(2026);
      expect(code).toBe('SC-2026-0100');
    });
  });

  describe('createIncident', () => {
    const mockOrder = {
      id: 'order-uuid-1',
      user_id: 'user-uuid-1',
      items: [
        { product_id: 101, quantity: 5, price_at_time: 12.5 },
        { product_id: 102, quantity: 2, price_at_time: 20.0 },
      ],
    } as any;

    it('should calculate amount automatically when not provided and persist incident', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder);
      incidentRepo.find.mockResolvedValue([]);

      const result = await service.createIncident({
        order_id: 'order-uuid-1',
        product_id: 101,
        quantity: 2,
        reason_category: 'transit_damage',
        description: 'Cajas rotas durante el trayecto',
      });

      expect(orderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        relations: ['items'],
      });
      expect(incidentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-uuid-1',
          user_id: 'user-uuid-1',
          product_id: 101,
          quantity: 2,
          amount: 25.0, // 2 * 12.5
          reason_category: 'transit_damage',
          voucher_code: expect.stringMatching(/^SC-\d{4}-\d{4}$/),
          status: 'pending_review',
        }),
      );
      expect(result.amount).toBe(25.0);
    });

    it('should respect custom amount when provided explicitly', async () => {
      orderRepo.findOne.mockResolvedValue(mockOrder);
      incidentRepo.find.mockResolvedValue([]);

      const result = await service.createIncident({
        order_id: 'order-uuid-1',
        product_id: 102,
        quantity: 1,
        amount: 15.0,
        reason_category: 'quality_defect',
      });

      expect(incidentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15.0,
        }),
      );
      expect(result.amount).toBe(15.0);
    });

    describe('Sad Paths (§6)', () => {
      it('should throw NotFoundException when order does not exist', async () => {
        orderRepo.findOne.mockResolvedValue(null);

        await expect(
          service.createIncident({
            order_id: 'non-existent-order',
            product_id: 101,
            quantity: 1,
            reason_category: 'missing_kitchen',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException when product is not in order', async () => {
        orderRepo.findOne.mockResolvedValue(mockOrder);

        await expect(
          service.createIncident({
            order_id: 'order-uuid-1',
            product_id: 999, // Producto no presente
            quantity: 1,
            reason_category: 'wrong_item',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when order_id is missing', async () => {
        await expect(
          service.createIncident({
            order_id: '',
            product_id: 101,
            quantity: 1,
            reason_category: 'missing_kitchen',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when quantity <= 0', async () => {
        orderRepo.findOne.mockResolvedValue(mockOrder);

        await expect(
          service.createIncident({
            order_id: 'order-uuid-1',
            product_id: 101,
            quantity: 0,
            reason_category: 'missing_kitchen',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw ForbiddenException when userContext does not match order owner and is not admin', async () => {
        orderRepo.findOne.mockResolvedValue(mockOrder);

        await expect(
          service.createIncident(
            {
              order_id: 'order-uuid-1',
              product_id: 101,
              quantity: 1,
              reason_category: 'missing_kitchen',
            },
            { id: 'another-user-uuid', role: 'client' },
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should allow incident reporting when userContext is admin even if not owner', async () => {
        orderRepo.findOne.mockResolvedValue(mockOrder);
        incidentRepo.find.mockResolvedValue([]);

        const result = await service.createIncident(
          {
            order_id: 'order-uuid-1',
            product_id: 101,
            quantity: 1,
            reason_category: 'missing_kitchen',
          },
          { id: 'admin-uuid', role: 'admin' },
        );

        expect(result).toBeDefined();
      });
    });
  });

  describe('approveIncident', () => {
    const mockIncident = {
      id: 'incident-uuid-1',
      order_id: 'order-uuid-1',
      user_id: 'user-uuid-1',
      product_id: 101,
      quantity: 2,
      amount: 50.0,
      voucher_code: 'SC-2026-0001',
      status: 'pending_review',
      reviewed_by: null,
    } as any;

    const mockUser = {
      id: 'user-uuid-1',
      credit_balance: 100.0,
    } as any;

    it('should atomically approve incident, record reviewer, and increment user.credit_balance', async () => {
      incidentRepo.findOne.mockResolvedValue({ ...mockIncident });
      userRepo.findOne.mockResolvedValue({ ...mockUser });

      const approved = await service.approveIncident('incident-uuid-1', 'admin-super-id');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-uuid-1',
          credit_balance: 150.0, // 100.0 + 50.0
        }),
      );

      expect(incidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'incident-uuid-1',
          status: 'approved',
          reviewed_by: 'admin-super-id',
        }),
      );

      expect(approved.status).toBe('approved');
      expect(approved.reviewed_by).toBe('admin-super-id');
    });

    it('should invoke sendStoreCreditCard asynchronously when incident is approved and user has email', async () => {
      const userWithEmail = {
        ...mockUser,
        email: 'b2b-customer@example.com',
        profile: { company_name: 'Boulangerie Gourmet' },
      };

      const mockOrderWithProduct = {
        id: 'order-uuid-1',
        items: [
          {
            product_id: 101,
            product: { name: 'Pain au Chocolat' },
          },
        ],
      };

      incidentRepo.findOne.mockResolvedValue({
        ...mockIncident,
        photo_url: 'https://cdn.jhoanes.com/photos/sc-evidence.jpg',
      });
      userRepo.findOne.mockResolvedValue(userWithEmail);
      orderRepo.findOne.mockResolvedValue(mockOrderWithProduct as any);

      const result = await service.approveIncident('incident-uuid-1', 'admin-id-123');

      expect(result.status).toBe('approved');

      // Wait a tick for non-blocking async dispatch
      await new Promise((r) => setImmediate(r));

      expect(mailService.sendStoreCreditCard).toHaveBeenCalledWith(
        'b2b-customer@example.com',
        expect.objectContaining({
          clientName: 'Boulangerie Gourmet',
          voucherCode: 'SC-2026-0001',
          amount: 50.0,
          newTotalBalance: 150.0,
          productName: 'Pain au Chocolat',
          quantity: 2,
          reasonLabel: 'Incidencia de entrega',
          photoUrl: 'https://cdn.jhoanes.com/photos/sc-evidence.jpg',
        }),
      );
    });

    it('should handle non-blocking error gracefully if mailService.sendStoreCreditCard rejects', async () => {
      const userWithEmail = {
        ...mockUser,
        email: 'b2b-customer@example.com',
      };

      incidentRepo.findOne.mockResolvedValue({ ...mockIncident });
      userRepo.findOne.mockResolvedValue(userWithEmail);
      mailService.sendStoreCreditCard.mockRejectedValueOnce(new Error('SMTP Network Offline'));

      const result = await service.approveIncident('incident-uuid-1', 'admin-id-123');

      expect(result).toBeDefined();
      expect(result.status).toBe('approved');
    });

    describe('Sad Paths (§6) & Idempotencia', () => {
      it('should be idempotent: when incident is already approved, does not increment user balance again', async () => {
        const alreadyApprovedIncident = {
          ...mockIncident,
          status: 'approved',
          reviewed_by: 'previous-admin',
        };

        incidentRepo.findOne.mockResolvedValue(alreadyApprovedIncident);

        const result = await service.approveIncident('incident-uuid-1', 'admin-super-id');

        // Idempotency: userRepo.save must NOT be called
        expect(userRepo.save).not.toHaveBeenCalled();
        expect(incidentRepo.save).not.toHaveBeenCalled();
        expect(result.status).toBe('approved');
      });

      it('should throw NotFoundException when incident does not exist', async () => {
        incidentRepo.findOne.mockResolvedValue(null);

        await expect(
          service.approveIncident('non-existent-incident', 'admin-id'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException when user does not exist', async () => {
        incidentRepo.findOne.mockResolvedValue({ ...mockIncident });
        userRepo.findOne.mockResolvedValue(null);

        await expect(
          service.approveIncident('incident-uuid-1', 'admin-id'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('findByOrder', () => {
    it('should return incidents for an order', async () => {
      const incidents = [{ id: 'inc-1', order_id: 'order-1' } as DeliveryIncident];
      incidentRepo.find.mockResolvedValue(incidents);

      const result = await service.findByOrder('order-1');
      expect(result).toBe(incidents);
      expect(incidentRepo.find).toHaveBeenCalledWith({
        where: { order_id: 'order-1' },
        order: { created_at: 'DESC' },
      });
    });

    it('should throw ForbiddenException if non-admin tries to view incidents of another user order', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        user_id: 'owner-id',
      } as any);

      await expect(
        service.findByOrder('order-1', { id: 'other-user', role: 'client' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByUser', () => {
    it('should return incidents for a user', async () => {
      const incidents = [{ id: 'inc-1', user_id: 'user-1' } as DeliveryIncident];
      incidentRepo.find.mockResolvedValue(incidents);

      const result = await service.findByUser('user-1');
      expect(result).toBe(incidents);
      expect(incidentRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'user-1' },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return incident when found', async () => {
      const incident = { id: 'inc-1' } as DeliveryIncident;
      incidentRepo.findOne.mockResolvedValue(incident);

      const result = await service.findById('inc-1');
      expect(result).toBe(incident);
    });

    it('should throw NotFoundException when not found', async () => {
      incidentRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
