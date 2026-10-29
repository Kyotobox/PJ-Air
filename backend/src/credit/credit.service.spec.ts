import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreditService } from './credit.service';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

describe('CreditService', () => {
  let service: CreditService;
  let userRepository: jest.Mocked<Repository<User>>;
  let orderRepository: jest.Mocked<Repository<Order>>;

  beforeEach(async () => {
    const mockUserRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const mockOrderRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
    userRepository = module.get(getRepositoryToken(User));
    orderRepository = module.get(getRepositoryToken(Order));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Happy Path: Límite, Usado, Disponible y +7 Días', () => {
    it('should retrieve authorized credit limit from user profile/account', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-b2b-01',
        credit_limit: 1500.50,
      } as any);

      const limit = await service.getCreditLimit('user-b2b-01');
      expect(limit).toBe(1500.50);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-b2b-01' },
        relations: ['profile'],
      });
    });

    it('should calculate strictly net used credit from active credit orders, discounting refunds', async () => {
      orderRepository.find.mockResolvedValue([
        // Active credit order 1: total 300, refund 50 -> net 250
        { id: 'o-1', payment_method: 'credit', status: 'En Producción', payment_status: 'pending', total: 300, refunded_amount: 50 },
        // Active credit order 2: total 100, no refund -> net 100
        { id: 'o-2', payment_method: 'credit', status: 'confirmed', payment_status: 'unpaid', total: 100, refunded_amount: 0 },
        // Cancelled credit order: should be ignored
        { id: 'o-3', payment_method: 'credit', status: 'cancelled', payment_status: 'pending', total: 500, refunded_amount: 0 },
        // Cancelled Spanish credit order: should be ignored
        { id: 'o-4', payment_method: 'credit', status: 'Cancelado', payment_status: 'pending', total: 200, refunded_amount: 0 },
        // Paid credit order: should be ignored
        { id: 'o-5', payment_method: 'credit', status: 'delivered', payment_status: 'paid', total: 400, refunded_amount: 0 },
        // Non-credit order (Stripe): should be ignored
        { id: 'o-6', payment_method: 'stripe', status: 'confirmed', payment_status: 'pending', total: 350, refunded_amount: 0 },
        // Non-credit order (Zelle): should be ignored
        { id: 'o-7', payment_method: 'zelle', status: 'pending', payment_status: 'pending_zelle_verification', total: 200, refunded_amount: 0 },
      ] as any[]);

      const used = await service.getUsedCredit('user-b2b-01');
      // Expected net used: 250 + 100 = 350
      expect(used).toBe(350);
    });

    it('should calculate available credit as (creditLimit - usedCredit)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-b2b-01',
        credit_limit: 1000,
      } as any);

      orderRepository.find.mockResolvedValue([
        { id: 'o-1', payment_method: 'credit', status: 'confirmed', payment_status: 'pending', total: 400, refunded_amount: 0 },
      ] as any[]);

      const available = await service.getAvailableCredit('user-b2b-01');
      // 1000 - 400 = 600
      expect(available).toBe(600);
    });

    it('should return complete financial health summary in getClientCreditSummary', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-b2b-01',
        credit_limit: 1000,
        credit_blocked: false,
        credit_override: false,
      } as any);

      orderRepository.find.mockResolvedValue([
        { id: 'o-1', payment_method: 'credit', status: 'confirmed', payment_status: 'pending', total: 350, refunded_amount: 0 },
      ] as any[]);

      const summary = await service.getClientCreditSummary('user-b2b-01');
      expect(summary.credit_limit).toBe(1000);
      expect(summary.used_credit).toBe(350);
      expect(summary.available_credit).toBe(650);
      expect(summary.credit_blocked).toBe(false);
      expect(summary.credit_override).toBe(false);
    });

    it('should calculate deterministic payment_due_date = created_at + 7 days in ISO YYYY-MM-DD', () => {
      const fixedCreatedAt = new Date('2026-10-25T14:30:00.000Z');
      const dueDate = service.calculatePaymentDueDate(fixedCreatedAt);
      expect(dueDate).toBe('2026-11-01');

      // Also verify with string input
      const dueDateFromStr = service.calculatePaymentDueDate('2026-03-01T00:00:00.000Z');
      expect(dueDateFromStr).toBe('2026-03-08');
    });

    it('should approve credit order when amount is within available credit', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-b2b-01',
        credit_limit: 1000,
        credit_override: false,
      } as any);

      orderRepository.find.mockResolvedValue([
        { id: 'o-1', payment_method: 'credit', status: 'confirmed', payment_status: 'pending', total: 400, refunded_amount: 0 },
      ] as any[]);

      // Available: 600. Order: 500 <= 600
      await expect(service.validateCreditOrder('user-b2b-01', 500)).resolves.not.toThrow();
    });
  });

  describe('Sad Path (§6): Sobregiro, Sin Cupo y Excepciones', () => {
    it('should reject order with BadRequestException if orderAmount exceeds availableCredit (Sobregiro)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-overdraft',
        credit_limit: 500,
        credit_override: false,
      } as any);

      orderRepository.find.mockResolvedValue([
        { id: 'o-1', payment_method: 'credit', status: 'confirmed', payment_status: 'pending', total: 450, refunded_amount: 0 },
      ] as any[]);

      // Available: 500 - 450 = 50. Order: 100 > 50 -> Sobregiro!
      await expect(service.validateCreditOrder('user-overdraft', 100)).rejects.toThrow(BadRequestException);
    });

    it('should reject order with BadRequestException if client has zero credit limit (Sin Cupo)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-no-credit',
        credit_limit: 0,
        credit_override: false,
      } as any);

      orderRepository.find.mockResolvedValue([] as any[]);

      // Available: 0 - 0 = 0. Order: 25 > 0 -> Sin Cupo!
      await expect(service.validateCreditOrder('user-no-credit', 25)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if client does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getCreditLimit('non-existent-client')).rejects.toThrow(NotFoundException);
      await expect(service.validateCreditOrder('non-existent-client', 100)).rejects.toThrow(NotFoundException);
    });

    it('should allow overdraft if user has credit_override = true', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-override',
        credit_limit: 500,
        credit_override: true,
      } as any);

      orderRepository.find.mockResolvedValue([
        { id: 'o-1', payment_method: 'credit', status: 'confirmed', payment_status: 'pending', total: 480, refunded_amount: 0 },
      ] as any[]);

      // Available: 20. Order: 200 > 20, but credit_override is true
      await expect(service.validateCreditOrder('user-override', 200)).resolves.not.toThrow();
    });
  });
});
