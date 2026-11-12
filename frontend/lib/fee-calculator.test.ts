import { describe, it, expect } from 'vitest';
import {
  calculateProcessingFee,
  getFeeLabel,
  calculateStoreDiscount,
  isStoreDiscountValid,
  validateStoreDiscountConfig,
  calculateOrderTotals,
  StoreDiscountConfig,
} from './fee-calculator';

describe('FeeCalculator & Store Discount (Frontend) - Sprint S82C', () => {
  describe('Happy Paths: Processing Fee (Sprint S80)', () => {
    it('returns $0.00 for card/stripe methods (absorbed into catalog prices)', () => {
      expect(calculateProcessingFee(100, 'stripe')).toBe(0.00);
      expect(calculateProcessingFee(100, 'card')).toBe(0.00);
      expect(calculateProcessingFee(250.75, 'STRIPE_CARD')).toBe(0.00);
      expect(calculateProcessingFee(500, 'credit_card')).toBe(0.00);
      expect(calculateProcessingFee(500, 'debit-card')).toBe(0.00);
    });

    it('returns 0.8% for ACH capped at $5.00', () => {
      expect(calculateProcessingFee(100, 'ach')).toBe(0.80);
      expect(calculateProcessingFee(250, 'ACH')).toBe(2.00);
      expect(calculateProcessingFee(625, 'ACH_DEBIT')).toBe(5.00);
      expect(calculateProcessingFee(1000, 'ach')).toBe(5.00);
    });

    it('returns $0.00 for direct methods (zelle, credit, check, cash)', () => {
      expect(calculateProcessingFee(500, 'zelle')).toBe(0.00);
      expect(calculateProcessingFee(500, 'credit')).toBe(0.00);
      expect(calculateProcessingFee(500, 'check')).toBe(0.00);
      expect(calculateProcessingFee(500, 'cash')).toBe(0.00);
    });

    it('generates accurate labels for card and ACH', () => {
      expect(getFeeLabel('card', 'es')).toContain('Sin recargo');
      expect(getFeeLabel('stripe', 'en')).toContain('No Fee');
      expect(getFeeLabel('ach', 'es')).toContain('0.8%');
    });
  });

  describe('Happy Paths: Store General Discount (TASK-82-08, TASK-82-09)', () => {
    const activeDiscount: StoreDiscountConfig = {
      reason: 'Black Friday Wholesale',
      percentage: 10,
      valid_until: '2026-11-30T23:59:59.000Z',
      is_active: true,
    };

    it('validates active discount when current date is before valid_until', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      expect(isStoreDiscountValid(activeDiscount, now)).toBe(true);
    });

    it('calculates 10% discount on $200.00 correctly ($20.00)', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      expect(calculateStoreDiscount(200, activeDiscount, now)).toBe(20.00);
    });

    it('calculates rounded discount for odd subtotals (e.g. 15% on $155.50 -> $23.33)', () => {
      const discount15: StoreDiscountConfig = {
        reason: 'Holiday Promo',
        percentage: 15,
        valid_until: '2026-12-31T23:59:59.000Z',
        is_active: true,
      };
      const now = new Date('2026-11-20T12:00:00.000Z');
      expect(calculateStoreDiscount(155.50, discount15, now)).toBe(23.33);
    });

    it('validates discount on exact expiration millisecond boundary', () => {
      const exactDate = new Date('2026-11-30T23:59:59.000Z');
      expect(isStoreDiscountValid(activeDiscount, exactDate)).toBe(true);
      expect(calculateStoreDiscount(100, activeDiscount, exactDate)).toBe(10.00);
    });

    it('calculates full order totals including store discount and taxes', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      const order = calculateOrderTotals({
        itemsSubtotal: 200,
        storeDiscount: activeDiscount,
        deliveryFee: 15,
        processingFee: 0,
        salesTaxRate: 8.875,
        isTaxExempt: false,
        storeCreditApplied: 50,
        currentDate: now,
      });

      expect(order.rawSubtotal).toBe(200);
      expect(order.storeDiscountAmount).toBe(20.00);
      expect(order.discountedSubtotal).toBe(180.00);
      expect(order.deliveryFee).toBe(15.00);
      // Tax: 180 * 0.08875 = 15.975 -> 15.98
      expect(order.salesTax).toBe(15.98);
      // Gross: 180 + 15 + 15.98 = 210.98
      expect(order.grossTotal).toBe(210.98);
      expect(order.storeCreditDeducted).toBe(50.00);
      // Final: 210.98 - 50 = 160.98
      expect(order.finalTotal).toBe(160.98);
    });

    it('calculates full order totals with 0% tax exemption under Form ST-120', () => {
      const now = new Date('2026-11-20T12:00:00.000Z');
      const order = calculateOrderTotals({
        itemsSubtotal: 100,
        storeDiscount: activeDiscount,
        deliveryFee: 10,
        processingFee: 0,
        isTaxExempt: true,
        currentDate: now,
      });

      expect(order.rawSubtotal).toBe(100);
      expect(order.storeDiscountAmount).toBe(10.00);
      expect(order.discountedSubtotal).toBe(90.00);
      expect(order.salesTax).toBe(0.00);
      expect(order.finalTotal).toBe(100.00);
    });
  });

  describe('Sad Paths (§6) - Mandatorio con Throws & Boundary Rejections', () => {
    it('returns 0.00 for negative, zero or NaN amounts in processing fee', () => {
      expect(calculateProcessingFee(0, 'ach')).toBe(0.00);
      expect(calculateProcessingFee(-100, 'card')).toBe(0.00);
      expect(calculateProcessingFee(-50, 'ach')).toBe(0.00);
      expect(calculateProcessingFee(NaN, 'stripe')).toBe(0.00);
    });

    it('returns 0.00 for empty, null, undefined or unknown payment methods', () => {
      expect(calculateProcessingFee(100, '')).toBe(0.00);
      expect(calculateProcessingFee(100, null as any)).toBe(0.00);
      expect(calculateProcessingFee(100, undefined as any)).toBe(0.00);
      expect(calculateProcessingFee(100, 'crypto_bitcoin')).toBe(0.00);
    });

    it('returns 0.00 when store discount is expired (valid_until in past)', () => {
      const expiredDiscount: StoreDiscountConfig = {
        reason: 'Expired Halloween',
        percentage: 20,
        valid_until: '2026-10-31T23:59:59.000Z',
        is_active: true,
      };
      const now = new Date('2026-11-01T00:00:01.000Z');
      expect(isStoreDiscountValid(expiredDiscount, now)).toBe(false);
      expect(calculateStoreDiscount(100, expiredDiscount, now)).toBe(0.00);
    });

    it('returns 0.00 when store discount is inactive (is_active: false)', () => {
      const inactiveDiscount: StoreDiscountConfig = {
        reason: 'Disabled Promo',
        percentage: 25,
        valid_until: '2026-12-31T23:59:59.000Z',
        is_active: false,
      };
      const now = new Date('2026-11-15T00:00:00.000Z');
      expect(isStoreDiscountValid(inactiveDiscount, now)).toBe(false);
      expect(calculateStoreDiscount(100, inactiveDiscount, now)).toBe(0.00);
    });

    it('returns 0.00 for null, undefined or non-object discount configs', () => {
      expect(calculateStoreDiscount(100, null)).toBe(0.00);
      expect(calculateStoreDiscount(100, undefined)).toBe(0.00);
      expect(calculateStoreDiscount(100, 'invalid' as any)).toBe(0.00);
    });

    it('returns 0.00 for negative, zero or NaN itemsTotal in store discount', () => {
      const activeDiscount: StoreDiscountConfig = {
        reason: 'Promo',
        percentage: 10,
        valid_until: '2026-12-31T23:59:59.000Z',
        is_active: true,
      };
      expect(calculateStoreDiscount(-50, activeDiscount)).toBe(0.00);
      expect(calculateStoreDiscount(0, activeDiscount)).toBe(0.00);
      expect(calculateStoreDiscount(NaN, activeDiscount)).toBe(0.00);
    });

    it('throws Error when validateStoreDiscountConfig receives null or non-object (§6 throwsA)', () => {
      expect(() => validateStoreDiscountConfig(null)).toThrow('Configuración de descuento general inválida o ausente');
      expect(() => validateStoreDiscountConfig(undefined)).toThrow('Configuración de descuento general inválida o ausente');
      expect(() => validateStoreDiscountConfig('string_config')).toThrow('Configuración de descuento general inválida o ausente');
    });

    it('throws Error when validateStoreDiscountConfig receives out-of-range percentage (§6 throwsA)', () => {
      expect(() => validateStoreDiscountConfig({ percentage: -5 })).toThrow(/Porcentaje de descuento fuera de rango/);
      expect(() => validateStoreDiscountConfig({ percentage: 150 })).toThrow(/Porcentaje de descuento fuera de rango/);
      expect(() => validateStoreDiscountConfig({ percentage: 'not-a-number' as any })).toThrow(/Porcentaje de descuento fuera de rango/);
    });

    it('throws Error when validateStoreDiscountConfig receives an unparseable date (§6 throwsA)', () => {
      expect(() => validateStoreDiscountConfig({ percentage: 10, valid_until: 'not-a-valid-date-string' })).toThrow(/Fecha de vigencia inválida/);
    });
  });
});
