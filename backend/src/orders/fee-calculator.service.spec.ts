import { BadRequestException } from '@nestjs/common';
import { FeeCalculatorService } from './fee-calculator.service';

describe('FeeCalculatorService', () => {
  let service: FeeCalculatorService;

  beforeEach(() => {
    service = new FeeCalculatorService();
  });

  describe('calculateFee - Happy Paths', () => {
    it('should calculate 3.5% fee for card/stripe payments', () => {
      const res = service.calculateFee(100, 'card');
      expect(res.baseAmount).toBe(100);
      expect(res.paymentMethod).toBe('card');
      expect(res.feePercentage).toBe(3.5);
      expect(res.feeAmount).toBe(3.50);
      expect(res.totalWithFee).toBe(103.50);
      expect(res.isCapped).toBe(false);
    });

    it('should calculate 3.5% fee for stripe payment method alias', () => {
      const res = service.calculateFee(250.50, 'stripe');
      expect(res.feeAmount).toBe(8.77);
      expect(res.totalWithFee).toBe(259.27);
    });

    it('should calculate 0.8% fee for ACH when below $5 cap', () => {
      const res = service.calculateFee(200, 'ach');
      expect(res.baseAmount).toBe(200);
      expect(res.feePercentage).toBe(0.8);
      expect(res.feeAmount).toBe(1.60);
      expect(res.totalWithFee).toBe(201.60);
      expect(res.isCapped).toBe(false);
    });

    it('should cap ACH fee at exactly $5.00 when raw fee exceeds 5.00', () => {
      const res = service.calculateFee(1000, 'ach'); // 1000 * 0.008 = $8.00 > $5.00 cap
      expect(res.baseAmount).toBe(1000);
      expect(res.feePercentage).toBe(0.8);
      expect(res.feeAmount).toBe(5.00);
      expect(res.totalWithFee).toBe(1005.00);
      expect(res.isCapped).toBe(true);
    });

    it('should charge 0.0% fee for Zelle', () => {
      const res = service.calculateFee(500, 'zelle');
      expect(res.feePercentage).toBe(0.0);
      expect(res.feeAmount).toBe(0.0);
      expect(res.totalWithFee).toBe(500.0);
    });

    it('should charge 0.0% fee for Cheque / Check', () => {
      const res = service.calculateFee(750, 'check');
      expect(res.feeAmount).toBe(0.0);
      expect(res.totalWithFee).toBe(750.0);
    });

    it('should charge 0.0% fee for Credit / Credito', () => {
      const res = service.calculateFee(300, 'credit');
      expect(res.feeAmount).toBe(0.0);
      expect(res.totalWithFee).toBe(300.0);
    });

    it('should calculate batch fees for multiple orders correctly', () => {
      const res = service.calculateBatchFee([100, 200, 300], 'card');
      expect(res.baseAmount).toBe(600);
      expect(res.feeAmount).toBe(21.00); // 600 * 0.035
      expect(res.totalWithFee).toBe(621.00);
    });
  });

  describe('calculateFee - Sad Paths (§6)', () => {
    it('should throw BadRequestException for negative amount', () => {
      expect(() => service.calculateFee(-10, 'card')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for NaN or invalid amount', () => {
      expect(() => service.calculateFee(NaN, 'card')).toThrow(BadRequestException);
      expect(() => service.calculateFee(null as any, 'card')).toThrow(BadRequestException);
      expect(() => service.calculateFee(undefined as any, 'card')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid or empty payment method', () => {
      expect(() => service.calculateFee(100, '')).toThrow(BadRequestException);
      expect(() => service.calculateFee(100, 'crypto_bitcoin')).toThrow(BadRequestException);
      expect(() => service.calculateFee(100, null as any)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException in batch calculation when amounts array is empty or has negative numbers', () => {
      expect(() => service.calculateBatchFee([], 'card')).toThrow(BadRequestException);
      expect(() => service.calculateBatchFee([100, -50], 'card')).toThrow(BadRequestException);
    });
  });
});
