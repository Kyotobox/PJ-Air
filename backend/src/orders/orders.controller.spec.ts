import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
    approveCheckPayment: jest.fn(),
    rejectCheckPayment: jest.fn(),
    mutateOrderItems: jest.fn(),
    disableOrder: jest.fn(),
    bulkDisableOrders: jest.fn(),
    completeCheckout: jest.fn(),
    getPaymentsService: jest.fn(),
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

      expect(service.create).toHaveBeenCalledWith('user-123', expectedOrderData, { isAdmin: false });
      expect(result).toBe('mock-order');
    });

    it('TASK-91-01 Happy path: should allow admin to create manual order for target userId', async () => {
      const body = {
        userId: 'client-b2b-id',
        manual_entry: true,
        total: 150,
        items: [{ productId: 1, quantity: 3, price_at_time: 50 }],
      };

      mockOrdersService.create.mockResolvedValue({ id: 'order-created-admin' });

      const req = { user: { id: 'admin-id', role: 'admin' } };
      const result = await controller.create(body, req as any);

      expect(service.create).toHaveBeenCalledWith(
        'client-b2b-id',
        expect.objectContaining({ manual_entry: true }),
        { isAdmin: true },
      );
      expect(result).toEqual({ id: 'order-created-admin' });
    });

    it('TASK-91-01 Sad path (§6): should throw BadRequestException if admin submits manual order without userId', async () => {
      const body = {
        manual_entry: true,
        items: [{ productId: 1, quantity: 1 }],
      };

      const req = { user: { id: 'admin-id', role: 'admin' } };
      await expect(controller.create(body, req as any)).rejects.toThrow(
        new BadRequestException('Debe seleccionar un cliente para registrar el pedido manual'),
      );
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

    it('TASK-87-01: should call service.approveCheckPayment when approveCheck is invoked', async () => {
      mockOrdersService.approveCheckPayment.mockResolvedValue({ id: 'order-chk-1', payment_status: 'paid', invoice_number: 'INV-1647' });
      const result = await controller.approveCheck('order-chk-1', 'Aprobado');
      expect(service.approveCheckPayment).toHaveBeenCalledWith('order-chk-1', 'Aprobado');
      expect(result).toEqual({ id: 'order-chk-1', payment_status: 'paid', invoice_number: 'INV-1647' });
    });

    it('TASK-87-01: should call service.rejectCheckPayment when rejectCheck is invoked', async () => {
      mockOrdersService.rejectCheckPayment.mockResolvedValue({ id: 'order-chk-2', payment_status: 'unpaid', status: 'Cancelado' });
      const result = await controller.rejectCheck('order-chk-2', 'Cheque sin fondos');
      expect(service.rejectCheckPayment).toHaveBeenCalledWith('order-chk-2', 'Cheque sin fondos');
      expect(result).toEqual({ id: 'order-chk-2', payment_status: 'unpaid', status: 'Cancelado' });
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

    it('TASK-77-02 Happy Path: should downgrade to partially_paid with pending_balance when Stripe payment is less than order total', async () => {
      const mockPaymentsService = {
        retrievePaymentIntent: jest.fn().mockResolvedValue({
          id: 'pi_partial_625',
          amount_received: 127409,
        }),
      };
      (mockOrdersService.getPaymentsService as jest.Mock).mockReturnValue(mockPaymentsService);
      mockOrdersService.findOne.mockResolvedValue({
        id: 'ord-underpaid',
        user_id: 'client-owner',
        total: 1899.09,
        notes: '',
      });
      mockOrdersService.update.mockResolvedValue({
        id: 'ord-underpaid',
        payment_status: 'partially_paid',
        pending_balance: 625.00,
      });

      const req = { user: { id: 'client-owner', role: 'client' } };
      const res = await controller.updatePaymentStatus('ord-underpaid', 'paid', 'pi_partial_625', req as any);

      expect(service.update).toHaveBeenCalledWith('ord-underpaid', {
        payment_status: 'partially_paid',
        pending_balance: 625.00,
        notes: expect.stringContaining('[PAGO PARCIAL STRIPE] Cobrado $1274.09 vía Stripe (pi_partial_625). Saldo pendiente: $625.00.'),
        stripe_payment_id: 'pi_partial_625',
      }, 'client');
      expect(res.payment_status).toBe('partially_paid');
      expect(res.pending_balance).toBe(625.00);
    });

    it('TASK-78-05 Happy Path: should fully mark paid and clear pending_balance when settlement payment matches pending balance', async () => {
      const mockPaymentsService = {
        retrievePaymentIntent: jest.fn().mockResolvedValue({
          id: 'pi_settle_300',
          amount_received: 30000,
          metadata: { type: 'settlement' },
        }),
      };
      (mockOrdersService.getPaymentsService as jest.Mock).mockReturnValue(mockPaymentsService);
      mockOrdersService.findOne.mockResolvedValue({
        id: 'ord-settled-balance',
        user_id: 'client-owner',
        total: 1574.09,
        pending_balance: 300.00,
        notes: '',
      });
      mockOrdersService.update.mockResolvedValue({
        id: 'ord-settled-balance',
        payment_status: 'paid',
        pending_balance: 0,
      });

      const req = { user: { id: 'client-owner', role: 'client' } };
      const res = await controller.updatePaymentStatus('ord-settled-balance', 'paid', 'pi_settle_300', req as any);

      expect(service.update).toHaveBeenCalledWith('ord-settled-balance', {
        payment_status: 'paid',
        pending_balance: 0,
        stripe_payment_id: 'pi_settle_300',
      }, 'client');
      expect(res.payment_status).toBe('paid');
      expect(res.pending_balance).toBe(0);
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

  describe('completeCheckout (TASK-85-02)', () => {
    it('Happy path: should allow client owner to complete checkout and return confirmed order with invoice', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-123', user_id: 'client-owner' });
      mockOrdersService.completeCheckout.mockResolvedValue({
        id: 'ord-123',
        status: 'confirmed',
        invoice_number: 'INV-1001',
      });

      const req = { user: { id: 'client-owner', role: 'client' } };
      const resPost = await controller.completeCheckoutPost('ord-123', req as any);
      expect(service.completeCheckout).toHaveBeenCalledWith('ord-123', 'client');
      expect(resPost).toEqual({
        id: 'ord-123',
        status: 'confirmed',
        invoice_number: 'INV-1001',
      });

      const resPatch = await controller.completeCheckoutPatch('ord-123', req as any);
      expect(resPatch).toEqual({
        id: 'ord-123',
        status: 'confirmed',
        invoice_number: 'INV-1001',
      });
    });

    it('Sad path: client attempting to complete checkout on another user order throws ForbiddenException (§6)', async () => {
      mockOrdersService.findOne.mockResolvedValue({ id: 'ord-other', user_id: 'other-user' });
      const req = { user: { id: 'attacker-client', role: 'client' } };

      await expect(controller.completeCheckoutPost('ord-other', req as any))
        .rejects.toThrow('Cannot modify this order');
    });
  });
});
