import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { AddressValidationService } from './address-validation.service';
import { AddressGeocache } from './address-geocache.entity';

describe('AddressValidationService', () => {
  let service: AddressValidationService;

  const mockGeocacheRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => entity),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressValidationService,
        {
          provide: getRepositoryToken(AddressGeocache),
          useValue: mockGeocacheRepo,
        },
      ],
    }).compile();

    service = module.get<AddressValidationService>(AddressValidationService);
    jest.clearAllMocks();
  });

  describe('Deterministic Hashing', () => {
    it('should compute consistent hash for same address regardless of casing or extra spaces', () => {
      const hash1 = service.computeHash('3304 Broadway, Astoria, NY 11106');
      const hash2 = service.computeHash('  3304   broadway,  astoria, ny, 11106.  ');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // sha256 hex
    });
  });

  describe('Validation & Geocoding - Happy Paths', () => {
    it('should return cached address immediately when available in address_geocache', async () => {
      const cachedEntry: Partial<AddressGeocache> = {
        address_hash: service.computeHash('3304 Broadway, Astoria, NY 11106'),
        raw_query: '3304 Broadway, Astoria, NY 11106',
        formatted_address: '33-04 Broadway, Astoria, NY 11106, USA',
        lat: 40.761032,
        lng: -73.923714,
        city: 'Astoria',
        state: 'NY',
        zip: '11106',
      };

      mockGeocacheRepo.findOne.mockResolvedValue(cachedEntry);

      const result = await service.validateAndGeocode('3304 Broadway, Astoria, NY 11106');
      expect(result.cached).toBe(true);
      expect(result.lat).toBe(40.761032);
      expect(result.lng).toBe(-73.923714);
      expect(result.formatted_address).toBe('33-04 Broadway, Astoria, NY 11106, USA');
      expect(mockGeocacheRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('should fallback cleanly to regional tri-state coords when offline/mock key', async () => {
      mockGeocacheRepo.findOne.mockResolvedValue(null);

      const result = await service.validateAndGeocode('500 Grand Concourse, Bronx, NY 10451');
      expect(result.lat).toBeDefined();
      expect(result.lng).toBeDefined();
      expect(result.state).toBe('NY');
      expect(result.zip).toBe('10451');
      expect(mockGeocacheRepo.save).toHaveBeenCalled();
    });

    it('should recognize New Jersey addresses with valid zip and state', async () => {
      mockGeocacheRepo.findOne.mockResolvedValue(null);

      const result = await service.validateAndGeocode('100 Newark Ave, Jersey City, NJ 07302');
      expect(result.state).toBe('NJ');
      expect(result.city).toBe('Jersey City');
      expect(result.lat).toBeCloseTo(40.7282, 1);
      expect(result.lng).toBeCloseTo(-74.0776, 1);
    });

    it('should recognize Connecticut addresses in tri-state area', async () => {
      mockGeocacheRepo.findOne.mockResolvedValue(null);

      const result = await service.validateAndGeocode('1 Atlantic St, Stamford, CT 06901');
      expect(result.state).toBe('CT');
      expect(result.city).toBe('Stamford');
    });
  });

  describe('Validation & Geocoding - Sad Paths (§6)', () => {
    it('should throw BadRequestException when address is empty or shorter than 5 characters', async () => {
      await expect(service.validateAndGeocode('')).rejects.toThrow(BadRequestException);
      await expect(service.validateAndGeocode('abc')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for blatantly invalid street names (Sad Path 1)', async () => {
      await expect(service.validateAndGeocode('xyz987invalidstreet')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.validateAndGeocode('asdfghjkl nowhere')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when address is clearly outside tri-state (e.g., California/Miami)', async () => {
      mockGeocacheRepo.findOne.mockResolvedValue(null);
      await expect(
        service.validateAndGeocode('123 Ocean Drive, Miami Beach, FL 33139'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle and catch database errors in geocache lookup without crashing', async () => {
      mockGeocacheRepo.findOne.mockRejectedValue(new Error('SQLite busy lock'));

      const result = await service.validateAndGeocode('3304 Broadway, Astoria, NY 11106');
      expect(result).toBeDefined();
      expect(result.lat).toBeDefined();
    });
  });
});
