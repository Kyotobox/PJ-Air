import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CheckPaymentsService } from './check-payments.service';
import { CheckPayment } from './check-payment.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

describe('CheckPaymentsService (TASK-45-06)', () => {
  let service: CheckPaymentsService;
  let mockCheckPaymentRepo: any;
  let mockOrderRepo: any;
  let mockUserRepo: any;

  const mockOrder: Partial<Order> = {
    id: 'ord-uuid-123',
    user_id: 'usr-uuid-456',
    total: 350.0,
    status: 'pending',
    payment_status: 'pending',
    payment_method: 'credit',
    notes: 'Existing order note',
  };

  const mockUser: Partial<User> = {
    id: 'usr-uuid-456',
    email: 'client@bakery.com',
    credit_limit: 1000.0,
    credit_override: true,
    credit_blocked: false,
  };

  const mockCheck: Partial<CheckPayment> = {
    id: 'chk-uuid-789',
    order_id: 'ord-uuid-123',
    user_id: 'usr-uuid-456',
    check_number: 'CHK-9988',
    bank_name: 'Chase Bank',
    amount: 350.0,
    received_date: '2026-10-30', // Friday
    clearance_deadline: '2026-11-04', // Wednesday (+3 business days)
    status: 'IN_HAND',
    notes: 'Initial check receipt',
    created_at: new Date('2026-10-30T10:00:00Z'),
  };

  beforeEach(async () => {
    mockCheckPaymentRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'chk-new-id' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ ...entity })),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockOrderRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((order) => Promise.resolve({ ...order })),
    };

    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((user) => Promise.resolve({ ...user })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckPaymentsService,
        {
          provide: getRepositoryToken(CheckPayment),
          useValue: mockCheckPaymentRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<CheckPaymentsService>(CheckPaymentsService);
  });

  describe('registerCheck()', () => {
    it('Happy Path: should register check and calculate clearance_deadline +3 business days', async () => {
      mockOrderRepo.findOne.mockResolvedValue({ ...mockOrder });

      const dto = {
        order_id: 'ord-uuid-123',
        check_number: '10024',
        bank_name: 'Bank of America',
        amount: 350.0,
        received_date: '2026-10-30', // Friday
        notes: 'Deposit next week',
      };

      const result = await service.registerCheck(dto);

      expect(mockOrderRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ord-uuid-123' },
        relations: ['user'],
      });
      expect(mockCheckPaymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'ord-uuid-123',
          user_id: 'usr-uuid-456',
          check_number: '10024',
          bank_name: 'Bank of America',
          amount: 350.0,
          received_date: '2026-10-30',
          clearance_deadline: '2026-11-04', // 3 business days from Friday
          status: 'IN_HAND',
        })
      );
      expect(mockCheckPaymentRepo.save).toHaveBeenCalled();
      expect(result.clearance_deadline).toBe('2026-11-04');
    });

    it('Sad Path: should throw BadRequestException if required fields are missing', async () => {
      await expect(
        service.registerCheck({
          order_id: '',
          check_number: '100',
          bank_name: 'Chase',
          amount: 100,
          received_date: '2026-10-30',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad Path: should throw BadRequestException if amount is less than or equal to zero', async () => {
      await expect(
        service.registerCheck({
          order_id: 'ord-1',
          check_number: '100',
          bank_name: 'Chase',
          amount: 0,
          received_date: '2026-10-30',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad Path: should throw NotFoundException if order does not exist', async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.registerCheck({
          order_id: 'non-existent-order',
          check_number: '100',
          bank_name: 'Chase',
          amount: 250,
          received_date: '2026-10-30',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsDeposited()', () => {
    it('Happy Path: should mark check as DEPOSITED and release credit quota by setting order payment_status = paid', async () => {
      const checkInstance = { ...mockCheck, status: 'IN_HAND' as const };
      const orderInstance = { ...mockOrder, payment_status: 'pending' };

      mockCheckPaymentRepo.findOne.mockResolvedValue(checkInstance);
      mockOrderRepo.findOne.mockResolvedValue(orderInstance);

      const result = await service.markAsDeposited('chk-uuid-789', 'Deposited via Chase ATM');

      expect(result.status).toBe('DEPOSITED');
      expect(mockCheckPaymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DEPOSITED',
          notes: expect.stringContaining('Deposited via Chase ATM'),
        })
      );

      // Liberación de cupo de crédito: order.payment_status = 'paid'
      expect(mockOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ord-uuid-123',
          payment_status: 'paid',
        })
      );
    });

    it('Sad Path: should throw NotFoundException if check does not exist', async () => {
      mockCheckPaymentRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsDeposited('invalid-check-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('markAsBounced()', () => {
    it('Sad Path (§6): should mark check as BOUNCED, revert order to pending/debt, and block customer credit', async () => {
      const checkInstance = { ...mockCheck, status: 'DEPOSITED' as const };
      const orderInstance = { ...mockOrder, payment_status: 'paid', notes: 'Initial note' };
      const userInstance = {
        ...mockUser,
        credit_override: true,
        credit_blocked: false,
      };

      mockCheckPaymentRepo.findOne.mockResolvedValue(checkInstance);
      mockOrderRepo.findOne.mockResolvedValue(orderInstance);
      mockUserRepo.findOne.mockResolvedValue(userInstance);

      const result = await service.markAsBounced(
        'chk-uuid-789',
        'Fondos insuficientes (NSF)'
      );

      // Check status updated
      expect(result.status).toBe('BOUNCED');
      expect(mockCheckPaymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'BOUNCED',
          notes: expect.stringContaining('Fondos insuficientes (NSF)'),
        })
      );

      // Order reverted to pending debt
      expect(mockOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ord-uuid-123',
          payment_status: 'pending',
          notes: expect.stringContaining('[ALERTA CONTABLE] Cheque #CHK-9988 rebotado'),
        })
      );

      // Customer credit blocked and override revoked
      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'usr-uuid-456',
          credit_override: false,
          credit_blocked: true,
        })
      );
    });

    it('Sad Path: should throw NotFoundException if check does not exist', async () => {
      mockCheckPaymentRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsBounced('invalid-check-id', 'NSF')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getReconciliationGrouped() and find queries', () => {
    it('should categorize checks into inHand, deposited, and bounced tabs', async () => {
      const check1 = { ...mockCheck, id: 'c1', status: 'IN_HAND' };
      const check2 = { ...mockCheck, id: 'c2', status: 'PENDING_RECEIPT' };
      const check3 = { ...mockCheck, id: 'c3', status: 'DEPOSITED' };
      const check4 = { ...mockCheck, id: 'c4', status: 'BOUNCED' };

      mockCheckPaymentRepo.find.mockResolvedValue([check1, check2, check3, check4]);

      const grouped = await service.getReconciliationGrouped();

      expect(grouped.inHand).toHaveLength(2);
      expect(grouped.deposited).toHaveLength(1);
      expect(grouped.bounced).toHaveLength(1);
      expect(grouped.inHand.map((c) => c.id)).toEqual(['c1', 'c2']);
      expect(grouped.deposited[0].id).toBe('c3');
      expect(grouped.bounced[0].id).toBe('c4');
    });

    it('should find check by id or throw NotFoundException', async () => {
      mockCheckPaymentRepo.findOne.mockResolvedValue({ ...mockCheck, id: 'chk-1' });
      const found = await service.findById('chk-1');
      expect(found.id).toBe('chk-1');

      mockCheckPaymentRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
