import { BadRequestException } from '@nestjs/common';
import { MileageFreightService, ASTORIA_ORIGIN } from './mileage-freight.service';

describe('MileageFreightService', () => {
  let service: MileageFreightService;

  beforeEach(() => {
    service = new MileageFreightService();
  });

  describe('Origin Coordinates Integrity', () => {
    it('should be configured with 3304 Broadway, Astoria, NY 11106', () => {
      expect(service.origin.address).toBe('3304 Broadway, Astoria, NY 11106');
      expect(service.origin.lat).toBe(40.761032);
      expect(service.origin.lng).toBe(-73.923714);
      expect(service.origin.zip).toBe('11106');
    });
  });

  describe('calculateFreight - Happy Paths', () => {
    it('should charge $0.00 for pickup in store (Astoria)', () => {
      const quote = service.calculateFreight(5, 'pickup');
      expect(quote.cost).toBe(0);
      expect(quote.serviceType).toBe('pickup');
      expect(quote.requiresSpecialQuote).toBe(false);
    });

    it('should calculate Ruta Compartida matrix brackets accurately', () => {
      // 0-10 mi: $40
      expect(service.calculateFreight(0, 'shared').cost).toBe(40);
      expect(service.calculateFreight(5.5, 'shared').cost).toBe(40);
      expect(service.calculateFreight(10, 'shared').cost).toBe(40);

      // 11-20 mi: $60
      expect(service.calculateFreight(10.1, 'shared').cost).toBe(60);
      expect(service.calculateFreight(20, 'shared').cost).toBe(60);

      // 21-30 mi: $80
      expect(service.calculateFreight(20.5, 'shared').cost).toBe(80);
      expect(service.calculateFreight(30, 'shared').cost).toBe(80);

      // 31-40 mi: $100
      expect(service.calculateFreight(35, 'shared').cost).toBe(100);
      expect(service.calculateFreight(40, 'shared').cost).toBe(100);

      // 41-50 mi: $125
      expect(service.calculateFreight(45, 'shared').cost).toBe(125);
      expect(service.calculateFreight(50, 'shared').cost).toBe(125);

      // 51-60 mi: $150 (+25)
      expect(service.calculateFreight(55, 'shared').cost).toBe(150);

      // 61-70 mi: $175 (+25)
      expect(service.calculateFreight(68, 'shared').cost).toBe(175);

      // 100 mi: $125 + 5 * 25 = $250
      expect(service.calculateFreight(100, 'shared').cost).toBe(250);

      // 250 mi: boundary test
      expect(service.calculateFreight(250, 'shared').cost).toBe(125 + 20 * 25); // 625
      expect(service.calculateFreight(250, 'shared').requiresSpecialQuote).toBe(false);
    });

    it('should calculate Salida Exclusiva matrix brackets accurately', () => {
      // 0-10 mi: $200
      expect(service.calculateFreight(8, 'exclusive').cost).toBe(200);

      // 11-20 mi: $225
      expect(service.calculateFreight(15, 'exclusive').cost).toBe(225);

      // 21-30 mi: $250
      expect(service.calculateFreight(28, 'exclusive').cost).toBe(250);

      // 31-40 mi: $275
      expect(service.calculateFreight(32, 'exclusive').cost).toBe(275);

      // 41-50 mi: $300
      expect(service.calculateFreight(49, 'exclusive').cost).toBe(300);

      // 51-60 mi: $325
      expect(service.calculateFreight(52, 'exclusive').cost).toBe(325);
    });

    it('should flag distances > 250 miles as requiring special quote', () => {
      const quote = service.calculateFreight(250.1, 'shared');
      expect(quote.requiresSpecialQuote).toBe(true);
      expect(quote.cost).toBe(0);

      const quoteExclusive = service.calculateFreight(350, 'exclusive');
      expect(quoteExclusive.requiresSpecialQuote).toBe(true);
      expect(quoteExclusive.cost).toBe(0);
    });

    it('should calculate distance from coordinates and quote properly', () => {
      // Midtown Manhattan (Empire State: 40.748817, -73.985428)
      const quote = service.quoteByCoordinates(40.748817, -73.985428, 'shared', 'Empire State Building');
      expect(quote.miles).toBeGreaterThan(0);
      expect(quote.miles).toBeLessThan(15);
      expect(quote.cost).toBeGreaterThanOrEqual(40);
      expect(quote.destination?.address).toBe('Empire State Building');
    });
  });

  describe('calculateFreight & distance - Sad Paths (§6)', () => {
    it('should throw BadRequestException for negative miles', () => {
      expect(() => service.calculateFreight(-5, 'shared')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for NaN or invalid miles', () => {
      expect(() => service.calculateFreight(NaN, 'shared')).toThrow(BadRequestException);
      expect(() => service.calculateFreight(null as any, 'shared')).toThrow(BadRequestException);
      expect(() => service.calculateFreight(undefined as any, 'shared')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unknown service type', () => {
      expect(() => service.calculateFreight(15, 'hyperloop' as any)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid latitude coordinates', () => {
      expect(() => service.calculateDistanceMiles(95, -73.92)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(-95, -73.92)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(NaN, -73.92)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(null as any, -73.92)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid longitude coordinates', () => {
      expect(() => service.calculateDistanceMiles(40.76, 190)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(40.76, -190)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(40.76, NaN)).toThrow(BadRequestException);
      expect(() => service.calculateDistanceMiles(40.76, undefined as any)).toThrow(BadRequestException);
    });
  });
});
