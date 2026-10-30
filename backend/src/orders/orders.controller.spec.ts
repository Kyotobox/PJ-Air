import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ExcelService } from './excel.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrdersService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
    findInRange: jest.fn(),
    findOne: jest.fn(),
    assignDelivery: jest.fn(),
    update: jest.fn(),
    approveZellePayment: jest.fn(),
    rejectZellePayment: jest.fn(),
    mutateOrderItems: jest.fn(),
  };

  const mockExcelService = {
    exportIndividual: jest.fn(),
    exportConsolidated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: ExcelService,
          useValue: mockExcelService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should extract userId and orderData and call service.create', async () => {
      const body = {
        userId: 'user-123',
        total: 100,
        items: [{ productId: 1, quantity: 2, price: 50 }],
      };

      const expectedOrderData = {
        total: 100,
        items: [{ productId: 1, quantity: 2, price: 50 }],
      };

      mockOrdersService.create.mockResolvedValue('mock-order');

      const req = { user: { id: 'user-123', role: 'client' } };
      const result = await controller.create(body, req as any);

      expect(service.create).toHaveBeenCalledWith('user-123', expectedOrderData);
      expect(result).toBe('mock-order');
    });
  });

  describe('updateStatus', () => {
    it('should extract id and status and call service.updateStatus with userRole', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'order-123', user_id: 'user-123' });
      mockOrdersService.updateStatus.mockResolvedValue('mock-updated-order');

      const req = { user: { id: 'user-123', role: 'admin' } };
      const result = await controller.updateStatus('order-123', 'shipped', req as any);

      expect(service.updateStatus).toHaveBeenCalledWith('order-123', 'shipped', 'admin');
      expect(result).toBe('mock-updated-order');
    });
  });

  describe('update', () => {
    it('should call service.update with body and userRole', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'order-123', user_id: 'user-123' });
      mockOrdersService.update.mockResolvedValue('mock-updated-order');

      const req = { user: { id: 'user-123', role: 'client' } };
      const body = { status: 'cancelled' };
      const result = await controller.update('order-123', body, req as any);

      expect(service.update).toHaveBeenCalledWith('order-123', body, 'client');
      expect(result).toBe('mock-updated-order');
    });
  });

  describe('Zelle Endpoints', () => {
    it('should call service.approveZellePayment when approveZelle is invoked', async () => {
      mockOrdersService.approveZellePayment.mockResolvedValue({ id: 'order-123', payment_status: 'paid' });
      const result = await controller.approveZelle('order-123');
      expect(service.approveZellePayment).toHaveBeenCalledWith('order-123');
      expect(result).toEqual({ id: 'order-123', payment_status: 'paid' });
    });

    it('should call service.rejectZellePayment when rejectZelle is invoked', async () => {
      mockOrdersService.rejectZellePayment.mockResolvedValue({ id: 'order-123', payment_status: 'unpaid', status: 'Cancelado' });
      const result = await controller.rejectZelle('order-123', 'Monto incorrecto');
      expect(service.rejectZellePayment).toHaveBeenCalledWith('order-123', 'Monto incorrecto');
      expect(result).toEqual({ id: 'order-123', payment_status: 'unpaid', status: 'Cancelado' });
    });

    it('should upload Zelle receipt screenshot successfully', async () => {
      const mockFile: any = { filename: 'zelle-123.jpg' };
      const result = await controller.uploadReceipt(mockFile);
      expect(result).toEqual({ url: '/uploads/zelle/zelle-123.jpg' });
    });

    it('should reject receipt upload if file is missing', async () => {
      await expect(controller.uploadReceipt(null as any)).rejects.toThrow('No file uploaded');
    });

    it('should call service.mutateOrderItems on mutateItems', async () => {
      mockOrdersService.mutateOrderItems.mockResolvedValue({ id: 'order-123', total: 150 });
      const body = { items: [{ productId: 1, quantity: 3 }] };
      const req = { user: { id: 'user-1', role: 'client' } };
      const result = await controller.mutateItems('order-123', body, req as any);
      expect(service.mutateOrderItems).toHaveBeenCalledWith('order-123', body, 'user-1', 'client');
      expect(result).toEqual({ id: 'order-123', total: 150 });
    });
  });
});
