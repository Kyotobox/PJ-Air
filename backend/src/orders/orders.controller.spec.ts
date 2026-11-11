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
    disableOrder: jest.fn(),
    bulkDisableOrders: jest.fn(),
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

    it('should allow client owner to update status with "Pedido Recibido" and "delivered"', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'order-123', user_id: 'client-user' });
      mockOrdersService.updateStatus.mockResolvedValue({ id: 'order-123', status: 'delivered' });

      const req = { user: { id: 'client-user', role: 'client' } };

      const resSpanish = await controller.updateStatus('order-123', 'Pedido Recibido', req as any);
      expect(service.updateStatus).toHaveBeenCalledWith('order-123', 'Pedido Recibido', 'client');
      expect(resSpanish).toEqual({ id: 'order-123', status: 'delivered' });

      const resEnglish = await controller.updateStatus('order-123', 'delivered', req as any);
      expect(service.updateStatus).toHaveBeenCalledWith('order-123', 'delivered', 'client');
      expect(resEnglish).toEqual({ id: 'order-123', status: 'delivered' });
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

  describe('updatePaymentStatus (TASK-71-03)', () => {
    it('should allow admin to update payment status to any valid status', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-admin-1', user_id: 'client-other' });
      mockOrdersService.update.mockResolvedValue({ id: 'ord-admin-1', payment_status: 'paid' });

      const req = { user: { id: 'admin-1', role: 'admin' } };
      const res = await controller.updatePaymentStatus('ord-admin-1', 'paid', 'pi_live_123', req as any);

      expect(service.update).toHaveBeenCalledWith('ord-admin-1', {
        payment_status: 'paid',
        stripe_payment_id: 'pi_live_123',
      }, 'admin');
      expect(res).toEqual({ id: 'ord-admin-1', payment_status: 'paid' });
    });

    it('should allow client owner to confirm payment_status: paid with stripe_payment_id', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-client-1', user_id: 'client-owner' });
      mockOrdersService.update.mockResolvedValue({ id: 'ord-client-1', payment_status: 'paid', pending_balance: 0 });

      const req = { user: { id: 'client-owner', role: 'client' } };
      const res = await controller.updatePaymentStatus('ord-client-1', 'paid', 'pi_test_abc', req as any);

      expect(service.update).toHaveBeenCalledWith('ord-client-1', {
        payment_status: 'paid',
        pending_balance: 0,
        stripe_payment_id: 'pi_test_abc',
      }, 'client');
      expect(res).toEqual({ id: 'ord-client-1', payment_status: 'paid', pending_balance: 0 });
    });

    it('Sad path: client attempting to confirm payment on another client order throws ForbiddenException (§6)', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-other-user', user_id: 'victim-client' });
      const req = { user: { id: 'attacker-client', role: 'client' } };

      await expect(controller.updatePaymentStatus('ord-other-user', 'paid', undefined, req as any))
        .rejects.toThrow('No tiene permisos para modificar el estado de pago de esta orden');
    });

    it('Sad path: client attempting to set status other than paid throws ForbiddenException (§6)', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-own', user_id: 'client-owner' });
      const req = { user: { id: 'client-owner', role: 'client' } };

      await expect(controller.updatePaymentStatus('ord-own', 'refunded', undefined, req as any))
        .rejects.toThrow('Clientes solo pueden confirmar pagos completados');
    });
  });

  describe('disableOrder and bulkDisable (TASK-76-01)', () => {
    it('should call ordersService.disableOrder with id and reason on PATCH :id/disable (happy path)', async () => {
      (mockOrdersService.disableOrder as jest.Mock).mockResolvedValue({
        id: 'ord-to-disable',
        status: 'cancelled',
        notes: '[ORDEN INHABILITADA POR ADMINISTRACIÓN: Compra de prueba - 2026-11-11T12:00:00.000Z]\n',
      });

      const result = await controller.disableOrder('ord-to-disable', { reason: 'Compra de prueba' });

      expect(mockOrdersService.disableOrder).toHaveBeenCalledWith('ord-to-disable', 'Compra de prueba');
      expect(result.status).toBe('cancelled');
    });

    it('should call ordersService.bulkDisableOrders with orderIds and reason on POST bulk-disable (happy path)', async () => {
      (mockOrdersService.bulkDisableOrders as jest.Mock).mockResolvedValue({ affected: 3 });

      const result = await controller.bulkDisable({
        orderIds: ['ord-1', 'ord-2', 'ord-3'],
        reason: 'Limpieza de compras de prueba',
      });

      expect(mockOrdersService.bulkDisableOrders).toHaveBeenCalledWith(
        ['ord-1', 'ord-2', 'ord-3'],
        'Limpieza de compras de prueba',
      );
      expect(result).toEqual({ affected: 3 });
    });

    it('Sad path: should propagate error when service.disableOrder fails', async () => {
      (mockOrdersService.disableOrder as jest.Mock).mockRejectedValue(new Error('Order not found'));

      await expect(controller.disableOrder('invalid-id', { reason: 'test' })).rejects.toThrow('Order not found');
    });

    it('Sad path: should propagate BadRequestException when bulkDisable receives invalid data', async () => {
      (mockOrdersService.bulkDisableOrders as jest.Mock).mockRejectedValue(new Error('orderIds debe ser un arreglo no vacío'));

      await expect(controller.bulkDisable({ orderIds: [], reason: 'test' })).rejects.toThrow('orderIds debe ser un arreglo no vacío');
    });
  });
});
