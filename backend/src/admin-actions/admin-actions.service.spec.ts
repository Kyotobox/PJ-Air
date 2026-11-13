import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminActionsService } from './admin-actions.service';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { AdminAuditLog } from './admin-audit-log.entity';
import { hashPassword } from '../auth/crypto.util';

describe('AdminActionsService', () => {
  let service: AdminActionsService;
  let userRepositoryMock: any;
  let systemConfigRepositoryMock: any;
  let adminAuditLogRepositoryMock: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    userRepositoryMock = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    systemConfigRepositoryMock = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    adminAuditLogRepositoryMock = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((log) => Promise.resolve({ id: 'audit-uuid-1', created_at: new Date(), ...log })),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminActionsService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepositoryMock,
        },
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: systemConfigRepositoryMock,
        },
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: adminAuditLogRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<AdminActionsService>(AdminActionsService);
  });

  describe('resetPassword', () => {
    it('debería restablecer la contraseña y activar el flag force_pwd_change', async () => {
      const user = { id: 'user-1', email: 'test@email.com', role: 'client' };
      userRepositoryMock.findOne.mockResolvedValue(user);
      systemConfigRepositoryMock.findOne.mockResolvedValue(null);

      const result = await service.resetPassword('user-1', 'NuevaClave123!');

      expect(userRepositoryMock.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(userRepositoryMock.update).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(systemConfigRepositoryMock.save).toHaveBeenCalledWith({
        key: 'force_pwd_change:user-1',
        value: 'true',
      });
      expect(result.success).toBe(true);
    });

    it('debería lanzar ForbiddenException si el usuario objetivo es administrador', async () => {
      const adminUser = { id: 'admin-1', email: 'admin@email.com', role: 'admin' };
      userRepositoryMock.findOne.mockResolvedValue(adminUser);

      await expect(service.resetPassword('admin-1', 'NuevaClave123!'))
        .rejects
        .toThrow(ForbiddenException);

      expect(userRepositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe('changeOwnPassword', () => {
    it('debería cambiar la contraseña y eliminar el flag force_pwd_change si la clave actual es válida (PBKDF2)', async () => {
      const currentPasswordText = 'ClaveActual123!';
      const hashedPassword = hashPassword(currentPasswordText);
      const user = { id: 'user-1', password: hashedPassword };
      
      userRepositoryMock.findOne.mockResolvedValue(user);

      const result = await service.changeOwnPassword('user-1', currentPasswordText, 'NuevaClave123!');

      expect(userRepositoryMock.update).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(systemConfigRepositoryMock.delete).toHaveBeenCalledWith({ key: 'force_pwd_change:user-1' });
      expect(result.success).toBe(true);
    });

    it('debería lanzar UnauthorizedException si la contraseña actual es incorrecta', async () => {
      const user = { id: 'user-1', password: hashPassword('ClaveCorrecta!') };
      userRepositoryMock.findOne.mockResolvedValue(user);

      await expect(service.changeOwnPassword('user-1', 'ClaveIncorrecta!', 'NuevaClave123!'))
        .rejects
        .toThrow(UnauthorizedException);

      expect(userRepositoryMock.update).not.toHaveBeenCalled();
    });
  });

  describe('TASK-83-05: Módulo de Auditoría Forense Administrativa (AdminAuditLog)', () => {
    describe('logAction', () => {
      it('Happy Path: Registro correcto de eventos de auditoría con serialización JSON', async () => {
        const prevState = { delivery_fee_charged: 10.0, total: 150.0 };
        const newState = { delivery_fee_charged: 0.0, total: 140.0 };

        const result = await service.logAction(
          'admin-uuid-1',
          'Super Admin',
          'FEE_OVERRIDE',
          'Order',
          'order-uuid-999',
          prevState,
          newState,
          'Ajuste de cortesía por retraso en entrega',
          '192.168.1.50',
        );

        expect(adminAuditLogRepositoryMock.create).toHaveBeenCalledWith({
          admin_id: 'admin-uuid-1',
          admin_name: 'Super Admin',
          action: 'FEE_OVERRIDE',
          target_entity: 'Order',
          target_id: 'order-uuid-999',
          previous_state_json: JSON.stringify(prevState),
          new_state_json: JSON.stringify(newState),
          notes: 'Ajuste de cortesía por retraso en entrega',
          ip_address: '192.168.1.50',
        });
        expect(adminAuditLogRepositoryMock.save).toHaveBeenCalled();
        expect(result.id).toBe('audit-uuid-1');
        expect(result.action).toBe('FEE_OVERRIDE');
      });

      it('Happy Path: Registro correcto de eventos cuando estados son cadenas de texto directas', async () => {
        const result = await service.logAction(
          'admin-uuid-2',
          'Admin Ventas',
          'DISCOUNT_CHANGE',
          'SystemConfig',
          'store_general_discount',
          '{"percentage":0}',
          '{"percentage":15}',
          'Activación de descuento general de tienda',
          '10.0.0.1',
        );

        expect(adminAuditLogRepositoryMock.create).toHaveBeenCalledWith({
          admin_id: 'admin-uuid-2',
          admin_name: 'Admin Ventas',
          action: 'DISCOUNT_CHANGE',
          target_entity: 'SystemConfig',
          target_id: 'store_general_discount',
          previous_state_json: '{"percentage":0}',
          new_state_json: '{"percentage":15}',
          notes: 'Activación de descuento general de tienda',
          ip_address: '10.0.0.1',
        });
        expect(result.action).toBe('DISCOUNT_CHANGE');
      });

      it('Happy Path: Maneja estados nulos/indefinidos y datos por defecto sin fallar', async () => {
        const result = await service.logAction(
          '',
          '',
          'CLIENT_RATE_UPDATE',
          'User',
          'client-10',
          null,
          undefined,
        );

        expect(adminAuditLogRepositoryMock.create).toHaveBeenCalledWith({
          admin_id: '',
          admin_name: 'Admin',
          action: 'CLIENT_RATE_UPDATE',
          target_entity: 'User',
          target_id: 'client-10',
          previous_state_json: null,
          new_state_json: null,
          notes: null,
          ip_address: null,
        });
        expect(result.action).toBe('CLIENT_RATE_UPDATE');
      });
    });

    describe('getAuditLogs', () => {
      it('Happy Path: Consulta de bitácora con paginación por defecto', async () => {
        const mockLogs = [
          {
            id: 'log-1',
            admin_id: 'admin-1',
            admin_name: 'Admin',
            action: 'ORDER_EDIT',
            target_entity: 'Order',
            target_id: 'ord-1',
            created_at: new Date(),
          },
        ];
        mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([mockLogs, 1]);

        const result = await service.getAuditLogs({ page: 1, limit: 20 });

        expect(result.logs).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.totalPages).toBe(1);
        expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      });

      it('Happy Path: Aplica filtros por acción, target_entity, target_id, admin_id y rango de fechas', async () => {
        mockQueryBuilder.getManyAndCount.mockResolvedValueOnce([[], 0]);

        await service.getAuditLogs({
          page: 2,
          limit: 10,
          action: 'FEE_OVERRIDE',
          targetEntity: 'Order',
          targetId: 'ord-123',
          adminId: 'admin-99',
          startDate: '2026-11-01',
          endDate: '2026-11-30',
        });

        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', { action: 'FEE_OVERRIDE' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.target_entity = :targetEntity', { targetEntity: 'Order' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.target_id = :targetId', { targetId: 'ord-123' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.admin_id = :adminId', { adminId: 'admin-99' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.created_at >= :startDate', { startDate: '2026-11-01' });
        expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.created_at <= :endDate', { endDate: '2026-11-30' });
        expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
        expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      });
    });
  });
});
