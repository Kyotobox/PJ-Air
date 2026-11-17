import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { OrdersController } from '../orders/orders.controller';
import { OrdersService } from '../orders/orders.service';
import { ExcelService } from '../orders/excel.service';
import { FinanceExportService } from '../orders/finance-export.service';

/**
 * Sprint S97 Certification Test Suite: Auditor Role RBAC Read-Only SoD & Export (§6, §48)
 *
 * Verificaciones mandatorias:
 * 1. Sad Paths (§6): Un usuario con rol 'auditor' recibe estrictamente 403 Forbidden
 *    al intentar mutar órdenes, productos o usuarios (SoD - Segregación de Funciones).
 * 2. Happy Paths: Un usuario 'auditor' puede consultar y exportar el libro contable
 *    de órdenes en Excel / CSV con headers fiscales (200 OK).
 */
describe('Sprint S97: Auditor RBAC Read-Only SoD & Accounting Ledger Export Certification (§6, §48)', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let ordersController: OrdersController;

  const mockOrdersService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findAll: jest.fn().mockResolvedValue([
      { id: 'ord-101', total: 150.5, payment_status: 'paid', status: 'delivered', user_id: 'usr-client-1' },
      { id: 'ord-102', total: 320.0, payment_status: 'pending', status: 'confirmed', user_id: 'usr-client-2' },
    ]),
    findByUser: jest.fn().mockResolvedValue([
      { id: 'ord-101', total: 150.5, payment_status: 'paid', status: 'delivered', user_id: 'usr-client-1' },
    ]),
    findInRange: jest.fn().mockResolvedValue([
      { id: 'ord-101', total: 150.5, payment_status: 'paid', status: 'delivered', user_id: 'usr-client-1' },
    ]),
    findOne: jest.fn().mockImplementation((id: string) => {
      return Promise.resolve({
        id,
        total: 150.5,
        payment_status: 'paid',
        status: 'delivered',
        user_id: 'usr-client-1',
      });
    }),
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
    settleBatch: jest.fn(),
  };

  const mockExcelService = {
    exportIndividual: jest.fn(),
    exportConsolidated: jest.fn(),
    exportAccounting: jest.fn(),
  };

  const mockFinanceExportService = {
    exportTaxAndSalesLedger: jest.fn().mockResolvedValue(Buffer.from('MOCK_EXCEL_TAX_LEDGER_BUFFER_DATA')),
  };

  const createMockContext = (options: {
    user?: any;
    method?: string;
    url?: string;
    roles?: string[];
  }): ExecutionContext => {
    jest.spyOn(reflector, 'get').mockReturnValue(options.roles ?? ['admin']);
    if (typeof reflector.getAllAndOverride === 'function') {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options.roles ?? ['admin']);
    }

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: options.user,
          method: (options.method || 'GET').toUpperCase(),
          url: options.url || '/admin/orders',
          originalUrl: options.url || '/admin/orders',
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);

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
        {
          provide: FinanceExportService,
          useValue: mockFinanceExportService,
        },
      ],
    }).compile();

    ordersController = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  describe('Sad Paths: Strict 403 Forbidden on Auditor Mutation Attempts (SoD Enforcement §6)', () => {
    describe('1.1 Orders Mutation Blocking', () => {
      it('RolesGuard strictly rejects POST /orders for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'POST',
          url: '/orders',
          roles: ['admin', 'auditor'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
        try {
          rolesGuard.canActivate(ctx);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
          expect(err.message).toContain('auditor role is strictly read-only (SoD). Mutations are forbidden.');
        }
      });

      it('RolesGuard strictly rejects PUT /orders/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PUT',
          url: '/orders/ord-123',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
        try {
          rolesGuard.canActivate(ctx);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
        }
      });

      it('RolesGuard strictly rejects PATCH /orders/:id/status for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/orders/ord-123/status',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
        try {
          rolesGuard.canActivate(ctx);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
        }
      });

      it('RolesGuard strictly rejects DELETE /orders/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'DELETE',
          url: '/orders/ord-123',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
        try {
          rolesGuard.canActivate(ctx);
        } catch (err: any) {
          expect(err.getStatus()).toBe(403);
        }
      });

      it('OrdersController.create throws ForbiddenException when invoked by auditor role', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        await expect(ordersController.create({ items: [] }, req as any))
          .rejects.toThrow(ForbiddenException);
        await expect(ordersController.create({ items: [] }, req as any))
          .rejects.toThrow('Auditor role is read-only (SoD). Mutations are strictly forbidden.');
      });

      it('OrdersController.settleBatch throws ForbiddenException when invoked by auditor role', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        const body = { order_ids: ['ord-101'], payment_method: 'zelle' };
        await expect(ordersController.settleBatch(body, req as any))
          .rejects.toThrow(ForbiddenException);
        await expect(ordersController.settleBatch(body, req as any))
          .rejects.toThrow('Auditor role is read-only (SoD). Mutations are strictly forbidden.');
      });

      it('OrdersController.updateStatus throws ForbiddenException when invoked by auditor role', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        await expect(ordersController.updateStatus('ord-101', 'delivered', req as any))
          .rejects.toThrow(ForbiddenException);
        await expect(ordersController.updateStatus('ord-101', 'delivered', req as any))
          .rejects.toThrow('Auditor role is read-only (SoD). Mutations are strictly forbidden.');
      });

      it('OrdersController.completeCheckout throws ForbiddenException when invoked by auditor role (POST and PATCH)', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        await expect(ordersController.completeCheckoutPost('ord-101', req as any))
          .rejects.toThrow(ForbiddenException);
        await expect(ordersController.completeCheckoutPatch('ord-101', req as any))
          .rejects.toThrow(ForbiddenException);
      });

      it('OrdersController.update throws ForbiddenException when invoked by auditor role', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        await expect(ordersController.update('ord-101', { notes: 'audit edit attempt' }, req as any))
          .rejects.toThrow(ForbiddenException);
      });
    });

    describe('1.2 Products Mutation Blocking', () => {
      it('RolesGuard strictly rejects POST /products for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'POST',
          url: '/products',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects PATCH /products/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/products/55',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects PATCH /products/rename-category for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/products/rename-category',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects DELETE /products/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'DELETE',
          url: '/products/55',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });
    });

    describe('1.3 Users Mutation Blocking', () => {
      it('RolesGuard strictly rejects POST /users for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'POST',
          url: '/users',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects PATCH /users/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/users/usr-777',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects PATCH /users/:id/role for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/users/usr-777/role',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects PATCH /users/:id/approve for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'PATCH',
          url: '/users/usr-777/approve',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });

      it('RolesGuard strictly rejects DELETE /users/:id for auditor with 403 Forbidden', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'DELETE',
          url: '/users/usr-777',
          roles: ['admin'],
        });

        expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
      });
    });

    describe('1.4 Operational Non-Financial Routes Blocking', () => {
      const operationalRoutes = [
        '/admin/zones',
        '/admin/banners',
        '/admin/settings',
        '/produccion',
        '/delivery',
        '/routes',
        '/dispatch',
        '/categories',
      ];

      for (const route of operationalRoutes) {
        it(`RolesGuard strictly rejects GET ${route} for auditor with 403 Forbidden`, () => {
          const ctx = createMockContext({
            user: { id: 'aud-001', role: 'auditor' },
            method: 'GET',
            url: route,
            roles: ['admin'],
          });

          expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
          try {
            rolesGuard.canActivate(ctx);
          } catch (err: any) {
            expect(err.getStatus()).toBe(403);
            expect(err.message).toContain('Access denied: auditor role cannot access operational or configuration endpoints');
          }
        });
      }
    });
  });

  describe('Happy Paths: Auditor Read-Only Access & Accounting Ledger Export (200 OK)', () => {
    describe('2.1 Querying Orders and Financial Data (200 OK)', () => {
      it('RolesGuard permits auditor GET access to /orders', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'GET',
          url: '/orders',
          roles: ['admin', 'auditor'],
        });

        const canActivate = rolesGuard.canActivate(ctx);
        expect(canActivate).toBe(true);
      });

      it('RolesGuard permits auditor GET access to /admin/orders', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'GET',
          url: '/admin/orders',
          roles: ['admin'],
        });

        const canActivate = rolesGuard.canActivate(ctx);
        expect(canActivate).toBe(true);
      });

      it('RolesGuard permits auditor GET access to /admin/reports', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'GET',
          url: '/admin/reports/sales-tax',
          roles: ['admin'],
        });

        const canActivate = rolesGuard.canActivate(ctx);
        expect(canActivate).toBe(true);
      });

      it('RolesGuard permits auditor GET access to /admin-actions audit logs', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'GET',
          url: '/admin-actions/audit-logs',
          roles: ['admin'],
        });

        const canActivate = rolesGuard.canActivate(ctx);
        expect(canActivate).toBe(true);
      });

      it('OrdersController.findAll allows auditor to retrieve all orders (200 OK)', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        const orders = await ordersController.findAll(req as any);

        expect(orders).toBeDefined();
        expect(Array.isArray(orders)).toBe(true);
        expect(orders.length).toBe(2);
        expect(mockOrdersService.findAll).toHaveBeenCalled();
        expect(mockOrdersService.findByUser).not.toHaveBeenCalled();
      });

      it('OrdersController.findOne allows auditor to view details of any order (200 OK)', async () => {
        const req = { user: { id: 'aud-001', role: 'auditor' } };
        const order = await ordersController.findOne('ord-101', req as any);

        expect(order).toBeDefined();
        expect(order.id).toBe('ord-101');
        expect(mockOrdersService.findOne).toHaveBeenCalledWith('ord-101');
      });

      it('OrdersController.findInRange allows auditor to query orders in date range for tax audit', async () => {
        const result = await ordersController.findInRange('2026-11-01', '2026-11-17');
        expect(result).toBeDefined();
        expect(mockOrdersService.findInRange).toHaveBeenCalledWith('2026-11-01', '2026-11-17', undefined);
      });
    });

    describe('2.2 Exporting Tax & Sales Accounting Ledger (200 OK)', () => {
      it('RolesGuard permits auditor GET access to /orders/finance/export', () => {
        const ctx = createMockContext({
          user: { id: 'aud-001', role: 'auditor' },
          method: 'GET',
          url: '/orders/finance/export',
          roles: ['admin', 'auditor'],
        });

        const canActivate = rolesGuard.canActivate(ctx);
        expect(canActivate).toBe(true);
      });

      it('OrdersController.exportFinance generates Excel file and delivers 200 OK response with correct headers', async () => {
        const mockRes = {
          set: jest.fn(),
          end: jest.fn(),
        };

        await ordersController.exportFinance('2026-11-01', '2026-11-17', mockRes as any);

        expect(mockFinanceExportService.exportTaxAndSalesLedger).toHaveBeenCalledWith('2026-11-01', '2026-11-17');
        expect(mockRes.set).toHaveBeenCalledWith({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="LIBRO_VENTAS_FISCAL_2026-11-01_2026-11-17.xlsx"',
          'Content-Length': Buffer.from('MOCK_EXCEL_TAX_LEDGER_BUFFER_DATA').length,
        });
        expect(mockRes.end).toHaveBeenCalledWith(Buffer.from('MOCK_EXCEL_TAX_LEDGER_BUFFER_DATA'));
      });

      it('Sad path (§6): exportFinance throws BadRequestException if FinanceExportService is uninitialized', async () => {
        const controllerWithoutExport = new OrdersController(mockOrdersService as any, mockExcelService as any, undefined);
        const mockRes = { set: jest.fn(), end: jest.fn() };

        await expect(controllerWithoutExport.exportFinance('2026-11-01', '2026-11-17', mockRes as any))
          .rejects.toThrow(BadRequestException);
      });
    });
  });
});
