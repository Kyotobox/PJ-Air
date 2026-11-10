import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SystemConfigsController } from './system-configs.controller';
import { SystemConfigsService } from './system-configs.service';
import { AuthGuard } from '../auth/auth.guard';

describe('SystemConfigsController', () => {
  let controller: SystemConfigsController;
  let service: any;

  beforeEach(async () => {
    service = {
      get: jest.fn(),
      update: jest.fn(),
      getDeliverySchedule: jest.fn().mockResolvedValue({
        workingDays: [0, 1, 3, 4, 5, 6],
        holidays: [],
        exceptionalDays: [],
        cutoffHour: 12,
      }),
      updateDeliverySchedule: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          workingDays: data.workingDays ?? [0, 1, 3, 4, 5, 6],
          holidays: data.holidays ?? [],
          exceptionalDays: data.exceptionalDays ?? [],
          cutoffHour: 12,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigsController],
      providers: [
        {
          provide: SystemConfigsService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SystemConfigsController>(SystemConfigsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDeliverySchedule', () => {
    it('should return delivery schedule from service', async () => {
      const result = await controller.getDeliverySchedule();
      expect(result).toHaveProperty('workingDays');
      expect(result).toHaveProperty('cutoffHour', 12);
      expect(service.getDeliverySchedule).toHaveBeenCalled();
    });
  });

  describe('updateDeliverySchedule', () => {
    it('Happy path: admin can update delivery schedule', async () => {
      const req = { user: { role: 'admin' } };
      const body = { workingDays: [1, 2, 3, 4, 5] };
      const result = await controller.updateDeliverySchedule(body, req);
      expect(result.workingDays).toEqual([1, 2, 3, 4, 5]);
      expect(service.updateDeliverySchedule).toHaveBeenCalledWith(body);
    });

    it('Sad path (§6): non-admin user receives ForbiddenException', async () => {
      const req = { user: { role: 'customer' } };
      const body = { workingDays: [1, 2, 3, 4, 5] };
      await expect(
        controller.updateDeliverySchedule(body, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('get and update generic configs', () => {
    it('should return config key and value', async () => {
      service.get.mockResolvedValue('500');
      const res = await controller.get('min_order_amount');
      expect(res).toEqual({ key: 'min_order_amount', value: '500' });
    });

    it('should throw NotFoundException if config is empty', async () => {
      service.get.mockResolvedValue('');
      await expect(controller.get('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
