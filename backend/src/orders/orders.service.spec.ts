import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { MailService } from '../mail/mail.service';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { CheckPaymentsService } from '../payments/check-payments.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: any;
  let orderItemRepository: any;
  let userRepository: any;
  let productRepository: any;
  let dataSource: any;
  let mockManager: any;
  let mockMailService: any;
  let mockCheckPaymentsService: any;

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
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    orderItemRepository = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve(u)),
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
      sendZelleRejectionAlert: jest.fn().mockResolvedValue(true),
      sendEnglishInvoice: jest.fn().mockResolvedValue(true),
    };

    const mockPaymentsService = {
      createRefund: jest.fn().mockResolvedValue({ success: true, refundedAmount: 20 }),
    };

    mockCheckPaymentsService = {
      findByOrder: jest.fn().mockResolvedValue([]),
      registerCheck: jest.fn().mockResolvedValue({ id: 'chk-reg-1' }),
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
        { provide: CheckPaymentsService, useValue: mockCheckPaymentsService },
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

    const expectedTotal = 180.00; // 90 + 90 = 180 (no packaging fee surcharge)
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

    const expectedTotal = 115.00; // 50 * 2 + 15 (no packaging fee surcharge)
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

    const expectedTotal = 100.00; // 50 * 2 + 0 (no packaging fee surcharge)
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
        packaging_fee: 0,
        packaging_discount: 0,
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

    it('should reject Zelle payment, mark payment_status unpaid, order status Cancelado and trigger sendZelleRejectionAlert', async () => {
      const existingOrder = {
        id: 'order-zelle-rej',
        user_id: 'user-zelle-rej',
        payment_status: 'pending_zelle_verification',
        status: 'pending',
        notes: '',
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));
      userRepository.findOne.mockResolvedValue({ id: 'user-zelle-rej', email: 'zelle-reject@test.com' });

      const updated = await service.rejectZellePayment('order-zelle-rej', 'Referencia inválida o no recibida');
      expect(updated.payment_status).toBe('unpaid');
      expect(updated.status).toBe('Cancelado');
      expect(updated.notes).toContain('Referencia inválida');
      expect(mockMailService.sendZelleRejectionAlert).toHaveBeenCalledWith(
        expect.objectContaining({ payment_status: 'unpaid' }),
        'zelle-reject@test.com',
        'Referencia inválida o no recibida',
      );
    });

    it('rejectZellePayment sad path: should throw NotFoundException if order does not exist (§6)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(null as any);
      await expect(service.rejectZellePayment('non-existent-order', 'Reason')).rejects.toThrow(NotFoundException);
    });

    it('TASK-87-01 Happy Path: should approve check payment, assign invoice number, register check in reconciliation and send receipt', async () => {
      const existingOrder = {
        id: 'order-check-appr',
        user_id: 'user-check-appr',
        payment_status: 'pending_check_verification',
        status: 'pending',
        check_number: 'CHK-7788',
        check_bank: 'Chase Bank',
        check_amount: 250.50,
        total: 250.50,
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      service.getNextInvoiceNumber = jest.fn().mockResolvedValue('INV-9999');
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));
      userRepository.findOne.mockResolvedValue({ id: 'user-check-appr', email: 'check-client@test.com' });

      const updated = await service.approveCheckPayment('order-check-appr', 'Cheque validado y fondos confirmados');
      expect(updated.payment_status).toBe('paid');
      expect(updated.status).toBe('Pedido Enviado');
      expect(updated.invoice_number).toBe('INV-9999');
      expect(updated.notes).toContain('Aprobación Cheque');
      expect(mockCheckPaymentsService.registerCheck).toHaveBeenCalledWith(expect.objectContaining({
        order_id: 'order-check-appr',
        check_number: 'CHK-7788',
        bank_name: 'Chase Bank',
        amount: 250.50,
        status: 'IN_HAND',
      }));
      expect(mockMailService.sendOrderReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ payment_status: 'paid', invoice_number: 'INV-9999' }),
        'check-client@test.com',
      );
    });

    it('TASK-87-01 Sad Path 1: should throw NotFoundException if order does not exist on approveCheckPayment (§6)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(null as any);
      await expect(service.approveCheckPayment('non-existent-order')).rejects.toThrow(NotFoundException);
    });

    it('TASK-87-01 Sad Path 2: should throw BadRequestException if order is cancelled on approveCheckPayment (§6)', async () => {
      const cancelledOrder = {
        id: 'order-cancelled-chk',
        status: 'cancelled',
        payment_status: 'unpaid',
      };
      service.findOne = jest.fn().mockResolvedValue(cancelledOrder);
      await expect(service.approveCheckPayment('order-cancelled-chk')).rejects.toThrow(BadRequestException);
    });

    it('TASK-87-01 Happy Path: should reject check payment and mark order Cancelado without burning invoice number', async () => {
      const existingOrder = {
        id: 'order-check-rej',
        user_id: 'user-check-rej',
        payment_status: 'pending_check_verification',
        status: 'pending',
        invoice_number: null,
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));

      const updated = await service.rejectCheckPayment('order-check-rej', 'Firma ilegible o cuenta sin fondos');
      expect(updated.payment_status).toBe('unpaid');
      expect(updated.status).toBe('Cancelado');
      expect(updated.invoice_number).toBeNull();
      expect(updated.notes).toContain('Firma ilegible');
    });

    it('TASK-87-01 Sad Path 3: should throw NotFoundException if order does not exist on rejectCheckPayment (§6)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(null as any);
      await expect(service.rejectCheckPayment('non-existent-order', 'Reason')).rejects.toThrow(NotFoundException);
    });

    it('should assign a formal consecutive credit_note_number (NC-YYYY-XXXX) when refunded_amount > 0', async () => {
      const existingOrder = {
        id: 'order-refund-folio-abc123',
        status: 'delivered',
        payment_status: 'paid',
        total: 500,
        refunded_amount: 0,
      };
      service.findOne = jest.fn().mockResolvedValue(existingOrder);
      orderRepository.save = jest.fn().mockImplementation(o => Promise.resolve(o));

      const updated = await service.update('order-refund-folio-abc123', {
        refunded_amount: 150,
        refund_reason: 'Devolución de mercancía dañada',
      }, 'admin');

      expect(updated.refunded_amount).toBe(150);
      expect(updated.credit_note_number).toBeDefined();
      expect(updated.credit_note_number).toMatch(/^NC-\d{4}-[A-Z0-9]{4}$/);
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

    it('TASK-74-01 Cutoff Time Midnight (12:08 AM ET) correctly treats hour as 0 (< 12 PM cutoff) and allows T+2', () => {
      // Miércoles 11 Noviembre 2026 a las 12:15 AM NY (05:15 UTC)
      const wednesdayMidnight = new Date('2026-11-11T05:15:00Z');
      
      // Debe calcular T+2 = Viernes 13 Noviembre 2026
      const minDate = service.calculateMinDeliveryDate(wednesdayMidnight, 12);
      expect(minDate).toBe('2026-11-13');

      // Happy path: Viernes 13 (T+2) no debe arrojar excepción
      expect(() => {
        service.validateCutoffTime('2026-11-13', wednesdayMidnight, 12);
      }).not.toThrow();

      // Sad path (§6): Jueves 12 (T+1) debe arrojar BadRequestException
      expect(() => {
        service.validateCutoffTime('2026-11-12', wednesdayMidnight, 12);
      }).toThrow(BadRequestException);

      // Sad path (§6): Mismo día Miércoles 11 debe arrojar BadRequestException
      expect(() => {
        service.validateCutoffTime('2026-11-11', wednesdayMidnight, 12);
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

      const createdOrder = { id: 'order-fee-stripe-01', total: 100.00 };
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
          fee_amount: 0,
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

    describe('Delivery Fee Precedence Matrix (TASK-78-02)', () => {
      it('should prioritize client fixed delivery fee over mileageFreightService even when dest_lat/dest_lng are present', async () => {
        userRepository.findOne.mockResolvedValue({
          id: 'user-fixed-fee-vip',
          account_type: 'cash',
          delivery_fee: 50,
          orders: [],
          productDiscounts: [],
        });
        productRepository.find.mockResolvedValue([{ id: 1, price: 100 }]);

        const createdOrder = { id: 'order-fixed-01', total: 150 };
        mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
        mockManager.save.mockResolvedValue(createdOrder);
        service.findOne = jest.fn().mockResolvedValue(createdOrder);

        (service as any).mileageFreightService = {
          calculateDistanceMiles: jest.fn().mockReturnValue(30),
          calculateFreight: jest.fn().mockReturnValue({ cost: 120, requiresSpecialQuote: false }),
        };

        await service.create('user-fixed-fee-vip', {
          items: [{ productId: 1, quantity: 1 }],
          delivery_type: 'delivery',
          payment_method: 'stripe',
          dest_lat: 40.768,
          dest_lng: -73.921,
        });

        // Fixed fee strictly used; mileage freight not calculated
        expect((service as any).mileageFreightService.calculateFreight).not.toHaveBeenCalled();
        expect(mockManager.create).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            delivery_fee_charged: 50,
          }),
        );

        (service as any).mileageFreightService = undefined;
      });

      it('should calculate delivery fee via mileageFreightService when user has no fixed fee (delivery_fee = 0)', async () => {
        userRepository.findOne.mockResolvedValue({
          id: 'user-dynamic-mileage',
          account_type: 'cash',
          delivery_fee: 0,
          orders: [],
          productDiscounts: [],
        });
        productRepository.find.mockResolvedValue([{ id: 1, price: 100 }]);

        const createdOrder = { id: 'order-mileage-01', total: 160 };
        mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
        mockManager.save.mockResolvedValue(createdOrder);
        service.findOne = jest.fn().mockResolvedValue(createdOrder);

        (service as any).mileageFreightService = {
          calculateDistanceMiles: jest.fn().mockReturnValue(15),
          calculateFreight: jest.fn().mockReturnValue({ cost: 60, requiresSpecialQuote: false }),
        };

        await service.create('user-dynamic-mileage', {
          items: [{ productId: 1, quantity: 1 }],
          delivery_type: 'delivery',
          payment_method: 'stripe',
          dest_lat: 41.0,
          dest_lng: -73.0,
        });

        expect((service as any).mileageFreightService.calculateFreight).toHaveBeenCalledWith(15, 'shared');
        expect(mockManager.create).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            delivery_fee_charged: 60,
          }),
        );

        (service as any).mileageFreightService = undefined;
      });

      it('Sad path: fallback to explicit delivery_fee or user delivery fee when user has no fixed fee and no coordinates are provided (§6)', async () => {
        userRepository.findOne.mockResolvedValue({
          id: 'user-contingency',
          account_type: 'cash',
          delivery_fee: 0,
          orders: [],
          productDiscounts: [],
        });
        productRepository.find.mockResolvedValue([{ id: 1, price: 100 }]);

        const createdOrder = { id: 'order-contingency-01', total: 115 };
        mockManager.create.mockImplementation((entity: any, data: any) => ({ ...createdOrder, ...data }));
        mockManager.save.mockResolvedValue(createdOrder);
        service.findOne = jest.fn().mockResolvedValue(createdOrder);

        await service.create('user-contingency', {
          items: [{ productId: 1, quantity: 1 }],
          delivery_type: 'delivery',
          payment_method: 'stripe',
          delivery_fee: 15,
        });

        expect(mockManager.create).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            delivery_fee_charged: 15,
          }),
        );
      });
    });
  });

  describe('settleBatch - Batch Settlement (TASK-48-04)', () => {
    it('should settle batch of orders with card (fee $0.00) and updating to paid', async () => {
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
      expect(result.fee_amount).toBe(0.00); // 0 fee for card
      expect(result.total_paid).toBe(300.00);
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

  describe('TASK-55-03: Status Normalization and Transition Fix (§48, §6)', () => {
    it('normalizeStatus should map variants in Spanish and English to canonical statuses', () => {
      // Shipped variants
      expect(service.normalizeStatus('shipped')).toBe('shipped');
      expect(service.normalizeStatus('pedido enviado')).toBe('shipped');
      expect(service.normalizeStatus('Pedido Enviado')).toBe('shipped');
      expect(service.normalizeStatus('en delivery')).toBe('shipped');
      expect(service.normalizeStatus('En Delivery')).toBe('shipped');
      expect(service.normalizeStatus('enviado')).toBe('shipped');

      // Delivered variants
      expect(service.normalizeStatus('delivered')).toBe('delivered');
      expect(service.normalizeStatus('pedido recibido')).toBe('delivered');
      expect(service.normalizeStatus('Pedido Recibido')).toBe('delivered');
      expect(service.normalizeStatus('entregado')).toBe('delivered');
      expect(service.normalizeStatus('Entregado')).toBe('delivered');
      expect(service.normalizeStatus('recibido')).toBe('delivered');

      // Pending variants
      expect(service.normalizeStatus('pending')).toBe('pending');
      expect(service.normalizeStatus('pendiente')).toBe('pending');

      // Confirmed variants
      expect(service.normalizeStatus('confirmed')).toBe('confirmed');
      expect(service.normalizeStatus('confirmado')).toBe('confirmed');

      // Cancelled variants
      expect(service.normalizeStatus('cancelled')).toBe('cancelled');
      expect(service.normalizeStatus('cancelado')).toBe('cancelled');
    });

    it('should allow client transition from "pedido enviado" to "pedido recibido"', async () => {
      const order = { id: 'ord-1', status: 'pedido enviado' };
      service.findOne = jest.fn().mockResolvedValue(order);
      orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

      const updated = await service.updateStatus('ord-1', 'pedido recibido', 'client');
      expect(updated.status).toBe('delivered');
    });

    it('should allow client transition from "shipped" to "delivered"', async () => {
      const order = { id: 'ord-2', status: 'shipped' };
      service.findOne = jest.fn().mockResolvedValue(order);
      orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

      const updated = await service.updateStatus('ord-2', 'delivered', 'client');
      expect(updated.status).toBe('delivered');
    });

    it('should allow client transition from "en delivery" to "delivered"', async () => {
      const order = { id: 'ord-3', status: 'en delivery' };
      service.findOne = jest.fn().mockResolvedValue(order);
      orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

      const updated = await service.updateStatus('ord-3', 'delivered', 'client');
      expect(updated.status).toBe('delivered');
    });

    it('should allow client transition from "shipped" to "Pedido Recibido"', async () => {
      const order = { id: 'ord-4', status: 'shipped' };
      service.findOne = jest.fn().mockResolvedValue(order);
      orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

      const updated = await service.updateStatus('ord-4', 'Pedido Recibido', 'client');
      expect(updated.status).toBe('delivered');
    });

    it('should allow client transition from "pedido enviado" to "entregado"', async () => {
      const order = { id: 'ord-5', status: 'pedido enviado' };
      service.findOne = jest.fn().mockResolvedValue(order);
      orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

      const updated = await service.updateStatus('ord-5', 'entregado', 'client');
      expect(updated.status).toBe('delivered');
    });

    it('Sad path: should throw BadRequestException if non-admin tries invalid transition (e.g. pending -> delivered)', async () => {
      const order = { id: 'ord-6', status: 'pending' };
      service.findOne = jest.fn().mockResolvedValue(order);

      await expect(service.updateStatus('ord-6', 'delivered', 'client')).rejects.toThrow(BadRequestException);
    });

    it('Sad path: should throw BadRequestException if non-admin tries invalid transition (e.g. delivered -> pending)', async () => {
      const order = { id: 'ord-7', status: 'delivered' };
      service.findOne = jest.fn().mockResolvedValue(order);

      await expect(service.updateStatus('ord-7', 'pending', 'client')).rejects.toThrow(BadRequestException);
    });
  });

  describe('TASK-55-05: [TEST/S55-E2E-CERTIFICATION-SUITE] Business Rules Certification (§48, §6)', () => {
    describe('Status Transitions: Happy Paths', () => {
      it('Happy path: valid transition from "shipped" to "Pedido Recibido" persists as "delivered"', async () => {
        const order = { id: 's55-order-1', status: 'shipped' };
        service.findOne = jest.fn().mockResolvedValue(order);
        orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

        const result = await service.updateStatus('s55-order-1', 'Pedido Recibido', 'client');
        expect(result.status).toBe('delivered');
        expect(orderRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'delivered' }));
      });

      it('Happy path: valid transition from "pedido enviado" to "delivered" persists as "delivered"', async () => {
        const order = { id: 's55-order-2', status: 'pedido enviado' };
        service.findOne = jest.fn().mockResolvedValue(order);
        orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

        const result = await service.updateStatus('s55-order-2', 'delivered', 'client');
        expect(result.status).toBe('delivered');
        expect(orderRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'delivered' }));
      });

      it('Happy path: valid transition from "en delivery" to "Pedido Recibido" normalizes and persists', async () => {
        const order = { id: 's55-order-3', status: 'en delivery' };
        service.findOne = jest.fn().mockResolvedValue(order);
        orderRepository.save = jest.fn().mockImplementation((o: any) => Promise.resolve(o));

        const result = await service.updateStatus('s55-order-3', 'Pedido Recibido', 'client');
        expect(result.status).toBe('delivered');
      });
    });

    describe('Status Transitions: Sad Paths (Unauthorized from "delivered")', () => {
      it('Sad path: client cannot transition from "delivered" back to "pending" (throws BadRequestException)', async () => {
        const order = { id: 's55-order-4', status: 'delivered' };
        service.findOne = jest.fn().mockResolvedValue(order);

        await expect(service.updateStatus('s55-order-4', 'pending', 'client'))
          .rejects.toThrow(BadRequestException);
      });

      it('Sad path: client cannot transition from "delivered" back to "shipped" (throws BadRequestException)', async () => {
        const order = { id: 's55-order-5', status: 'delivered' };
        service.findOne = jest.fn().mockResolvedValue(order);

        await expect(service.updateStatus('s55-order-5', 'shipped', 'client'))
          .rejects.toThrow(BadRequestException);
      });

      it('Sad path: client cannot transition from "delivered" to "cancelled" (throws BadRequestException)', async () => {
        const order = { id: 's55-order-6', status: 'delivered' };
        service.findOne = jest.fn().mockResolvedValue(order);

        await expect(service.updateStatus('s55-order-6', 'cancelled', 'client'))
          .rejects.toThrow(BadRequestException);
      });

      it('Sad path: client cannot transition from "delivered" to arbitrary invalid status (throws BadRequestException)', async () => {
        const order = { id: 's55-order-7', status: 'delivered' };
        service.findOne = jest.fn().mockResolvedValue(order);

        await expect(service.updateStatus('s55-order-7', 'en_preparacion', 'client'))
          .rejects.toThrow(BadRequestException);
      });
    });

    describe('Lead Time & Tuesday Exclusion Rules', () => {
      it('Happy path: Sunday pre-cutoff (10:00 AM NY) normally T+2 is Tuesday, skips to Wednesday (+1 day)', () => {
        // Domingo 25 Octubre 2026 a las 10:00 AM NY (14:00 UTC)
        const sunday10AM = new Date('2026-10-25T14:00:00Z');
        
        // Lead time T+2 normalmente caería el Martes 27 de Octubre,
        // pero la regla S55 excluye los martes y salta automáticamente al Miércoles 28
        const minDate = service.calculateMinDeliveryDate(sunday10AM, 12);
        expect(minDate).toBe('2026-10-28');

        // Miércoles 28 de Octubre es aceptado sin excepciones
        expect(() => {
          service.validateCutoffTime('2026-10-28', sunday10AM, 12);
        }).not.toThrow();

        // Jueves 29 de Octubre (posterior) también es aceptado
        expect(() => {
          service.validateCutoffTime('2026-10-29', sunday10AM, 12);
        }).not.toThrow();
      });

      it('Happy path: Saturday post-cutoff (3:15 PM NY) normally T+3 is Tuesday, skips to Wednesday (+1 day)', () => {
        // Sábado 24 Octubre 2026 a las 3:15 PM NY (19:15 UTC)
        const saturday315PM = new Date('2026-10-24T19:15:00Z');

        // Lead time T+3 normalmente caería el Martes 27 de Octubre,
        // pero la regla S55 excluye los martes y salta automáticamente al Miércoles 28
        const minDate = service.calculateMinDeliveryDate(saturday315PM, 12);
        expect(minDate).toBe('2026-10-28');

        expect(() => {
          service.validateCutoffTime('2026-10-28', saturday315PM, 12);
        }).not.toThrow();
      });

      it('Sad path: selecting any Tuesday throws BadRequestException indicating bakery does not deliver on Tuesdays', () => {
        const thursday10AM = new Date('2026-10-22T14:00:00Z');

        // Martes 27 de Octubre 2026 (es posterior a T+2, pero es Martes)
        expect(() => {
          service.validateCutoffTime('2026-10-27', thursday10AM, 12);
        }).toThrow(BadRequestException);

        try {
          service.validateCutoffTime('2026-10-27', thursday10AM, 12);
        } catch (err: any) {
          expect(err.message).toMatch(/no realiza entregas los martes/i);
        }

        // Martes 3 de Noviembre 2026
        expect(() => {
          service.validateCutoffTime('2026-11-03', thursday10AM, 12);
        }).toThrow(BadRequestException);
      });

      it('Sad path: Sunday 10 AM ordering for Tuesday (T+2) is rejected because Tuesday is non-working day', () => {
        const sunday10AM = new Date('2026-10-25T14:00:00Z');

        expect(() => {
          service.validateCutoffTime('2026-10-27', sunday10AM, 12);
        }).toThrow(BadRequestException);
      });
    });

    describe('Dynamic Delivery Schedule Rules (S68A)', () => {
      const baseScheduleConfig = {
        workingDays: [0, 1, 3, 4, 5, 6],
        holidays: [
          { date: '2026-11-26', name: 'Thanksgiving Day' },
          { date: '2026-12-25', name: 'Christmas Day' },
        ],
        exceptionalDays: [],
        cutoffHour: 12,
      };

      it('Happy path: Entrega en día hábil normal', () => {
        // Miércoles 21 Octubre 2026 a las 10:00 AM NY (14:00 UTC)
        const wednesday10AM = new Date('2026-10-21T14:00:00Z');

        const minDate = service.calculateMinDeliveryDate(wednesday10AM, 12, baseScheduleConfig);
        // T+2 pre-cutoff = Viernes 23 Octubre 2026 (día hábil)
        expect(minDate).toBe('2026-10-23');

        expect(() => {
          service.validateCutoffTime('2026-10-23', wednesday10AM, 12, baseScheduleConfig);
        }).not.toThrow();
      });

      it('Happy path: Entrega en fecha extraordinaria aprobada (que caería en martes pero se permite por override)', () => {
        // Domingo 25 Octubre 2026 a las 10:00 AM NY (14:00 UTC)
        const sunday10AM = new Date('2026-10-25T14:00:00Z');

        // Martes 27 Octubre normalmente está inactivo, pero está en exceptionalDays
        const scheduleWithOverride = {
          ...baseScheduleConfig,
          exceptionalDays: [{ date: '2026-10-27', name: 'Special Tuesday Bake' }],
        };

        const minDate = service.calculateMinDeliveryDate(sunday10AM, 12, scheduleWithOverride);
        expect(minDate).toBe('2026-10-27');

        expect(() => {
          service.validateCutoffTime('2026-10-27', sunday10AM, 12, scheduleWithOverride);
        }).not.toThrow();
      });

      it('Sad path (§6): Intento de pedido en día feriado (ej. 2026-11-26 Thanksgiving) lanza BadRequestException', () => {
        // Lunes 23 Noviembre 2026 a las 10:00 AM NY (15:00 UTC)
        const monday10AM = new Date('2026-11-23T15:00:00Z');

        expect(() => {
          service.validateCutoffTime('2026-11-26', monday10AM, 12, baseScheduleConfig);
        }).toThrow(BadRequestException);

        try {
          service.validateCutoffTime('2026-11-26', monday10AM, 12, baseScheduleConfig);
        } catch (err: any) {
          expect(err.message).toBe(
            'Panadería Jhoanes no realiza entregas el 2026-11-26: Thanksgiving Day.',
          );
        }

        // Verificar que calculateMinDeliveryDate avanza saltándose el feriado
        // Martes 24 Noviembre 2026 10:00 AM -> T+2 normalmente sería Jueves 26 (Thanksgiving)
        // Como Jueves 26 es feriado, debe saltar al Viernes 27
        const tuesday10AM = new Date('2026-11-24T15:00:00Z');
        const minDate = service.calculateMinDeliveryDate(tuesday10AM, 12, baseScheduleConfig);
        expect(minDate).toBe('2026-11-27');
      });

      it('Sad path (§6): Intento de pedido en día de la semana deshabilitado lanza BadRequestException', () => {
        // Configuración donde el domingo (0) está cerrado
        const scheduleNoSundays = {
          workingDays: [1, 2, 3, 4, 5, 6], // Lunes a Sábado, Domingo inactivo
          holidays: [],
          exceptionalDays: [],
          cutoffHour: 12,
        };

        // Miércoles 21 Octubre 2026 a las 10:00 AM NY
        const wednesday10AM = new Date('2026-10-21T14:00:00Z');

        // Domingo 25 Octubre 2026 es día 0 (cerrado)
        expect(() => {
          service.validateCutoffTime('2026-10-25', wednesday10AM, 12, scheduleNoSundays);
        }).toThrow(BadRequestException);

        try {
          service.validateCutoffTime('2026-10-25', wednesday10AM, 12, scheduleNoSundays);
        } catch (err: any) {
          expect(err.message).toBe(
            'Panadería Jhoanes no realiza entregas los días domingo. Por favor selecciona un día operativo.',
          );
        }
      });

      it('Happy/Sad integration: uses injected SystemConfigsService cached schedule when scheduleConfig argument is omitted', () => {
        const mockConfigService = {
          getCachedDeliverySchedule: jest.fn().mockReturnValue({
            workingDays: [0, 1, 3, 4, 5, 6],
            holidays: [{ date: '2026-12-25', name: 'Christmas Day' }],
            exceptionalDays: [],
            cutoffHour: 12,
          }),
        };

        (service as any).systemConfigsService = mockConfigService;

        const wednesday10AM = new Date('2026-12-23T15:00:00Z');

        // calculateMinDeliveryDate debe saltarse el feriado 2026-12-25 (Viernes) y retornar 2026-12-26 (Sábado)
        const minDate = service.calculateMinDeliveryDate(wednesday10AM, 12);
        expect(minDate).toBe('2026-12-26');

        // Intentar ordenar para el 25 de Diciembre lanza BadRequestException por feriado
        expect(() => {
          service.validateCutoffTime('2026-12-25', wednesday10AM, 12);
        }).toThrow(BadRequestException);

        try {
          service.validateCutoffTime('2026-12-25', wednesday10AM, 12);
        } catch (err: any) {
          expect(err.message).toBe('Panadería Jhoanes no realiza entregas el 2026-12-25: Christmas Day.');
        }

        // Limpiar mock inyectado
        (service as any).systemConfigsService = undefined;
      });
    });
  });

  describe('findInRange', () => {
    it('should filter orders primarily by delivery_date within range', async () => {
      const mockOrders = [
        {
          id: 'ord-1',
          delivery_date: '2026-11-04',
          created_at: new Date('2026-10-30T10:00:00Z'),
        },
        {
          id: 'ord-2',
          delivery_date: '2026-11-10', // out of range
          created_at: new Date('2026-11-04T10:00:00Z'),
        },
      ];

      const qb = orderRepository.createQueryBuilder();
      qb.getMany.mockResolvedValue(mockOrders);

      const res = await service.findInRange('2026-11-03', '2026-11-05');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('ord-1');
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('order.delivery_date >= :rawStart'),
        expect.objectContaining({ rawStart: '2026-11-03', rawEnd: '2026-11-05' }),
      );
    });

    it('should fallback to order.created_at production date when delivery_date is missing', async () => {
      const mockOrders = [
        {
          id: 'ord-legacy',
          delivery_date: null,
          created_at: new Date('2026-11-04T14:00:00Z'), // ~10 AM NY -> prodDate 2026-11-04
        },
      ];

      const qb = orderRepository.createQueryBuilder();
      qb.getMany.mockResolvedValue(mockOrders);

      const res = await service.findInRange('2026-11-04', '2026-11-04');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('ord-legacy');
    });

    it('Sad path: returns empty array when no orders match range or query builder returns empty', async () => {
      const qb = orderRepository.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);

      const res = await service.findInRange('2026-11-01', '2026-11-02');
      expect(res).toEqual([]);
    });
  });

  describe('TASK-76-01: disableOrder and bulkDisableOrders', () => {
    describe('disableOrder', () => {
      it('Happy path: disables order with custom reason, sets status to cancelled and prepends audit log to existing notes', async () => {
        const existingOrder: any = {
          id: 'ord-disable-1',
          status: 'pending',
          notes: 'Nota previa del cliente',
        };
        orderRepository.findOne.mockResolvedValue(existingOrder);
        orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));

        const result = await service.disableOrder('ord-disable-1', 'Orden de prueba del cliente');

        expect(result.status).toBe('cancelled');
        expect(result.notes).toContain('[ORDEN INHABILITADA POR ADMINISTRACIÓN: Orden de prueba del cliente - ');
        expect(result.notes).toContain('Nota previa del cliente');
        expect(orderRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'ord-disable-1',
            status: 'cancelled',
          }),
        );
      });

      it('Happy path: disables order with default reason when reason is omitted and notes is empty/null', async () => {
        const existingOrder: any = {
          id: 'ord-disable-2',
          status: 'approved',
          notes: null,
        };
        orderRepository.findOne.mockResolvedValue(existingOrder);
        orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));

        const result = await service.disableOrder('ord-disable-2');

        expect(result.status).toBe('cancelled');
        expect(result.notes).toContain('[ORDEN INHABILITADA POR ADMINISTRACIÓN: Compra de prueba - ');
        expect(result.notes.endsWith('\n')).toBe(true);
      });

      it('Sad path §6: throws NotFoundException when order does not exist', async () => {
        orderRepository.findOne.mockResolvedValue(null);

        await expect(service.disableOrder('non-existent-order')).rejects.toThrow(NotFoundException);
        expect(orderRepository.save).not.toHaveBeenCalled();
      });

      it('Sad path §6: throws database error if orderRepository.save fails', async () => {
        const existingOrder: any = {
          id: 'ord-disable-err',
          status: 'pending',
          notes: '',
        };
        orderRepository.findOne.mockResolvedValue(existingOrder);
        orderRepository.save.mockRejectedValue(new Error('DB transaction write lock error'));

        await expect(service.disableOrder('ord-disable-err')).rejects.toThrow('DB transaction write lock error');
      });
    });

    describe('bulkDisableOrders', () => {
      it('Happy path: bulk disables multiple orders and returns affected count', async () => {
        const order1: any = { id: 'ord-bulk-1', status: 'pending', notes: '' };
        const order2: any = { id: 'ord-bulk-2', status: 'approved', notes: 'Existing' };

        orderRepository.findOne
          .mockResolvedValueOnce(order1)
          .mockResolvedValueOnce(order2);
        orderRepository.save.mockImplementation((ord: any) => Promise.resolve(ord));

        const result = await service.bulkDisableOrders(['ord-bulk-1', 'ord-bulk-2'], 'Bulk cleanup');

        expect(result).toEqual({ affected: 2 });
        expect(order1.status).toBe('cancelled');
        expect(order1.notes).toContain('Bulk cleanup');
        expect(order2.status).toBe('cancelled');
        expect(order2.notes).toContain('Bulk cleanup');
        expect(orderRepository.save).toHaveBeenCalledTimes(2);
      });

      it('Sad path §6: throws BadRequestException when orderIds is empty array', async () => {
        await expect(service.bulkDisableOrders([])).rejects.toThrow(BadRequestException);
      });

      it('Sad path §6: throws BadRequestException when orderIds is null, undefined or not an array', async () => {
        await expect(service.bulkDisableOrders(null as any)).rejects.toThrow(BadRequestException);
        await expect(service.bulkDisableOrders(undefined as any)).rejects.toThrow(BadRequestException);
        await expect(service.bulkDisableOrders('not-an-array' as any)).rejects.toThrow(BadRequestException);
      });

      it('Sad path §6: propagates NotFoundException when an order in the bulk array does not exist', async () => {
        orderRepository.findOne.mockResolvedValue(null);

        await expect(service.bulkDisableOrders(['invalid-order-id'])).rejects.toThrow(NotFoundException);
      });
    });

    describe('getNextInvoiceNumber and backfillInvoiceNumbers', () => {
      it('Happy path: should return INV-1600 when no existing orders have invoice_number', async () => {
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
          getMany: jest.fn().mockResolvedValue([]),
        });

        const nextNumber = await service.getNextInvoiceNumber();
        expect(nextNumber).toBe('INV-1600');
      });

      it('Happy path: should return next consecutive number INV-1606 when INV-1605 exists', async () => {
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 'ord-1', invoice_number: 'INV-1605' }),
          getMany: jest.fn().mockResolvedValue([{ id: 'ord-1', invoice_number: 'INV-1605' }]),
        });

        const nextNumber = await service.getNextInvoiceNumber();
        expect(nextNumber).toBe('INV-1606');
      });

      it('Sad path (§6): should propagate exception when query fails', async () => {
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockRejectedValue(new Error('Database query failed')),
          getMany: jest.fn().mockRejectedValue(new Error('Database query failed')),
        });

        await expect(service.getNextInvoiceNumber()).rejects.toThrow('Database query failed');
      });

      it('Sad path (§6): should return INV-1600 if existing invoice number has malformed format', async () => {
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 'ord-bad', invoice_number: 'INV-INVALID' }),
          getMany: jest.fn().mockResolvedValue([{ id: 'ord-bad', invoice_number: 'INV-INVALID' }]),
        });

        const nextNumber = await service.getNextInvoiceNumber();
        expect(nextNumber).toBe('INV-1600');
      });

      it('should assign consecutive invoice numbers to unassigned orders during backfill', async () => {
        const mockUnassigned = [
          { id: 'ord-old-1', created_at: new Date('2026-01-01'), invoice_number: null },
          { id: 'ord-old-2', created_at: new Date('2026-01-02'), invoice_number: null },
        ];

        orderRepository.createQueryBuilder
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue(mockUnassigned),
          })
          .mockReturnValueOnce({
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({ id: 'last', invoice_number: 'INV-1602' }),
            getMany: jest.fn().mockResolvedValue([{ id: 'last', invoice_number: 'INV-1602' }]),
          });

        const count = await service.backfillInvoiceNumbers();
        expect(count).toBe(2);
        expect(mockUnassigned[0].invoice_number).toBe('INV-1603');
        expect(mockUnassigned[1].invoice_number).toBe('INV-1604');
        expect(orderRepository.save).toHaveBeenCalledWith(mockUnassigned[0]);
        expect(orderRepository.save).toHaveBeenCalledWith(mockUnassigned[1]);
      });

      it('backfillInvoiceNumbers returns 0 if no unassigned orders exist', async () => {
        orderRepository.createQueryBuilder.mockReturnValueOnce({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        });

        const count = await service.backfillInvoiceNumbers();
        expect(count).toBe(0);
      });
    });

    describe('Late Invoicing Engine (TASK-85-02)', () => {
      it('Happy path: strict sequential invoice generation (INV-1001, INV-1002...) when previous invoice exists', async () => {
        // Step 1: When last issued invoice is INV-1000, next must strictly be INV-1001
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([{ id: 'ord-1', invoice_number: 'INV-1000' }]),
          getOne: jest.fn().mockResolvedValue({ id: 'ord-1', invoice_number: 'INV-1000' }),
        });

        const next1 = await service.getNextInvoiceNumber();
        expect(next1).toBe('INV-1001');

        // Step 2: When next issued invoice is INV-1001, next must strictly be INV-1002
        orderRepository.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([
            { id: 'ord-1', invoice_number: 'INV-1000' },
            { id: 'ord-2', invoice_number: 'INV-1001' },
          ]),
          getOne: jest.fn().mockResolvedValue({ id: 'ord-2', invoice_number: 'INV-1001' }),
        });

        const next2 = await service.getNextInvoiceNumber();
        expect(next2).toBe('INV-1002');
      });

      it('Happy path: completeCheckout assigns consecutive invoiceNumber and updates status to confirmed', async () => {
        const pendingOrder: Partial<Order> = {
          id: 'ord-pending-1',
          user_id: 'user-1',
          status: 'pending',
          invoice_number: null,
          total: 100,
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(pendingOrder as Order);
        jest.spyOn(service, 'getNextInvoiceNumber').mockResolvedValue('INV-1001');
        orderRepository.save.mockImplementation(async (ord: any) => ord);

        const result = await service.completeCheckout('ord-pending-1');

        expect(result.status).toBe('confirmed');
        expect(result.invoice_number).toBe('INV-1001');
        expect(orderRepository.save).toHaveBeenCalledWith(expect.objectContaining({
          id: 'ord-pending-1',
          status: 'confirmed',
          invoice_number: 'INV-1001',
        }));
      });

      it('Happy path: completeCheckout is idempotent and does not regenerate invoice_number if already assigned', async () => {
        const alreadyConfirmedOrder: Partial<Order> = {
          id: 'ord-confirmed-1',
          user_id: 'user-1',
          status: 'confirmed',
          invoice_number: 'INV-1001',
          total: 100,
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(alreadyConfirmedOrder as Order);
        const getNextSpy = jest.spyOn(service, 'getNextInvoiceNumber');
        orderRepository.save.mockImplementation(async (ord: any) => ord);

        const result = await service.completeCheckout('ord-confirmed-1');

        expect(result.invoice_number).toBe('INV-1001');
        expect(getNextSpy).not.toHaveBeenCalled();
      });

      it('Sad path (§6): unconfirmed pending order or cart draft must have null invoice_number upon creation', async () => {
        const mockManager = {
          create: jest.fn().mockImplementation((entity, data) => ({ ...data, id: 'ord-created-draft' })),
          save: jest.fn().mockImplementation(async (entity, data) => data),
        };

        (service as any).dataSource = {
          transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
        };

        const mockUser = {
          id: 'user-test',
          email: 'test@example.com',
          account_type: 'cash',
          profile: { full_name: 'Test Client' },
        };
        userRepository.findOne.mockResolvedValue(mockUser as any);
        jest.spyOn(service, 'findOne').mockResolvedValue({
          id: 'ord-created-draft',
          status: 'pending',
          invoice_number: null,
        } as Order);

        const getNextSpy = jest.spyOn(service, 'getNextInvoiceNumber');

        const created = await service.create('user-test', {
          total: 50,
          status: 'pending',
          items: [],
        });

        expect(created.invoice_number).toBeNull();
        expect(created.status).toBe('pending');
        expect(getNextSpy).not.toHaveBeenCalled();
      });

      it('Sad path (§6): cancelled unconfirmed order must retain null invoice_number and consume no invoice sequence numbers', async () => {
        const pendingOrder: Partial<Order> = {
          id: 'ord-to-cancel',
          user_id: 'user-1',
          status: 'pending',
          invoice_number: null,
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(pendingOrder as Order);
        orderRepository.save.mockImplementation(async (ord: any) => ord);

        const updated = await service.updateStatus('ord-to-cancel', 'cancelled', 'admin');

        expect(updated.status).toBe('cancelled');
        expect(updated.invoice_number).toBeNull();
      });

      it('Sad path (§6): completeCheckout throws BadRequestException when order is cancelled', async () => {
        const cancelledOrder: Partial<Order> = {
          id: 'ord-cancelled-1',
          user_id: 'user-1',
          status: 'cancelled',
          invoice_number: null,
        };

        jest.spyOn(service, 'findOne').mockResolvedValue(cancelledOrder as Order);

        await expect(service.completeCheckout('ord-cancelled-1')).rejects.toThrow(
          new BadRequestException('Cannot complete checkout for a cancelled order'),
        );
      });
    });
  });

  describe('Sprint S82B: Global Store Discount Calculation (TASK-82-04 / TASK-82-05B)', () => {
    let mockSystemConfigsService: any;

    beforeEach(() => {
      mockSystemConfigsService = {
        getStoreDiscount: jest.fn(),
        getCachedDeliverySchedule: jest.fn().mockReturnValue(null),
      };
      (service as any).systemConfigsService = mockSystemConfigsService;

      userRepository.findOne.mockResolvedValue({
        id: 'user-disc-1',
        productDiscounts: [],
        credit_balance: 0,
        delivery_fee: 0,
        account_type: 'cash',
      });

      productRepository.find.mockResolvedValue([
        { id: 10, price: 100 },
      ]);
    });

    it('Happy path: Descuento general activo y vigente se aplica correctamente deduciendo el total', async () => {
      const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
        reason: 'Gran Venta Anual',
        percentage: 15,
        valid_until: validUntil,
        is_active: true,
      });

      const orderData = {
        items: [{ productId: 10, quantity: 2 }],
        deliveryType: 'pickup',
        payment_method: 'card',
      };

      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          capturedOrderData = data;
          return { id: 'order-disc-1', ...data };
        }
        return data;
      });
      mockManager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          return Promise.resolve({ id: 'order-disc-1', ...data });
        }
        return Promise.resolve(data);
      });
      service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

      const result = await service.create('user-disc-1', orderData);

      expect(result.total).toBe(170);
      expect(capturedOrderData.global_discount_amount).toBe(30);
      expect(capturedOrderData.global_discount_percentage).toBe(15);
      expect(capturedOrderData.global_discount_reason).toBe('Gran Venta Anual');
      expect(mockSystemConfigsService.getStoreDiscount).toHaveBeenCalled();
    });

    it('Sad path (§6): Descuento general con valid_until en el pasado NO se aplica (0% descuento)', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
        reason: 'Promo Caducada',
        percentage: 25,
        valid_until: expiredDate,
        is_active: true,
      });

      const orderData = {
        items: [{ productId: 10, quantity: 1 }],
        deliveryType: 'pickup',
        payment_method: 'card',
      };

      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          capturedOrderData = data;
          return { id: 'order-disc-2', ...data };
        }
        return data;
      });
      mockManager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          return Promise.resolve({ id: 'order-disc-2', ...data });
        }
        return Promise.resolve(data);
      });
      service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

      const result = await service.create('user-disc-1', orderData);

      expect(result.total).toBe(100);
      expect(capturedOrderData.global_discount_amount).toBe(0);
      expect(capturedOrderData.global_discount_percentage).toBe(0);
      expect(capturedOrderData.global_discount_reason).toBeNull();
    });

    it('Sad path (§6): Descuento general con is_active === false NO se aplica', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
        reason: 'Promo Desactivada',
        percentage: 50,
        valid_until: futureDate,
        is_active: false,
      });

      const orderData = {
        items: [{ productId: 10, quantity: 1 }],
        deliveryType: 'pickup',
        payment_method: 'card',
      };

      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          capturedOrderData = data;
          return { id: 'order-disc-3', ...data };
        }
        return data;
      });
      mockManager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          return Promise.resolve({ id: 'order-disc-3', ...data });
        }
        return Promise.resolve(data);
      });
      service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

      const result = await service.create('user-disc-1', orderData);

      expect(result.total).toBe(100);
      expect(capturedOrderData.global_discount_amount).toBe(0);
      expect(capturedOrderData.global_discount_percentage).toBe(0);
      expect(capturedOrderData.global_discount_reason).toBeNull();
    });

    it('Sad path (§6): Descuento general con porcentaje 0 o negativo NO se aplica', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
        reason: 'Promo Cero',
        percentage: 0,
        valid_until: futureDate,
        is_active: true,
      });

      const orderData = {
        items: [{ productId: 10, quantity: 1 }],
        deliveryType: 'pickup',
      };

      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          capturedOrderData = data;
          return { id: 'order-disc-4', ...data };
        }
        return data;
      });
      mockManager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          return Promise.resolve({ id: 'order-disc-4', ...data });
        }
        return Promise.resolve(data);
      });
      service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

      const result = await service.create('user-disc-1', orderData);

      expect(result.total).toBe(100);
      expect(capturedOrderData.global_discount_amount).toBe(0);
    });

    it('Sad path (§6): Rechaza con BadRequestException si la orden contiene items inválidos', async () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
        reason: 'Promo',
        percentage: 10,
        valid_until: futureDate,
        is_active: true,
      });

      const invalidOrderData = {
        items: [{ productId: 10, quantity: -1 }],
      };

      await expect(service.create('user-disc-1', invalidOrderData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sprint S83C: Motor de Descuento Dual Admin y Validación de Rangos Seguros (TASK-83-04 / TASK-83-05B)', () => {
    let mockSystemConfigsService: any;

    beforeEach(() => {
      mockSystemConfigsService = {
        getStoreDiscount: jest.fn(),
        getCachedDeliverySchedule: jest.fn().mockReturnValue(null),
      };
      (service as any).systemConfigsService = mockSystemConfigsService;

      userRepository.findOne.mockResolvedValue({
        id: 'user-s83c',
        general_discount: 0,
        productDiscounts: [],
        credit_balance: 0,
        delivery_fee: 0,
        account_type: 'cash',
      });

      productRepository.find.mockResolvedValue([
        { id: 10, price: 100 },
      ]);
    });

    describe('Capa de Validación de Rangos Seguros (§6)', () => {
      it('Sad Path: Flete negativo rechazado con BadRequestException', async () => {
        const orderData = {
          items: [{ productId: 10, quantity: 1 }],
          deliveryType: 'other',
          delivery_fee_charged: -15.00,
        };

        await expect(service.create('user-s83c', orderData))
          .rejects
          .toThrow(new BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $150.00'));
      });

      it('Sad Path: Flete mayor a $150.00 rechazado con BadRequestException', async () => {
        const orderData = {
          items: [{ productId: 10, quantity: 1 }],
          deliveryType: 'other',
          delivery_fee_charged: 150.01,
        };

        await expect(service.create('user-s83c', orderData))
          .rejects
          .toThrow(new BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $150.00'));
      });

      it('Sad Path: Flete NaN rechazado con BadRequestException', async () => {
        const orderData = {
          items: [{ productId: 10, quantity: 1 }],
          deliveryType: 'other',
          delivery_fee_charged: 'no-es-numero',
        };

        await expect(service.create('user-s83c', orderData))
          .rejects
          .toThrow(new BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $150.00'));
      });

      it('Sad Path: Descuento > 50% rechazado con BadRequestException', async () => {
        const orderData = {
          items: [{ productId: 10, quantity: 1 }],
          deliveryType: 'pickup',
          discount_percentage: 55.0,
        };

        await expect(service.create('user-s83c', orderData))
          .rejects
          .toThrow(new BadRequestException('El porcentaje de descuento no puede exceder el 50%'));
      });

      it('Sad Path: Descuento particular del cliente > 50% rechazado con BadRequestException', async () => {
        userRepository.findOne.mockResolvedValue({
          id: 'user-s83c-high-disc',
          general_discount: 60,
          productDiscounts: [],
          credit_balance: 0,
          delivery_fee: 0,
          account_type: 'cash',
        });

        const orderData = {
          items: [{ productId: 10, quantity: 1 }],
          deliveryType: 'pickup',
        };

        await expect(service.create('user-s83c-high-disc', orderData))
          .rejects
          .toThrow(new BadRequestException('El porcentaje de descuento no puede exceder el 50%'));
      });

      it('Sad Path: Cantidad de item no entera o <= 0 rechazada con BadRequestException', async () => {
        const orderData = {
          items: [{ productId: 10, quantity: 2.5 }],
          deliveryType: 'pickup',
        };

        await expect(service.create('user-s83c', orderData))
          .rejects
          .toThrow(BadRequestException);
      });
    });

    describe('Motor de Descuento Dual Admin (Precedencia Canónica Max, no acumulativa)', () => {
      it('Happy Path: Verificación de regla max entre descuento general y particular (Tienda > Cliente: 15% vs 10% -> 15%)', async () => {
        const validUntil = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
          reason: 'Gran Venta Anual Tienda',
          percentage: 15,
          valid_until: validUntil,
          is_active: true,
        });

        userRepository.findOne.mockResolvedValue({
          id: 'user-dual-1',
          general_discount: 10, // 10% client discount
          productDiscounts: [],
          credit_balance: 0,
          delivery_fee: 0,
          account_type: 'cash',
        });

        const orderData = {
          items: [{ productId: 10, quantity: 2 }], // 100 * 2 = 200
          deliveryType: 'pickup',
          payment_method: 'card',
        };

        let capturedOrderData: any = null;
        mockManager.create.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            capturedOrderData = data;
            return { id: 'order-dual-1', ...data };
          }
          return data;
        });
        mockManager.save.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            return Promise.resolve({ id: 'order-dual-1', ...data });
          }
          return Promise.resolve(data);
        });
        service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

        const result = await service.create('user-dual-1', orderData);

        // Precedencia max(15, 10) = 15%. Descuentos NO se acumulan (no es 25%).
        // Total = 200 - 30 = 170.
        expect(capturedOrderData.global_discount_percentage).toBe(15);
        expect(capturedOrderData.global_discount_amount).toBe(30);
        expect(capturedOrderData.global_discount_reason).toBe('Gran Venta Anual Tienda');
        expect(result.total).toBe(170);
      });

      it('Happy Path: Verificación de regla max entre descuento general y particular (Cliente > Tienda: 20% vs 15% -> 20%)', async () => {
        const validUntil = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
        mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
          reason: 'Venta Flash Tienda',
          percentage: 15,
          valid_until: validUntil,
          is_active: true,
        });

        userRepository.findOne.mockResolvedValue({
          id: 'user-dual-2',
          general_discount: 20, // 20% client discount
          productDiscounts: [],
          credit_balance: 0,
          delivery_fee: 0,
          account_type: 'cash',
        });

        const orderData = {
          items: [{ productId: 10, quantity: 2 }], // 100 * 2 = 200
          deliveryType: 'pickup',
          payment_method: 'card',
        };

        let capturedOrderData: any = null;
        mockManager.create.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            capturedOrderData = data;
            return { id: 'order-dual-2', ...data };
          }
          return data;
        });
        mockManager.save.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            return Promise.resolve({ id: 'order-dual-2', ...data });
          }
          return Promise.resolve(data);
        });
        service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

        const result = await service.create('user-dual-2', orderData);

        // Precedencia max(15, 20) = 20%. Descuentos NO se acumulan (no es 35%).
        // Total = 200 - 40 = 160.
        expect(capturedOrderData.global_discount_percentage).toBe(20);
        expect(capturedOrderData.global_discount_amount).toBe(40);
        expect(capturedOrderData.global_discount_reason).toContain('20%');
        expect(result.total).toBe(160);
      });

      it('Happy Path: Verificación con tienda inactiva y cliente con descuento (0% vs 10% -> 10%)', async () => {
        mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
          reason: 'Tienda Inactiva',
          percentage: 15,
          valid_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: false,
        });

        userRepository.findOne.mockResolvedValue({
          id: 'user-dual-3',
          general_discount: 10, // 10% client discount
          productDiscounts: [],
          credit_balance: 0,
          delivery_fee: 0,
          account_type: 'cash',
        });

        const orderData = {
          items: [{ productId: 10, quantity: 2 }], // 100 * 2 = 200
          deliveryType: 'pickup',
          payment_method: 'card',
        };

        let capturedOrderData: any = null;
        mockManager.create.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            capturedOrderData = data;
            return { id: 'order-dual-3', ...data };
          }
          return data;
        });
        mockManager.save.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            return Promise.resolve({ id: 'order-dual-3', ...data });
          }
          return Promise.resolve(data);
        });
        service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

        const result = await service.create('user-dual-3', orderData);

        // Precedencia max(0, 10) = 10%.
        // Total = 200 - 20 = 180.
        expect(capturedOrderData.global_discount_percentage).toBe(10);
        expect(capturedOrderData.global_discount_amount).toBe(20);
        expect(result.total).toBe(180);
      });

      it('Happy Path: Ambos descuentos en 0% -> No se aplica descuento (0% total)', async () => {
        mockSystemConfigsService.getStoreDiscount.mockResolvedValue({
          reason: '',
          percentage: 0,
          valid_until: '',
          is_active: false,
        });

        userRepository.findOne.mockResolvedValue({
          id: 'user-dual-4',
          general_discount: 0,
          productDiscounts: [],
          credit_balance: 0,
          delivery_fee: 0,
          account_type: 'cash',
        });

        const orderData = {
          items: [{ productId: 10, quantity: 2 }],
          deliveryType: 'pickup',
          payment_method: 'card',
        };

        let capturedOrderData: any = null;
        mockManager.create.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            capturedOrderData = data;
            return { id: 'order-dual-4', ...data };
          }
          return data;
        });
        mockManager.save.mockImplementation((entity: any, data: any) => {
          if (entity === Order) {
            return Promise.resolve({ id: 'order-dual-4', ...data });
          }
          return Promise.resolve(data);
        });
        service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

        const result = await service.create('user-dual-4', orderData);

        expect(capturedOrderData.global_discount_percentage).toBe(0);
        expect(capturedOrderData.global_discount_amount).toBe(0);
        expect(capturedOrderData.global_discount_reason).toBeNull();
        expect(result.total).toBe(200);
      });
    });
  });

  describe('Sprint S85C: Check Photo Validation (TASK-85-03)', () => {
    it('TASK-85-03 Sad Path: should throw BadRequestException when order payment method is CHECK but check photo is missing', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-check-1',
        email: 'b2b-check@bakery.com',
        account_type: 'cash',
      });

      const orderData = {
        items: [{ productId: 10, quantity: 2 }],
        deliveryType: 'pickup',
        paymentMethod: 'CHECK',
        // checkImageUrl explicitly missing
      };

      await expect(service.create('user-check-1', orderData)).rejects.toThrow(
        new BadRequestException('Foto del cheque es obligatoria para pagos con cheque')
      );
    });

    it('TASK-85-03 Sad Path: should throw BadRequestException when payment_method is lowercase check without checkImageUrl', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-check-2',
        email: 'b2b-check2@bakery.com',
        account_type: 'cash',
      });

      const orderData = {
        items: [{ productId: 10, quantity: 1 }],
        deliveryType: 'pickup',
        payment_method: 'check',
        checkImageUrl: '   ', // whitespace only
      };

      await expect(service.create('user-check-2', orderData)).rejects.toThrow(
        new BadRequestException('Foto del cheque es obligatoria para pagos con cheque')
      );
    });

    it('TASK-85-03 Happy Path: should create order with pending_check_verification when checkImageUrl is provided', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-check-3',
        email: 'b2b-valid@bakery.com',
        account_type: 'cash',
      });
      productRepository.find.mockResolvedValue([
        { id: 10, name: 'Croissant', price: 50 },
      ]);

      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          capturedOrderData = data;
          return { id: 'order-check-valid', ...data };
        }
        return data;
      });
      mockManager.save.mockImplementation((entity: any, data: any) => {
        if (entity === Order) {
          return Promise.resolve({ id: 'order-check-valid', ...data });
        }
        return Promise.resolve(data);
      });
      service.findOne = jest.fn().mockImplementation((id: string) => Promise.resolve({ id, ...capturedOrderData }));

      const orderData = {
        items: [{ productId: 10, quantity: 2 }],
        deliveryType: 'pickup',
        paymentMethod: 'CHECK',
        checkImageUrl: 'https://storage.jhoanes.com/checks/check_1048_front.jpg',
        checkNumber: '1048',
        checkBank: 'JPMorgan Chase',
      };

      const result = await service.create('user-check-3', orderData);

      expect(result).toBeDefined();
      expect(capturedOrderData.payment_status).toBe('pending_check_verification');
      expect(capturedOrderData.check_image_url).toBe('https://storage.jhoanes.com/checks/check_1048_front.jpg');
      expect(capturedOrderData.check_number).toBe('1048');
      expect(capturedOrderData.check_bank).toBe('JPMorgan Chase');
    });

    it('TASK-85-03 Sad Path: settleBatch rejects check payment without check photo', async () => {
      orderRepository.find.mockResolvedValueOnce([
        { id: 'order-batch-1', user_id: 'user-batch', status: 'delivered', payment_status: 'pending', total: 100, refunded_amount: 0 },
      ]);

      await expect(service.settleBatch('user-batch', 'client', {
        order_ids: ['order-batch-1'],
        payment_method: 'check',
      })).rejects.toThrow(
        new BadRequestException('Foto del cheque es obligatoria para pagos con cheque')
      );
    });
  });

  describe('Sprint S88: Resiliencia en Checkout, Desacoplamiento de Recibos y Validación Defensiva de Dirección', () => {
    it('TASK-88-02 Sad Path: should NOT dispatch order receipt or kitchen alert when cart is pending Stripe checkout', async () => {
      jest.clearAllMocks();
      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-stripe-pending',
        email: 'abandoned-cart@example.com',
        account_type: 'regular',
        profile: { full_name: 'Stripe Cart Abandoner' },
      });
      productRepository.find.mockResolvedValueOnce([
        { id: 1, name: 'Croissant', price: 5.0, status: 'active', is_active: true },
      ]);
      const createdOrder = { id: 'order-stripe-pending', user: { email: 'abandoned-cart@example.com' } };
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      const result = await service.create('user-stripe-pending', {
        items: [{ product_id: 1, quantity: 2 }],
        payment_method: 'stripe',
        payment_status: 'pending',
        status: 'pending',
        delivery_date: '2026-11-20',
      });

      expect(result).toBeDefined();
      expect(mockMailService.sendOrderReceipt).not.toHaveBeenCalled();
      expect(mockMailService.sendAdminNewOrderAlert).not.toHaveBeenCalled();
    });

    it('TASK-88-02 Happy Path: should dispatch order receipt and admin alert when order is created via cash or confirmed', async () => {
      jest.clearAllMocks();
      userRepository.findOne.mockResolvedValue({
        id: 'user-cash-confirmed',
        email: 'cash-buyer@example.com',
        account_type: 'regular',
        orders: [],
        profile: { full_name: 'B2B Cash Buyer' },
      });
      productRepository.find.mockResolvedValue([
        { id: 1, name: 'Croissant', price: 5.0, status: 'active', is_active: true },
      ]);
      const createdOrder = { id: 'order-cash-confirmed', user: { email: 'cash-buyer@example.com' }, profile: { full_name: 'B2B Cash Buyer' } };
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      const result = await service.create('user-cash-confirmed', {
        items: [{ product_id: 1, quantity: 2 }],
        payment_method: 'cash',
        delivery_date: '2026-11-20',
      });

      expect(result).toBeDefined();
      expect(mockMailService.sendOrderReceipt).toHaveBeenCalled();
      expect(mockMailService.sendAdminNewOrderAlert).toHaveBeenCalled();
    });

    it('TASK-88-03 Sad Path: should throw BadRequestException when address_id does not exist in addressRepository', async () => {
      const mockAddressRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      (service as any).addressRepository = mockAddressRepo;

      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-bad-address',
        email: 'bad-addr@example.com',
        account_type: 'regular',
      });
      productRepository.find.mockResolvedValueOnce([
        { id: 1, name: 'Croissant', price: 5.0, status: 'active', is_active: true },
      ]);

      await expect(service.create('user-bad-address', {
        items: [{ product_id: 1, quantity: 2 }],
        address_id: 'deleted-address-uuid-999',
        delivery_date: '2026-11-20',
      })).rejects.toThrow(
        new BadRequestException('La dirección de entrega seleccionada no existe o fue eliminada. Por favor, selecciona una dirección válida o añade una nueva.')
      );

      expect(mockAddressRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'deleted-address-uuid-999' },
      });
    });

    it('TASK-88-03 Happy Path: should accept existing address_id and inject lat/lng coordinates', async () => {
      const mockAddressRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'valid-address-uuid-123',
          lat: 40.7128,
          lng: -74.0060,
          refined_lat: 40.7130,
          refined_lng: -74.0062,
        }),
      };
      (service as any).addressRepository = mockAddressRepo;

      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-valid-address',
        email: 'valid-addr@example.com',
        account_type: 'regular',
        orders: [],
      });
      productRepository.find.mockResolvedValueOnce([
        { id: 1, name: 'Croissant', price: 5.0, status: 'active', is_active: true },
      ]);
      const createdOrder = { id: 'order-valid-address', user: { email: 'valid-addr@example.com' } };
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      const result = await service.create('user-valid-address', {
        items: [{ product_id: 1, quantity: 2 }],
        address_id: 'valid-address-uuid-123',
        delivery_date: '2026-11-20',
        payment_method: 'cash',
      });

      expect(result).toBeDefined();
      expect(mockAddressRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'valid-address-uuid-123' },
      });
    });
  });

  describe('Sprint S89: Blindaje para Transferencias Bancarias / Depósitos (ACH / Wire) con Kitchen Shield y Aprobación Administrativa', () => {
    it('TASK-89-01 & TASK-89-02 Sad Path (§6): should throw BadRequestException when ACH order is submitted without wire voucher receipt', async () => {
      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-wire-missing',
        email: 'client@example.com',
        account_type: 'regular',
      });
      productRepository.find.mockResolvedValueOnce([
        { id: 1, name: 'Croissant', price: 5.0, status: 'active', is_active: true },
      ]);

      await expect(service.create('user-wire-missing', {
        items: [{ product_id: 1, quantity: 2 }],
        payment_method: 'ach',
        wire_reference: 'WIRE-123456',
        delivery_date: '2026-11-20',
      })).rejects.toThrow(
        new BadRequestException('Comprobante de transferencia bancaria es obligatorio para pagos ACH / Wire')
      );
    });

    it('TASK-89-02 Happy Path: should create ACH order in pending_wire_verification with Late Invoicing (invoice_number null)', async () => {
      let capturedOrderData: any = null;
      mockManager.create.mockImplementation((entityClass: any, data: any) => {
        if (entityClass === Order || entityClass.name === 'Order') {
          capturedOrderData = { ...data, id: 'order-ach-verified-uuid' };
          return capturedOrderData;
        }
        return data;
      });
      mockManager.save.mockImplementation(async (entityClass: any, data: any) => {
        return Array.isArray(data) ? data : { ...data, id: data.id || 'order-ach-verified-uuid' };
      });

      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-wire-1',
        email: 'wire-buyer@example.com',
        account_type: 'regular',
        orders: [],
      });
      productRepository.find.mockResolvedValueOnce([
        { id: 10, name: 'Baguette', price: 4.0, status: 'active', is_active: true },
      ]);
      const createdOrder = {
        id: 'order-ach-verified-uuid',
        user: { email: 'wire-buyer@example.com' },
        payment_method: 'ach',
        payment_status: 'pending_wire_verification',
        invoice_number: null,
      };
      service.findOne = jest.fn().mockResolvedValue(createdOrder);

      const result = await service.create('user-wire-1', {
        items: [{ product_id: 10, quantity: 5 }],
        deliveryType: 'pickup',
        payment_method: 'ach',
        wire_receipt_url: 'https://storage.jhoanes.com/wire/voucher_987.pdf',
        wire_reference: 'TRACE-987654321',
      });

      expect(result).toBeDefined();
      expect(capturedOrderData.payment_status).toBe('pending_wire_verification');
      expect(capturedOrderData.invoice_number).toBeNull();
      expect(capturedOrderData.wire_receipt_url).toBe('https://storage.jhoanes.com/wire/voucher_987.pdf');
      expect(capturedOrderData.wire_reference).toBe('TRACE-987654321');
    });

    it('TASK-89-02 Kitchen Shield: findInRange should exclude pending_wire_verification from kitchen production list', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'order-confirmed-1',
            delivery_date: '2026-11-20',
            payment_status: 'paid',
            status: 'confirmed',
          },
        ]),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const results = await service.findInRange('2026-11-20', '2026-11-20');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('order-confirmed-1');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'order.payment_status NOT IN (:...pendingVerifications)',
        expect.objectContaining({
          pendingVerifications: expect.arrayContaining(['pending_wire_verification']),
        })
      );
    });

    it('TASK-89-03 Happy Path: approveWirePayment should transition payment_status to paid, assign invoice_number and dispatch alerts', async () => {
      const pendingOrder = {
        id: 'order-wire-to-approve',
        user_id: 'user-wire-approved',
        status: 'pending',
        payment_status: 'pending_wire_verification',
        invoice_number: null,
        notes: 'Initial notes',
      };
      service.findOne = jest.fn().mockResolvedValue(pendingOrder);
      service.getNextInvoiceNumber = jest.fn().mockResolvedValue('INV-9999');
      orderRepository.save.mockImplementation(async (order: any) => order);

      userRepository.findOne.mockResolvedValueOnce({
        id: 'user-wire-approved',
        email: 'approved-wire@example.com',
        profile: { full_name: 'Approved Wholesale Customer' },
      });

      const approved = await service.approveWirePayment('order-wire-to-approve', 'Deposit verified in Chase bank ledger');

      expect(approved.payment_status).toBe('paid');
      expect(approved.status).toBe('Pedido Enviado');
      expect(approved.invoice_number).toBe('INV-9999');
      expect(approved.notes).toContain('[Aprobación Transferencia ACH/Wire]: Deposit verified in Chase bank ledger');
      expect(mockMailService.sendOrderReceipt).toHaveBeenCalledWith(approved, 'approved-wire@example.com');
      expect(mockMailService.sendAdminNewOrderAlert).toHaveBeenCalled();
    });

    it('TASK-89-03 Sad Path (§6): approveWirePayment should throw BadRequestException if order is already cancelled', async () => {
      const cancelledOrder = {
        id: 'order-wire-cancelled',
        user_id: 'user-wire-cancelled',
        status: 'cancelled',
        payment_status: 'pending_wire_verification',
      };
      service.findOne = jest.fn().mockResolvedValue(cancelledOrder);

      await expect(service.approveWirePayment('order-wire-cancelled', 'Notes')).rejects.toThrow(
        new BadRequestException('Cannot approve wire transfer for a cancelled order')
      );
    });

    it('TASK-89-03 Sad Path (§6): approveWirePayment should throw NotFoundException if order does not exist', async () => {
      service.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.approveWirePayment('non-existent-order', 'Notes')).rejects.toThrow(
        new NotFoundException('Order not found')
      );
    });

    it('TASK-89-03 Happy Path & Sad Path (§6): rejectWirePayment should cancel order and throw NotFoundException if missing', async () => {
      const activeOrder = {
        id: 'order-wire-to-reject',
        status: 'pending',
        payment_status: 'pending_wire_verification',
        notes: 'Existing notes',
      };
      service.findOne = jest.fn().mockResolvedValueOnce(activeOrder);
      orderRepository.save.mockImplementation(async (order: any) => order);

      const rejected = await service.rejectWirePayment('order-wire-to-reject', 'Voucher is illegible / funds unverified');
      expect(rejected.status).toBe('Cancelado');
      expect(rejected.payment_status).toBe('unpaid');
      expect(rejected.notes).toContain('[Rechazo Transferencia ACH/Wire]: Voucher is illegible / funds unverified');

      service.findOne = jest.fn().mockResolvedValueOnce(null);
      await expect(service.rejectWirePayment('non-existent-wire', 'Reason')).rejects.toThrow(
        new NotFoundException('Order not found')
      );
    });
  });
});

