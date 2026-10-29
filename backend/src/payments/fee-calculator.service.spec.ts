import { Test, TestingModule } from '@nestjs/testing';
import { FeeCalculatorService, FeePaymentMethod } from './fee-calculator.service';

describe('FeeCalculatorService', () => {
  let service: FeeCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeeCalculatorService],
    }).compile();

    service = module.get<FeeCalculatorService>(FeeCalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Happy Path: Stripe Card Processing Fee (3.5%)', () => {
    it('should calculate 3.5% fee accurately for STRIPE_CARD', () => {
      // $100.00 * 0.035 = $3.50
      expect(service.calculateFee(100, FeePaymentMethod.STRIPE_CARD)).toBe(3.50);
      expect(FeeCalculatorService.calculateFee(100, 'STRIPE_CARD')).toBe(3.50);
    });

    it('should calculate 3.5% fee on irregular amounts with 2 decimal rounding', () => {
      // $50.25 * 0.035 = 1.75875 -> 1.76
      expect(service.calculateFee(50.25, 'STRIPE_CARD')).toBe(1.76);
      // $245.50 * 0.035 = 8.5925 -> 8.59
      expect(service.calculateFee(245.50, 'STRIPE_CARD')).toBe(8.59);
    });

    it('should handle case insensitivity and aliases (card, stripe, credit_card)', () => {
      expect(service.calculateFee(200, 'card')).toBe(7.00);
      expect(service.calculateFee(200, 'stripe')).toBe(7.00);
      expect(service.calculateFee(200, 'STRIPE')).toBe(7.00);
      expect(service.calculateFee(200, 'credit_card')).toBe(7.00);
      expect(service.calculateFee(200, 'debit-card')).toBe(7.00);
    });
  });

  describe('Happy Path: ACH Direct Debit Processing Fee (0.8%)', () => {
    it('should calculate 0.8% fee for low and medium amounts below $5.00 cap', () => {
      // $100.00 * 0.008 = $0.80
      expect(service.calculateFee(100, FeePaymentMethod.ACH)).toBe(0.80);
      // $250.00 * 0.008 = $2.00
      expect(service.calculateFee(250, 'ACH')).toBe(2.00);
      // $500.00 * 0.008 = $4.00
      expect(service.calculateFee(500, 'ACH_DEBIT')).toBe(4.00);
      // $600.00 * 0.008 = $4.80
      expect(service.calculateFee(600, 'us_bank_account')).toBe(4.80);
    });
  });

  describe('Sad Path & Boundary (§6): ACH High Amount Capped at $5.00 exact', () => {
    it('should hit the cap of $5.00 exactly at $625.00', () => {
      // $625.00 * 0.008 = $5.00
      expect(service.calculateFee(625, 'ACH')).toBe(5.00);
    });

    it('should cap ACH fee at exactly $5.00 for amounts exceeding $625.00', () => {
      // $1,000.00 * 0.008 = $8.00 -> Capped at $5.00
      expect(service.calculateFee(1000, 'ACH')).toBe(5.00);
      // $2,500.00 * 0.008 = $20.00 -> Capped at $5.00
      expect(service.calculateFee(2500, 'ACH_DEBIT')).toBe(5.00);
      // $10,000.00 * 0.008 = $80.00 -> Capped at $5.00
      expect(service.calculateFee(10000, 'us_bank_account')).toBe(5.00);
    });

    it('should reflect isCapped flag in getFeeBreakdown for high ACH amounts', () => {
      const breakdown = service.getFeeBreakdown(2500, 'ACH');
      expect(breakdown.fee).toBe(5.00);
      expect(breakdown.isCapped).toBe(true);
      expect(breakdown.maxCap).toBe(5.00);
      expect(breakdown.totalWithFee).toBe(2505.00);

      const uncappedBreakdown = service.getFeeBreakdown(200, 'ACH');
      expect(uncappedBreakdown.fee).toBe(1.60);
      expect(uncappedBreakdown.isCapped).toBe(false);
      expect(uncappedBreakdown.totalWithFee).toBe(201.60);
    });
  });

  describe('Sad Path & Boundary (§6): Exempt Methods Return $0.00', () => {
    it('should return $0.00 for ZELLE regardless of amount', () => {
      expect(service.calculateFee(500, FeePaymentMethod.ZELLE)).toBe(0.00);
      expect(service.calculateFee(5000, 'zelle')).toBe(0.00);
      expect(service.calculateFee(1250.75, 'Zelle')).toBe(0.00);
    });

    it('should return $0.00 for B2B Commercial CREDIT', () => {
      expect(service.calculateFee(1500, FeePaymentMethod.CREDIT)).toBe(0.00);
      expect(service.calculateFee(750, 'credit')).toBe(0.00);
    });

    it('should return $0.00 for CHECK payments', () => {
      expect(service.calculateFee(3000, FeePaymentMethod.CHECK)).toBe(0.00);
      expect(service.calculateFee(1000, 'check')).toBe(0.00);
      expect(service.calculateFee(1000, 'cheque')).toBe(0.00);
    });

    it('should return $0.00 for CASH payments', () => {
      expect(service.calculateFee(250, FeePaymentMethod.CASH)).toBe(0.00);
      expect(service.calculateFee(500, 'cash')).toBe(0.00);
      expect(service.calculateFee(500, 'efectivo')).toBe(0.00);
    });
  });

  describe('Sad Path & Boundary (§6): Irregular Inputs & Resilience', () => {
    it('should return $0.00 when amount is 0 or negative', () => {
      expect(service.calculateFee(0, 'STRIPE_CARD')).toBe(0.00);
      expect(service.calculateFee(-100, 'STRIPE_CARD')).toBe(0.00);
      expect(service.calculateFee(-50, 'ACH')).toBe(0.00);
    });

    it('should return $0.00 when amount is NaN or null/undefined', () => {
      expect(service.calculateFee(NaN, 'STRIPE_CARD')).toBe(0.00);
      expect(service.calculateFee(null as any, 'STRIPE_CARD')).toBe(0.00);
      expect(service.calculateFee(undefined as any, 'STRIPE_CARD')).toBe(0.00);
    });

    it('should return $0.00 for unknown, empty, or invalid payment methods', () => {
      expect(service.calculateFee(100, '')).toBe(0.00);
      expect(service.calculateFee(100, null as any)).toBe(0.00);
      expect(service.calculateFee(100, undefined as any)).toBe(0.00);
      expect(service.calculateFee(100, 'crypto_bitcoin')).toBe(0.00);
      expect(service.calculateFee(100, 'barter')).toBe(0.00);
    });
  });
});
