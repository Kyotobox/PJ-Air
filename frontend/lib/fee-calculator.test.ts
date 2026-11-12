import { describe, it, expect } from 'vitest';
import { calculateProcessingFee, getFeeLabel } from './fee-calculator';

describe('FeeCalculator (Frontend) - Sprint S80', () => {
  describe('Happy Paths', () => {
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

  describe('Sad Paths (§6)', () => {
    it('returns 0.00 for negative, zero or NaN amounts', () => {
      expect(calculateProcessingFee(0, 'ach')).toBe(0.00);
      expect(calculateProcessingFee(-100, 'card')).toBe(0.00);
      expect(calculateProcessingFee(-50, 'ach')).toBe(0.00);
      expect(calculateProcessingFee(NaN, 'stripe')).toBe(0.00);
    });

    it('returns 0.00 for empty, null, undefined or unknown methods', () => {
      expect(calculateProcessingFee(100, '')).toBe(0.00);
      expect(calculateProcessingFee(100, null as any)).toBe(0.00);
      expect(calculateProcessingFee(100, undefined as any)).toBe(0.00);
      expect(calculateProcessingFee(100, 'crypto_bitcoin')).toBe(0.00);
    });
  });
});
