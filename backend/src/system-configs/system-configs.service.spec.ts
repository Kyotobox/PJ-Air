import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SystemConfigsService } from './system-configs.service';
import { SystemConfig } from './system-config.entity';

describe('SystemConfigsService', () => {
  let service: SystemConfigsService;
  let repo: any;
  let storage: Record<string, string>;

  beforeEach(async () => {
    storage = {};

    repo = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(({ where: { key } }) => {
        if (storage[key] !== undefined) {
          return Promise.resolve({ key, value: storage[key] });
        }
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((entity) => {
        storage[entity.key] = entity.value;
        return Promise.resolve(entity);
      }),
      create: jest.fn().mockImplementation((data) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigsService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<SystemConfigsService>(SystemConfigsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should seed default configs when repo is empty', async () => {
      await service.onModuleInit();

      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS system_configs'),
      );
      expect(storage['min_order_amount']).toBe('500');
      expect(storage['cutoff_hour']).toBe('12');
      expect(storage['delivery_working_days']).toBe('[0,1,3,4,5,6]');
      expect(storage['delivery_exceptional_days']).toBe('[]');
      expect(storage['delivery_holidays']).toContain('Thanksgiving Day');
      expect(storage['store_general_discount']).toBe(
        '{"reason":"","percentage":0,"valid_until":"","is_active":false}',
      );

      const cached = service.getCachedDeliverySchedule();
      expect(cached).not.toBeNull();
      expect(cached?.workingDays).toEqual([0, 1, 3, 4, 5, 6]);
      expect(cached?.cutoffHour).toBe(12);
    });

    it('should not overwrite existing configs if already present', async () => {
      storage['delivery_working_days'] = '[1,2,3,4,5]';
      await service.onModuleInit();
      expect(storage['delivery_working_days']).toBe('[1,2,3,4,5]');
    });
  });

  describe('getDeliverySchedule', () => {
    it('should return safely parsed schedule and update cache', async () => {
      storage['delivery_working_days'] = '[0,3,4,5,6]';
      storage['delivery_holidays'] = JSON.stringify([
        { date: '2026-11-26', name: 'Thanksgiving' },
      ]);
      storage['delivery_exceptional_days'] = JSON.stringify([
        { date: '2026-10-27', name: 'Special Bake' },
      ]);
      storage['cutoff_hour'] = '14';

      const schedule = await service.getDeliverySchedule();

      expect(schedule.workingDays).toEqual([0, 3, 4, 5, 6]);
      expect(schedule.holidays).toEqual([{ date: '2026-11-26', name: 'Thanksgiving' }]);
      expect(schedule.exceptionalDays).toEqual([{ date: '2026-10-27', name: 'Special Bake' }]);
      expect(schedule.cutoffHour).toBe(14);
      expect(service.getCachedDeliverySchedule()).toEqual(schedule);
    });

    it('should handle corrupt or invalid JSON gracefully with default fallbacks', async () => {
      storage['delivery_working_days'] = 'corrupt-json';
      storage['delivery_holidays'] = 'invalid-json';
      storage['delivery_exceptional_days'] = 'not-json';
      storage['cutoff_hour'] = 'not-a-number';

      const schedule = await service.getDeliverySchedule();

      expect(schedule.workingDays).toEqual([0, 1, 3, 4, 5, 6]);
      expect(schedule.holidays).toEqual([]);
      expect(schedule.exceptionalDays).toEqual([]);
      expect(schedule.cutoffHour).toBe(12);
    });
  });

  describe('updateDeliverySchedule', () => {
    it('Happy path: should update workingDays, holidays, exceptionalDays successfully', async () => {
      const updated = await service.updateDeliverySchedule({
        workingDays: [1, 2, 3, 4, 5],
        holidays: [{ date: '2026-12-25', name: 'Christmas' }],
        exceptionalDays: [{ date: '2026-11-24', name: 'Pre-Thanksgiving Tuesday' }],
      });

      expect(updated.workingDays).toEqual([1, 2, 3, 4, 5]);
      expect(updated.holidays).toEqual([{ date: '2026-12-25', name: 'Christmas' }]);
      expect(updated.exceptionalDays).toEqual([
        { date: '2026-11-24', name: 'Pre-Thanksgiving Tuesday' },
      ]);
      expect(storage['delivery_working_days']).toBe('[1,2,3,4,5]');
      expect(service.getCachedDeliverySchedule()?.workingDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('Sad path (§6): should throw BadRequestException if workingDays is not an array', async () => {
      await expect(
        service.updateDeliverySchedule({ workingDays: 'invalid' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if workingDays contains out-of-range day', async () => {
      await expect(
        service.updateDeliverySchedule({ workingDays: [0, 1, 7] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateDeliverySchedule({ workingDays: [-1, 2] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if holidays contains invalid date format', async () => {
      await expect(
        service.updateDeliverySchedule({
          holidays: [{ date: '11-26-2026', name: 'Thanksgiving' }],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateDeliverySchedule({
          holidays: [{ date: '2026-11-26', name: '   ' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if exceptionalDays is invalid', async () => {
      await expect(
        service.updateDeliverySchedule({
          exceptionalDays: [{ date: 'bad-date', name: 'Extra' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('TASK-82-04: getStoreDiscount', () => {
    it('Happy path: should return default empty discount configuration when key is not set', async () => {
      const discount = await service.getStoreDiscount();
      expect(discount).toEqual({
        reason: '',
        percentage: 0,
        valid_until: '',
        is_active: false,
      });
    });

    it('Happy path: should return parsed discount configuration when key is set', async () => {
      storage['store_general_discount'] = JSON.stringify({
        reason: 'Promo Aniversario',
        percentage: 15,
        valid_until: '2026-12-31T23:59:59.000Z',
        is_active: true,
      });

      const discount = await service.getStoreDiscount();
      expect(discount).toEqual({
        reason: 'Promo Aniversario',
        percentage: 15,
        valid_until: '2026-12-31T23:59:59.000Z',
        is_active: true,
      });
    });

    it('Sad path (§6): should return safe default if stored JSON is corrupt', async () => {
      storage['store_general_discount'] = 'corrupt-json-value';
      const discount = await service.getStoreDiscount();
      expect(discount).toEqual({
        reason: '',
        percentage: 0,
        valid_until: '',
        is_active: false,
      });
    });
  });

  describe('TASK-82-04: updateStoreDiscount', () => {
    it('Happy path: should update store general discount successfully', async () => {
      const payload = {
        reason: 'Descuento Black Friday',
        percentage: 20,
        valid_until: '2026-11-30T23:59:59.000Z',
        is_active: true,
      };

      const result = await service.updateStoreDiscount(payload);

      expect(result).toEqual({
        reason: 'Descuento Black Friday',
        percentage: 20,
        valid_until: '2026-11-30T23:59:59.000Z',
        is_active: true,
      });
      expect(JSON.parse(storage['store_general_discount'])).toEqual(result);
    });

    it('Sad path (§6): should throw BadRequestException if percentage < 0', async () => {
      await expect(
        service.updateStoreDiscount({
          reason: 'Test',
          percentage: -5,
          valid_until: '2026-12-31',
          is_active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if percentage > 100', async () => {
      await expect(
        service.updateStoreDiscount({
          reason: 'Test',
          percentage: 105,
          valid_until: '2026-12-31',
          is_active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if is_active is not boolean', async () => {
      await expect(
        service.updateStoreDiscount({
          reason: 'Test',
          percentage: 10,
          valid_until: '2026-12-31',
          is_active: 'true' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if valid_until is invalid date', async () => {
      await expect(
        service.updateStoreDiscount({
          reason: 'Test',
          percentage: 10,
          valid_until: 'not-a-valid-date',
          is_active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad path (§6): should throw BadRequestException if valid_until is empty when is_active is true', async () => {
      await expect(
        service.updateStoreDiscount({
          reason: 'Test',
          percentage: 10,
          valid_until: '',
          is_active: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
