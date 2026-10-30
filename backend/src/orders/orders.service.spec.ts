import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { MailService } from '../mail/mail.service';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: any;
  let orderItemRepository: any;
  let userRepository: any;
  let productRepository: any;
  let dataSource: any;
  let mockManager: any;
  let mockMailService: any;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    };

    orderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    orderItemRepository = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    productRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockManager = {
      create: jest.fn().mockImplementation((entity, data) => data),
      save: jest.fn().mockImplementation((entity, data) => Promise.resolve(data)),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    };

    mockMailService = {
      sendCreditAlert: jest.fn().mockResolvedValue(true),
      sendOrderReceipt: jest.fn().mockResolvedValue(true),
      sendAdminNewOrderAlert: jest.fn().mockResolvedValue(true),
    };

    const mockPaymentsService = {
      createRefund: jest.fn().mockResolvedValue({ success: true, refundedAmount: 20 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: MailService, useValue: mockMailService },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate accurate order totals including all items and applied discounts', async () => {
    const orderData = {
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    };

    // Mock user with general discount and product specific special price
    userRepository.findOne.mockResolvedValue({
      id: 'user-123',
      general_discount: 10, // 10%
      productDiscounts: [
        { product_id: 1, special_price: 45 },
      ],
    });

    // Mock products via batch find
    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 }, // Special price 45 -> 45 * 2 = 90
      { id: 2, price: 100 }, // General discount 10% -> 90 * 1 = 90
    ]);

    const expectedTotal = 186.30; // 90 + 90 = 180 + 3.5% packaging fee (6.30)
    const createdOrder = { id: 'order-123', total: expectedTotal };
    
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-123', orderData);
    expect(result.total).toBe(expectedTotal);
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(mockManager.create).toHaveBeenCalledWith(Order, expect.objectContaining({
      total: expectedTotal,
    }));
  });

  it('should throw a validation error if an order item quantity is less than 1', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 0 }],
    };

    userRepository.findOne.mockResolvedValue({ id: 'user-123', productDiscounts: [] });
    productRepository.find.mockResolvedValue([{ id: 1, price: 50 }]);

    await expect(service.create('user-123', orderData)).rejects.toThrow(BadRequestException);
  });

  it('should prevent invalid order status transitions (e.g., Delivered -> Pending)', async () => {
    const existingOrder = { id: 'order-123', status: 'delivered' };
    service.findOne = jest.fn().mockResolvedValue(existingOrder);
    
    await expect(service.updateStatus('order-123', 'pending')).rejects.toThrow(BadRequestException);
  });

  it('should include delivery fee in total and persist delivery_fee_charged when delivery_type is delivery', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }],
      delivery_type: 'delivery',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-123',
      delivery_fee: 15,
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 },
    ]);

    const expectedTotal = 118.50; // 50 * 2 + 15 + 3.5% packaging fee (3.50)
    const createdOrder = { id: 'order-123', total: expectedTotal, delivery_fee_charged: 15 };
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-123', orderData);
    expect(result.total).toBe(expectedTotal);
    expect(mockManager.create).toHaveBeenCalledWith(Order, expect.objectContaining({
      total: expectedTotal,
      delivery_fee_charged: 15,
      payment_status: 'pending',
    }));
  });

  it('should set delivery_fee_charged to 0 when delivery_type is pickup even if user has a delivery fee', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }],
      delivery_type: 'pickup',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-123',
      delivery_fee: 25,
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 },
    ]);

    const expectedTotal = 103.50; // 50 * 2 + 0 + 3.5% packaging fee (3.50)
    const createdOrder = { id: 'order-123', total: expectedTotal, delivery_fee_charged: 0 };
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-123', orderData);
    expect(result.total).toBe(expectedTotal);
    expect(mockManager.create).toHaveBeenCalledWith(Order, expect.objectContaining({
      total: expectedTotal,
      delivery_fee_charged: 0,
      payment_status: 'pending',
    }));
  });

  it('should reject order if user has credit account and order total exceeds available credit without override', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }],
      delivery_type: 'pickup',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-credit-1',
      account_type: 'credit',
      credit_limit: 500,
      credit_override: false,
      orders: [
        { id: 'o-prev', total: 450, payment_status: 'pending', status: 'En Producción' },
      ],
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 }, // 50 * 2 = 100. Used: 450 + 100 = 550 > 500
    ]);

    await expect(service.create('user-credit-1', orderData)).rejects.toThrow(BadRequestException);
  });

  it('should allow order exceeding credit limit when credit_override is true', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }],
      delivery_type: 'pickup',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-credit-2',
      email: 'credit2@test.com',
      profile: { full_name: 'Empresa B2B Test' },
      account_type: 'credit',
      credit_limit: 500,
      credit_override: true, // Emergency exception authorized
      orders: [
        { id: 'o-prev', total: 450, payment_status: 'pending', status: 'En Producción' },
      ],
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 },
    ]);

    const createdOrder = { id: 'order-approved', total: 100 };
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-credit-2', orderData);
    expect(result.id).toBe('order-approved');
    expect(mockMailService.sendCreditAlert).toHaveBeenCalledWith(
      'credit2@test.com',
      'Empresa B2B Test',
      550,
      500,
      true,
    );
  });

  it('should trigger sendCreditAlert threshold warning when prospective total is between 80% and 100% of credit limit', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }], // 50 * 2 = 100
      delivery_type: 'pickup',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-credit-3',
      email: 'credit3@test.com',
      profile: { full_name: 'Cliente Alerta 80%' },
      account_type: 'credit',
      credit_limit: 500, // 80% is 400. Prospective total will be 320 + 100 = 420 (>= 400 and <= 500)
      credit_override: false,
      orders: [
        { id: 'o-prev', total: 320, payment_status: 'pending', status: 'En Producción' },
      ],
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 },
    ]);

    const createdOrder = { id: 'order-threshold-approved', total: 100 };
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-credit-3', orderData);
    expect(result.id).toBe('order-threshold-approved');
    expect(mockMailService.sendCreditAlert).toHaveBeenCalledWith(
      'credit3@test.com',
      'Cliente Alerta 80%',
      420,
      500,
      false,
    );
  });

  it('should not trigger sendCreditAlert when prospective total is below 80% of credit limit', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 1 }], // 50 * 1 = 50
      delivery_type: 'pickup',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-credit-4',
      email: 'credit4@test.com',
      profile: { full_name: 'Cliente Bajo Cupo' },
      account_type: 'credit',
      credit_limit: 500, // 80% is 400. Prospective total: 50 + 50 = 100 (< 400)
      credit_override: false,
      orders: [
        { id: 'o-prev', total: 50, payment_status: 'pending', status: 'En Producción' },
      ],
      productDiscounts: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, price: 50 },
    ]);

    const createdOrder = { id: 'order-low-total', total: 50 };
    mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
    mockManager.save.mockResolvedValue(createdOrder);
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    const result = await service.create('user-credit-4', orderData);
    expect(result.id).toBe('order-low-total');
    expect(mockMailService.sendCreditAlert).not.toHaveBeenCalled();
  });

  it('should trigger sendOrderReceipt and sendAdminNewOrderAlert on successful order creation', async () => {
    const orderData = {
      items: [{ productId: 1, quantity: 2 }],
      deliveryType: 'saved',
    };

    userRepository.findOne.mockResolvedValue({
      id: 'user-b2b',
      email: 'b2b-client@example.com',
      account_type: 'credit',
      credit_limit: 1000,
      delivery_fee: 10,
      profile: { full_name: 'Supermercado Central' },
      orders: [],
    });

    productRepository.find.mockResolvedValue([
      { id: 1, name: 'Pan Campesino', price: 20 },
    ]);

    const createdOrder = {
      id: 'order-mail-test-456',
      total: 50,
      user_id: 'user-b2b',
      payment_status: 'pending',
    };
    service.findOne = jest.fn().mockResolvedValue(createdOrder);

    await service.create('user-b2b', orderData);

    expect(mockMailService.sendOrderReceipt).toHaveBeenCalledWith(createdOrder, 'b2b-client@example.com');
    expect(mockMailService.sendAdminNewOrderAlert).toHaveBeenCalledWith(createdOrder, 'b2b-client@example.com', 'Supermercado Central');
  });

  it('should allow invalid order status transitions (e.g., Delivered -> Pending) if user is admin', async () => {
    const existingOrder = { id: 'order-123', status: 'delivered' };
    service.findOne = jest.fn().mockResolvedValue(existingOrder);
    orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));
    
    const result = await service.updateStatus('order-123', 'pending', 'admin');
    expect(result.status).toBe('pending');
  });

  describe('Sprint 39: Zelle B2B & Packaging/Cutoff Guards', () => {
    it('should create order with Zelle, packaging fee and 100% direct payment discount bonus', async () => {
      const orderData = {
        items: [{ productId: 1, quantity: 2 }], // 50 * 2 = 100
        delivery_type: 'pickup',
        payment_method: 'zelle',
        zelle_reference: 'ZEL-CONF-12345',
      };

      userRepository.findOne.mockResolvedValue({
        id: 'user-zelle-1',
        delivery_fee: 0,
        productDiscounts: [],
      });

      productRepository.find.mockResolvedValue([
        { id: 1, price: 50 },
      ]);

      const expectedTotal = 100.00; // 100 + 3.50 packaging_fee - 3.50 packaging_discount = 100
      const createdOrder = {
        id: 'order-zelle-1',
        total: expectedTotal,
        payment_method: 'zelle',
        zelle_reference: 'ZEL-CONF-12345',
        payment_status: 'pending_zelle_verification',
      };
      mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
      mockManager.save.mockResolvedValue(createdOrder);
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      const result = await service.create('user-zelle-1', orderData);
      expect(result.total).toBe(100.00);
      expect(mockManager.create).toHaveBeenCalledWith(Order, expect.objectContaining({
        payment_method: 'zelle',
        zelle_reference: 'ZEL-CONF-12345',
        packaging_fee: 3.5,
        packaging_discount: 3.5,
        payment_status: 'pending_zelle_verification',
        total: 100.00,
      }));
    });

    it('should throw BadRequestException if payment_method is zelle and zelle_reference is missing or empty', async () => {
      const orderData = {
        items: [{ productId: 1, quantity: 2 }],
        payment_method: 'zelle',
        zelle_reference: '   ',
      };

      userRepository.findOne.mockResolvedValue({ id: 'user-zelle-2', productDiscounts: [] });
      productRepository.find.mockResolvedValue([{ id: 1, price: 50 }]);

      await expect(service.create('user-zelle-2', orderData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if zelle_reference is already used in an active order', async () => {
      const orderData = {
        items: [{ productId: 1, quantity: 2 }],
        payment_method: 'zelle',
        zelle_reference: 'ZEL-DUP-999',
      };

      userRepository.findOne.mockResolvedValue({ id: 'user-zelle-3', productDiscounts: [] });
      productRepository.find.mockResolvedValue([{ id: 1, price: 50 }]);

      // Mock duplicate found in query builder
      const dupQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'existing-order', zelle_reference: 'ZEL-DUP-999', status: 'pending' }),
      };
      orderRepository.createQueryBuilder = jest.fn().mockReturnValue(dupQueryBuilder);

      await expect(service.create('user-zelle-3', orderData)).rejects.toThrow(BadRequestException);
    });

    it('should approve Zelle payment, mark order as paid, and send order receipt', async () => {
      const existingOrder = {
        id: 'order-zelle-appr',
        user_id: 'user-zelle-appr',
        payment_status: 'pending_zelle_verification',
        status: 'pending',
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));
      userRepository.findOne.mockResolvedValue({ id: 'user-zelle-appr', email: 'zelle-client@test.com' });

      const updated = await service.approveZellePayment('order-zelle-appr');
      expect(updated.payment_status).toBe('paid');
      expect(orderRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        payment_status: 'paid',
      }));
      expect(mockMailService.sendOrderReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ payment_status: 'paid' }),
        'zelle-client@test.com',
      );
    });

    it('should reject Zelle payment, mark payment_status unpaid and order status Cancelado', async () => {
      const existingOrder = {
        id: 'order-zelle-rej',
        user_id: 'user-zelle-rej',
        payment_status: 'pending_zelle_verification',
        status: 'pending',
        notes: '',
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));

      const updated = await service.rejectZellePayment('order-zelle-rej', 'Referencia inválida o no recibida');
      expect(updated.payment_status).toBe('unpaid');
      expect(updated.status).toBe('Cancelado');
      expect(updated.notes).toContain('Referencia inválida');
    });

    it('Cutoff Time Happy Path: Jueves 10 AM permite Sábado (T+2) y Jueves 3:15 PM exige Domingo (T+3)', () => {
      // Jueves 22 Octubre 2026 a las 10:00 AM NY (14:00 UTC)
      const thursday10AM = new Date('2026-10-22T14:00:00Z');
      // Sábado 24 Octubre 2026 es T+2
      expect(() => {
        service.validateCutoffTime('2026-10-24', thursday10AM, 12);
      }).not.toThrow();

      // Domingo 25 Octubre 2026 (posterior a T+2) también es permitido
      expect(() => {
        service.validateCutoffTime('2026-10-25', thursday10AM, 12);
      }).not.toThrow();

      // Jueves 22 Octubre 2026 a las 3:15 PM NY (15:15 EDT -> 19:15 UTC)
      const thursday315PM = new Date('2026-10-22T19:15:00Z');
      // Domingo 25 Octubre 2026 es T+3
      expect(() => {
        service.validateCutoffTime('2026-10-25', thursday315PM, 12);
      }).not.toThrow();
    });

    it('Cutoff Time Sad Path (§6): Jueves 3:15 PM pidiendo entrega Sábado arroja BadRequestException', () => {
      // Jueves 22 Octubre 2026 a las 3:15 PM NY (15:15 EDT -> 19:15 UTC)
      const thursday315PM = new Date('2026-10-22T19:15:00Z');
      // Sábado 24 Octubre 2026 es T+2, pero corte de 12 PM ya pasó -> debe arrojar BadRequestException
      expect(() => {
        service.validateCutoffTime('2026-10-24', thursday315PM, 12);
      }).toThrow(BadRequestException);

      // Viernes 23 Octubre (T+1) también arroja BadRequestException
      expect(() => {
        service.validateCutoffTime('2026-10-23', thursday315PM, 12);
      }).toThrow(BadRequestException);
    });

    it('should reject past delivery dates or same-day delivery', () => {
      const thursday10AM = new Date('2026-10-22T14:00:00Z');
      expect(() => {
        service.validateCutoffTime('2026-10-21', thursday10AM, 12);
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateCutoffTime('2026-10-22', thursday10AM, 12);
      }).toThrow(BadRequestException);
    });
  });

  describe('Sprint 43: Credit Payment Due Date & 7-Day Foundation', () => {
    it('should calculate payment_due_date = created_at + 7 days in YYYY-MM-DD format for credit orders', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'credit-client-43',
        account_type: 'credit',
        credit_limit: 1000,
        orders: [],
        productDiscounts: [],
      });
      productRepository.find.mockResolvedValue([{ id: 1, price: 20 }]);

      const createdOrder = { id: 'order-credit-due-date', total: 20 };
      mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
      mockManager.save.mockResolvedValue(createdOrder);
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      await service.create('credit-client-43', {
        items: [{ productId: 1, quantity: 1 }],
        delivery_type: 'pickup',
        payment_method: 'credit',
      });

      const now = new Date();
      const expectedDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expectedDateStr = `${expectedDue.getUTCFullYear()}-${String(expectedDue.getUTCMonth() + 1).padStart(2, '0')}-${String(expectedDue.getUTCDate()).padStart(2, '0')}`;

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payment_method: 'credit',
          payment_due_date: expectedDateStr,
        }),
      );
    });

    it('should set payment_due_date to null when payment_method is not credit (Sad Path §6)', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'stripe-client-43',
        account_type: 'cash',
        orders: [],
        productDiscounts: [],
      });
      productRepository.find.mockResolvedValue([{ id: 1, price: 20 }]);

      const createdOrder = { id: 'order-stripe-due-date', total: 20 };
      mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
      mockManager.save.mockResolvedValue(createdOrder);
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      await service.create('stripe-client-43', {
        items: [{ productId: 1, quantity: 1 }],
        delivery_type: 'pickup',
        payment_method: 'stripe',
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payment_method: 'stripe',
          payment_due_date: null,
        }),
      );
    });
  });

  describe('Sprint 47: Processing Fees Persistence and Audit (TASK-47-04)', () => {
    it('should calculate and persist fee_amount and fee_method for stripe card orders', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'client-fee-stripe',
        account_type: 'cash',
        orders: [],
        productDiscounts: [],
      });
      productRepository.find.mockResolvedValue([{ id: 1, price: 100 }]);

      const createdOrder = { id: 'order-fee-stripe-01', total: 103.50 };
      mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
      mockManager.save.mockResolvedValue(createdOrder);
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      await service.create('client-fee-stripe', {
        items: [{ productId: 1, quantity: 1 }],
        delivery_type: 'pickup',
        payment_method: 'stripe',
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payment_method: 'stripe',
          fee_amount: 3.50,
          fee_method: 'STRIPE_CARD',
        }),
      );
    });

    it('should calculate and persist fee_amount = 0 and fee_method = "CREDIT" for credit orders', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'client-fee-credit',
        account_type: 'credit',
        credit_limit: 1000,
        orders: [],
        productDiscounts: [],
      });
      productRepository.find.mockResolvedValue([{ id: 1, price: 200 }]);

      const createdOrder = { id: 'order-fee-credit-01', total: 200 };
      mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
      mockManager.save.mockResolvedValue(createdOrder);
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      await service.create('client-fee-credit', {
        items: [{ productId: 1, quantity: 1 }],
        delivery_type: 'pickup',
        payment_method: 'credit',
      });

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          payment_method: 'credit',
          fee_amount: 0.00,
          fee_method: 'CREDIT',
        }),
      );
    });
  });

  describe('settleBatch - Batch Settlement (TASK-48-04)', () => {
    it('should settle batch of orders with card applying 3.5% fee and updating to paid', async () => {
      const order1 = { id: 'ord-1', user_id: 'usr-1', total: 100, refunded_amount: 0, status: 'confirmed', payment_status: 'pending' };
      const order2 = { id: 'ord-2', user_id: 'usr-1', total: 200, refunded_amount: 0, status: 'confirmed', payment_status: 'pending' };
      orderRepository.find.mockResolvedValue([order1, order2]);
      orderRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.settleBatch('usr-1', 'client', {
        order_ids: ['ord-1', 'ord-2'],
        payment_method: 'card',
      });

      expect(result.success).toBe(true);
      expect(result.settled_count).toBe(2);
      expect(result.base_total).toBe(300);
      expect(result.fee_amount).toBe(10.50); // 300 * 0.035
      expect(result.total_paid).toBe(310.50);
      expect(order1.payment_status).toBe('paid');
      expect(order2.payment_status).toBe('paid');
    });

    it('should settle batch with ACH capping fee at $5.00', async () => {
      const order1 = { id: 'ord-10', user_id: 'usr-1', total: 1000, refunded_amount: 0, status: 'confirmed', payment_status: 'pending' };
      orderRepository.find.mockResolvedValue([order1]);
      orderRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.settleBatch('usr-1', 'client', {
        order_ids: ['ord-10'],
        payment_method: 'ach',
      });

      expect(result.base_total).toBe(1000);
      expect(result.fee_amount).toBe(5.00);
      expect(result.total_paid).toBe(1005.00);
      expect(order1.payment_status).toBe('paid');
    });

    it('should settle batch with Zelle with 0.0% fee', async () => {
      const order1 = { id: 'ord-zelle', user_id: 'usr-1', total: 450, refunded_amount: 0, status: 'confirmed', payment_status: 'pending' };
      orderRepository.find.mockResolvedValue([order1]);
      orderRepository.save.mockImplementation(async (o: any) => o);

      const result = await service.settleBatch('usr-1', 'client', {
        order_ids: ['ord-zelle'],
        payment_method: 'zelle',
        payment_reference: 'ZELLE-CONF-987',
      });

      expect(result.fee_amount).toBe(0);
      expect(result.total_paid).toBe(450);
      expect(order1.payment_status).toBe('paid');
      expect((order1 as any).zelle_reference).toContain('ZELLE-CONF-987');
    });

    it('should throw BadRequestException for empty order_ids list (Sad Path §6)', async () => {
      await expect(service.settleBatch('usr-1', 'client', { order_ids: [], payment_method: 'card' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing payment_method (Sad Path §6)', async () => {
      await expect(service.settleBatch('usr-1', 'client', { order_ids: ['ord-1'], payment_method: '' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if any order in batch is missing (Sad Path §6)', async () => {
      orderRepository.find.mockResolvedValue([{ id: 'ord-1' }]);
      await expect(service.settleBatch('usr-1', 'client', { order_ids: ['ord-1', 'ord-missing'], payment_method: 'card' }))
        .rejects.toThrow();
    });

    it('should throw ForbiddenException if user tries to settle another client order (Sad Path §6)', async () => {
      const orderForeign = { id: 'ord-foreign', user_id: 'other-user', total: 100, payment_status: 'pending', status: 'confirmed' };
      orderRepository.find.mockResolvedValue([orderForeign]);

      await expect(service.settleBatch('usr-1', 'client', { order_ids: ['ord-foreign'], payment_method: 'card' }))
        .rejects.toThrow();
    });

    it('should throw BadRequestException if order is already paid (Sad Path §6)', async () => {
      const orderPaid = { id: 'ord-paid', user_id: 'usr-1', total: 100, payment_status: 'paid', status: 'confirmed' };
      orderRepository.find.mockResolvedValue([orderPaid]);

      await expect(service.settleBatch('usr-1', 'client', { order_ids: ['ord-paid'], payment_method: 'card' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order is cancelled (Sad Path §6)', async () => {
      const orderCancelled = { id: 'ord-canc', user_id: 'usr-1', total: 100, payment_status: 'pending', status: 'cancelled' };
      orderRepository.find.mockResolvedValue([orderCancelled]);

      await expect(service.settleBatch('usr-1', 'client', { order_ids: ['ord-canc'], payment_method: 'card' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getFrequentProducts - Frequent Products Carousel (TASK-48-05)', () => {
    it('should return top products sorted by total units purchased', async () => {
      const prodA = { id: 101, name: 'Pan Campesino' };
      const prodB = { id: 102, name: 'Baguette Rústica' };

      orderRepository.find.mockResolvedValue([
        {
          id: 'o-1',
          user_id: 'usr-1',
          status: 'delivered',
          created_at: new Date('2026-10-01'),
          items: [
            { product: prodA, quantity: 5 },
            { product: prodB, quantity: 20 },
          ],
        },
        {
          id: 'o-2',
          user_id: 'usr-1',
          status: 'confirmed',
          created_at: new Date('2026-10-15'),
          items: [{ product: prodA, quantity: 10 }],
        },
      ]);

      const frequent = await service.getFrequentProducts('usr-1');
      expect(frequent.length).toBe(2);
      expect(frequent[0].id).toBe(102); // prodB total 20 > prodA total 15
      expect(frequent[0].total_purchased_units).toBe(20);
      expect(frequent[1].id).toBe(101);
      expect(frequent[1].total_purchased_units).toBe(15);
    });

    it('should fallback to active catalog products when user has no purchase history', async () => {
      orderRepository.find.mockResolvedValue([]);
      productRepository.find.mockResolvedValue([{ id: 1, name: 'Pan de Molde', is_active: true }]);

      const frequent = await service.getFrequentProducts('usr-new');
      expect(frequent.length).toBe(1);
      expect(frequent[0].id).toBe(1);
      expect(frequent[0].order_frequency).toBe(0);
    });

    it('should throw BadRequestException if userId is empty (Sad Path §6)', async () => {
      await expect(service.getFrequentProducts('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sprint S50: Comprobantes Zelle y Modificación de Órdenes Pre-Corte', () => {
    const mockUser = {
      id: 'user-s50',
      account_type: 'cash',
      delivery_fee: 0,
      productDiscounts: [],
    };

    const mockProduct1 = {
      id: 1,
      name: 'Croissant Mantequilla',
      price: 5.0,
      is_active: true,
    };

    const mockProduct2 = {
      id: 2,
      name: 'Pain au Chocolat',
      price: 6.0,
      is_active: true,
    };

    it('Happy Path: mutación de orden pre-12 PM recalcula subtotales y permite anexar comprobante Zelle', async () => {
      // Order created today at 09:00 AM NY
      const orderCreatedAt = new Date('2026-10-30T13:00:00Z'); // 09:00 AM ET
      const preCutoffTime = new Date('2026-10-30T14:30:00Z');  // 10:30 AM ET (< 12:00 PM)

      const existingOrder: any = {
        id: 'order-s50-1',
        user_id: 'user-s50',
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'zelle',
        total: 10.0,
        delivery_fee_charged: 0,
        tax_exempt: true,
        created_at: orderCreatedAt,
        items: [
          { product_id: 1, quantity: 2, price_at_time: 5.0, product: mockProduct1 },
        ],
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);
      orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));
      userRepository.findOne.mockResolvedValue(mockUser);
      productRepository.find.mockResolvedValue([mockProduct1]);
      orderItemRepository.delete.mockResolvedValue({ affected: 1 });
      orderItemRepository.save.mockImplementation((items: any) => Promise.resolve(items));

      // Mutate order: change product 1 quantity to 4, attach zelle screenshot and reference
      const result = await service.mutateOrderItems(
        'order-s50-1',
        {
          items: [{ productId: 1, quantity: 4 }],
          zelle_receipt_url: '/uploads/zelle/zelle-screenshot-123.jpg',
          zelle_reference: 'ZEL-CONF-884920',
        },
        'user-s50',
        'client',
        preCutoffTime,
      );

      // Verify subtotals recalculation: 4 * 5.0 = 20.0
      expect(result.total).toBe(20.0);
      expect(result.zelle_receipt_url).toBe('/uploads/zelle/zelle-screenshot-123.jpg');
      expect(result.zelle_reference).toBe('ZEL-CONF-884920');
      expect(result.payment_status).toBe('pending_zelle_verification');
      expect(orderItemRepository.delete).toHaveBeenCalledWith({ order_id: 'order-s50-1' });
    });

    it('Sad Path (§6): mutación intentada posterior a las 12:00 PM es rechazada con BadRequestException', async () => {
      // Order created today at 09:00 AM NY
      const orderCreatedAt = new Date('2026-10-30T13:00:00Z'); // 09:00 AM ET
      const postCutoffTime = new Date('2026-10-30T17:30:00Z'); // 01:30 PM ET (> 12:00 PM)

      const existingOrder: any = {
        id: 'order-s50-2',
        user_id: 'user-s50',
        status: 'confirmed',
        payment_status: 'pending',
        payment_method: 'zelle',
        total: 10.0,
        created_at: orderCreatedAt,
        items: [{ product_id: 1, quantity: 2, price_at_time: 5.0 }],
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.mutateOrderItems(
          'order-s50-2',
          { items: [{ productId: 1, quantity: 5 }] },
          'user-s50',
          'client',
          postCutoffTime,
        ),
      ).rejects.toThrow(new BadRequestException('Corte de producción superado. No se pueden modificar items'));
    });

    it('Sad Path (§6): mutación en día posterior a la orden es rechazada con BadRequestException', async () => {
      const orderCreatedAt = new Date('2026-10-29T13:00:00Z'); // Yesterday
      const nextDayTime = new Date('2026-10-30T14:00:00Z');     // Today 10:00 AM ET

      const existingOrder: any = {
        id: 'order-s50-past',
        user_id: 'user-s50',
        status: 'pending',
        created_at: orderCreatedAt,
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.mutateOrderItems(
          'order-s50-past',
          { items: [{ productId: 1, quantity: 3 }] },
          'user-s50',
          'client',
          nextDayTime,
        ),
      ).rejects.toThrow('Corte de producción superado. No se pueden modificar items');
    });

    it('Sad Path (§6): orden en estado entregado o cancelado no puede modificarse', async () => {
      const existingOrder: any = {
        id: 'order-s50-delivered',
        user_id: 'user-s50',
        status: 'delivered',
        created_at: new Date('2026-10-30T13:00:00Z'),
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.mutateOrderItems(
          'order-s50-delivered',
          { items: [{ productId: 1, quantity: 3 }] },
          'user-s50',
          'client',
          new Date('2026-10-30T14:00:00Z'),
        ),
      ).rejects.toThrow('Solo se pueden modificar órdenes en estado pending o confirmed');
    });

    it('TASK-50-03 Happy Path: modificación que disminuye total genera reembolso / nota de crédito', async () => {
      const preCutoffTime = new Date('2026-10-30T14:00:00Z'); // 10:00 AM ET

      const existingOrder: any = {
        id: 'order-s50-refund',
        user_id: 'user-s50',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'stripe',
        stripe_payment_id: 'pi_test_123',
        total: 50.0,
        delivery_fee_charged: 0,
        tax_exempt: true,
        created_at: new Date('2026-10-30T13:00:00Z'),
        items: [
          { product_id: 1, quantity: 10, price_at_time: 5.0, product: mockProduct1 },
        ],
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);
      orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));
      userRepository.findOne.mockResolvedValue(mockUser);
      productRepository.find.mockResolvedValue([mockProduct1]);
      orderItemRepository.delete.mockResolvedValue({ affected: 1 });
      orderItemRepository.save.mockImplementation((items: any) => Promise.resolve(items));

      // Decrease from 10 units ($50) to 4 units ($20 + 3.5% fee = $20.70)
      const result = await service.mutateOrderItems(
        'order-s50-refund',
        { items: [{ productId: 1, quantity: 4 }] },
        'user-s50',
        'client',
        preCutoffTime,
      );

      // Decreased total: refund issued or note recorded
      expect(result.total).toBeLessThan(50.0);
      expect(result.pending_balance).toBe(0);
    });

    it('TASK-50-03 Happy Path: modificación que aumenta total genera pending_balance', async () => {
      const preCutoffTime = new Date('2026-10-30T14:00:00Z'); // 10:00 AM ET

      const existingOrder: any = {
        id: 'order-s50-increase',
        user_id: 'user-s50',
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'stripe',
        total: 20.0,
        delivery_fee_charged: 0,
        tax_exempt: true,
        created_at: new Date('2026-10-30T13:00:00Z'),
        items: [
          { product_id: 1, quantity: 4, price_at_time: 5.0, product: mockProduct1 },
        ],
      };

      orderRepository.findOne.mockResolvedValue(existingOrder);
      orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));
      userRepository.findOne.mockResolvedValue(mockUser);
      productRepository.find.mockResolvedValue([mockProduct1]);
      orderItemRepository.delete.mockResolvedValue({ affected: 1 });
      orderItemRepository.save.mockImplementation((items: any) => Promise.resolve(items));

      // Increase to 8 units ($40 + 3.5% fee = $41.40)
      const result = await service.mutateOrderItems(
        'order-s50-increase',
        { items: [{ productId: 1, quantity: 8 }] },
        'user-s50',
        'client',
        preCutoffTime,
      );

      expect(result.total).toBeGreaterThan(20.0);
      expect(result.pending_balance).toBeGreaterThan(0);
      expect(result.payment_status).toBe('partially_paid');
    });
  });
});

