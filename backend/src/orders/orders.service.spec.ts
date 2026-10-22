import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
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

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Product), useValue: productRepository },
        { provide: DataSource, useValue: dataSource },
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

    const expectedTotal = 180; // 90 + 90
    const createdOrder = { id: 'order-123', total: expectedTotal };
    
    mockManager.create.mockImplementation((entity, data) => ({ ...createdOrder, ...data }));
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

    const expectedTotal = 115; // 50 * 2 + 15
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

    const expectedTotal = 100; // 50 * 2 + 0
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
  });

  it('should allow invalid order status transitions (e.g., Delivered -> Pending) if user is admin', async () => {
    const existingOrder = { id: 'order-123', status: 'delivered' };
    service.findOne = jest.fn().mockResolvedValue(existingOrder);
    orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));
    
    const result = await service.updateStatus('order-123', 'pending', 'admin');
    expect(result.status).toBe('pending');
  });
});

