import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { MailService } from '../mail/mail.service';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: MailService, useValue: mockMailService },
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

    it('should reject order if delivery_date violates cutoff hour (>12 PM ET for next day)', () => {
      // Create a reference date at 1:30 PM (13:30) in New York
      const afternoonInNY = new Date('2026-10-25T17:30:00Z'); // 17:30 UTC is 13:30 EDT (America/New_York)
      // Tomorrow is 2026-10-26
      expect(() => {
        service.validateCutoffTime('2026-10-26', afternoonInNY, 12);
      }).toThrow(BadRequestException);
    });

    it('should allow next day delivery if placed before 12 PM ET', () => {
      // 10:00 AM in NY (14:00 UTC)
      const morningInNY = new Date('2026-10-25T14:00:00Z');
      expect(() => {
        service.validateCutoffTime('2026-10-26', morningInNY, 12);
      }).not.toThrow();
    });

    it('should reject past delivery dates or same-day delivery', () => {
      const morningInNY = new Date('2026-10-25T14:00:00Z');
      expect(() => {
        service.validateCutoffTime('2026-10-24', morningInNY, 12);
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateCutoffTime('2026-10-25', morningInNY, 12);
      }).toThrow(BadRequestException);
    });
  });
});

