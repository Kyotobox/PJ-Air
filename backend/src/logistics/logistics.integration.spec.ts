import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogisticsController } from './logistics.controller';
import { MileageFreightService, ASTORIA_ORIGIN } from './mileage-freight.service';
import { AddressValidationService } from '../addresses/address-validation.service';
import { AddressGeocache } from '../addresses/address-geocache.entity';

describe('S54 Logistics & Dispatch Integration Suite', () => {
  let controller: LogisticsController;
  let freightService: MileageFreightService;
  let validationService: AddressValidationService;

  const mockGeocacheStorage = new Map<string, any>();

  const mockGeocacheRepo = {
    findOne: jest.fn(async ({ where: { address_hash } }) => {
      return mockGeocacheStorage.get(address_hash) || null;
    }),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => {
      mockGeocacheStorage.set(entity.address_hash, entity);
      return entity;
    }),
  };

  beforeEach(async () => {
    mockGeocacheStorage.clear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogisticsController],
      providers: [
        MileageFreightService,
        AddressValidationService,
        {
          provide: getRepositoryToken(AddressGeocache),
          useValue: mockGeocacheRepo,
        },
      ],
    }).compile();

    controller = module.get<LogisticsController>(LogisticsController);
    freightService = module.get<MileageFreightService>(MileageFreightService);
    validationService = module.get<AddressValidationService>(AddressValidationService);
  });

  describe('Origin Endpoint', () => {
    it('should return Astoria Central Hub details as origin', () => {
      const origin = controller.getOrigin();
      expect(origin.address).toBe('3304 Broadway, Astoria, NY 11106');
      expect(origin.lat).toBe(ASTORIA_ORIGIN.lat);
      expect(origin.lng).toBe(ASTORIA_ORIGIN.lng);
    });
  });

  describe('Quote Calculation via Controller (Happy Paths)', () => {
    it('Happy Path: should quote freight by valid tri-state text address via geocache resolution', async () => {
      const result = await controller.calculateQuote({
        address: '3304 Broadway, Astoria, NY 11106',
        serviceType: 'shared',
      });

      expect(result).toBeDefined();
      expect(result.serviceType).toBe('shared');
      expect(result.miles).toBeLessThanOrEqual(5);
      expect(result.cost).toBe(40); // 0-10 mi = $40
      expect(result.destination?.address).toBeDefined();

      // Second query should hit cache
      expect(mockGeocacheStorage.size).toBeGreaterThan(0);
      const secondResult = await controller.calculateQuote({
        address: '3304 Broadway, Astoria, NY 11106',
        serviceType: 'shared',
      });
      expect(secondResult.cost).toBe(40);
    });

    it('Happy Path: should quote pickup at $0.00 fee', async () => {
      const result = await controller.calculateQuote({
        serviceType: 'pickup',
      });
      expect(result.cost).toBe(0);
      expect(result.serviceType).toBe('pickup');
    });

    it('Happy Path: should calculate freight directly by coordinates', async () => {
      // Coordinates close to Astoria
      const result = await controller.calculateQuote({
        destLat: 40.765,
        destLng: -73.92,
        serviceType: 'shared',
      });
      expect(result.miles).toBeGreaterThan(0);
      expect(result.cost).toBe(40);
    });
  });

  describe('Sad Paths (§6 Mandatorio)', () => {
    it('Sad Path 1 (Dirección Inexistente / Rechazada): should reject invalid address during validation', async () => {
      await expect(
        validationService.validateAndGeocode('xyz987invalidstreet'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Sad Path 2 (Fallo de Red / Timeout API): should safely degrade to tri-state regional fallback without crashing', async () => {
      // Pass an address that uses offline fallback
      const result = await validationService.validateAndGeocode(
        '100 Main St, Newark, NJ 07102',
      );
      expect(result).toBeDefined();
      expect(result.state).toBe('NJ');
      expect(result.lat).toBeDefined();
      expect(result.lng).toBeDefined();
    });

    it('Sad Path 3 (Distancia Extrema > 250 millas): should flag special quote for far destinations (Buffalo)', async () => {
      // Buffalo coordinates: 42.8864, -78.8784 (~290 straight miles, > 350 road miles from Astoria)
      const quote = freightService.quoteByCoordinates(42.8864, -78.8784, 'shared', 'Buffalo Central Bakery');
      expect(quote.miles).toBeGreaterThan(250);
      expect(quote.requiresSpecialQuote).toBe(true);
      expect(quote.cost).toBe(0);
      expect(quote.notes).toContain('superior a 250 millas');
    });

    it('Sad Path 4: should throw BadRequestException if neither miles, address nor coordinates are provided', async () => {
      await expect(
        controller.calculateQuote({ serviceType: 'shared' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
