import { describe, it, expect } from 'vitest';
import {
  calculateCheckoutStoreCreditDiscount,
  CheckoutPaymentSummaryInput,
  formatVoucherCode,
  parseVoucherCode,
  calculateNewBalance,
  formatStoreCreditBalance,
  getBalanceStatus,
} from './store-credit-helper';

/**
 * Sprint S96 End-to-End Test Suite (§6, §48)
 * Verificación Integral del Cálculo de Descuento de Store Credit (Saldo a Favor SC)
 * en el Resumen de Pago y Checkout B2B.
 */
describe('Sprint S96: Store Credit Checkout & Payment Summary Engine (TASK-96-05) (§4, §6)', () => {
  describe('Happy Paths: Store Credit Payment Summary Calculations', () => {
    it('applies partial store credit deduction when balance is less than gross total', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 120.0,
        deliveryFee: 15.0,
        processingFee: 3.5,
        salesTax: 10.65,
        storeCreditBalance: 50.0,
        applyStoreCredit: true,
      };

      // grossTotal = 120 + 15 + 3.5 + 10.65 = 149.15
      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(149.15);
      expect(result.storeCreditApplied).toBe(50.0);
      expect(result.finalTotal).toBe(99.15); // 149.15 - 50.00 = 99.15
      expect(result.remainingCreditBalance).toBe(0.0);
      expect(result.isPaidWithStoreCredit).toBe(false);
    });

    it('covers 100% of order when store credit balance exceeds gross total', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 60.0,
        deliveryFee: 0.0, // Free delivery
        processingFee: 0.0,
        salesTax: 0.0, // ST-120 Tax Exempt
        storeCreditBalance: 100.0,
        applyStoreCredit: true,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(60.0);
      expect(result.storeCreditApplied).toBe(60.0);
      expect(result.finalTotal).toBe(0.0);
      expect(result.remainingCreditBalance).toBe(40.0); // 100 - 60 = 40 remaining
      expect(result.isPaidWithStoreCredit).toBe(true);
    });

    it('handles exact match between store credit balance and gross total', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 45.5,
        deliveryFee: 0.0,
        salesTax: 0.0,
        storeCreditBalance: 45.5,
        applyStoreCredit: true,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(45.5);
      expect(result.storeCreditApplied).toBe(45.5);
      expect(result.finalTotal).toBe(0.0);
      expect(result.remainingCreditBalance).toBe(0.0);
      expect(result.isPaidWithStoreCredit).toBe(true);
    });

    it('does not apply discount when applyStoreCredit toggle is false', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 80.0,
        deliveryFee: 15.0,
        storeCreditBalance: 50.0,
        applyStoreCredit: false,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(95.0);
      expect(result.storeCreditApplied).toBe(0.0);
      expect(result.finalTotal).toBe(95.0);
      expect(result.remainingCreditBalance).toBe(50.0); // Preserved
      expect(result.isPaidWithStoreCredit).toBe(false);
    });

    it('handles client with zero store credit balance smoothly', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 100.0,
        deliveryFee: 10.0,
        storeCreditBalance: 0.0,
        applyStoreCredit: true,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(110.0);
      expect(result.storeCreditApplied).toBe(0.0);
      expect(result.finalTotal).toBe(110.0);
      expect(result.remainingCreditBalance).toBe(0.0);
      expect(result.isPaidWithStoreCredit).toBe(false);
    });

    it('avoids floating point rounding artifacts on decimal cents ($19.99 - $19.99 = $0.00)', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 19.99,
        storeCreditBalance: 19.99,
        applyStoreCredit: true,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(19.99);
      expect(result.storeCreditApplied).toBe(19.99);
      expect(result.finalTotal).toBe(0.0);
      expect(result.remainingCreditBalance).toBe(0.0);
      expect(result.isPaidWithStoreCredit).toBe(true);
    });

    it('defaults optional fees to $0.00 when omitted', () => {
      const input: CheckoutPaymentSummaryInput = {
        subtotal: 75.25,
        storeCreditBalance: 25.25,
        applyStoreCredit: true,
      };

      const result = calculateCheckoutStoreCreditDiscount(input);

      expect(result.grossTotal).toBe(75.25);
      expect(result.storeCreditApplied).toBe(25.25);
      expect(result.finalTotal).toBe(50.0);
      expect(result.remainingCreditBalance).toBe(0.0);
    });
  });

  describe('End-to-End Flow: Voucher Generation -> Balance Increment -> Checkout Deduction', () => {
    it('simulates end-to-end flow from SC voucher issuance to checkout payment summary deduction', () => {
      // 1. SC Voucher code issued for incident compensation
      const voucherCode = formatVoucherCode(42, 2026);
      expect(voucherCode).toBe('SC-2026-0042');
      const parsed = parseVoucherCode(voucherCode);
      expect(parsed).toEqual({ year: 2026, sequence: 42 });

      // 2. Incident approved: compensate $35.00 to user's initial $0.00 balance
      const initialBalance = 0.0;
      const compensatedAmount = 35.0;
      const updatedBalance = calculateNewBalance(initialBalance, compensatedAmount, 'credit');
      expect(updatedBalance).toBe(35.0);

      // Verify UI badge formatting
      const badge = getBalanceStatus(updatedBalance);
      expect(badge.hasCredit).toBe(true);
      expect(badge.formatted).toBe('$35.00');
      expect(badge.label).toBe('Disponible');

      // 3. User checks out new order with subtotal $90.00 and $10.00 delivery fee
      const checkoutResult = calculateCheckoutStoreCreditDiscount({
        subtotal: 90.0,
        deliveryFee: 10.0,
        storeCreditBalance: updatedBalance,
        applyStoreCredit: true,
      });

      expect(checkoutResult.grossTotal).toBe(100.0);
      expect(checkoutResult.storeCreditApplied).toBe(35.0);
      expect(checkoutResult.finalTotal).toBe(65.0); // $100.00 - $35.00 = $65.00
      expect(checkoutResult.remainingCreditBalance).toBe(0.0);

      // 4. Update user balance post-checkout
      const finalUserBalance = calculateNewBalance(
        updatedBalance,
        checkoutResult.storeCreditApplied,
        'debit',
      );
      expect(finalUserBalance).toBe(0.0);
      expect(formatStoreCreditBalance(finalUserBalance)).toBe('$0.00');
    });
  });

  describe('Sad Paths (§6) & Boundary Error Handling', () => {
    it('Sad Path 1: throws Error when input object is null or undefined', () => {
      expect(() => calculateCheckoutStoreCreditDiscount(null as any)).toThrow(
        /Parámetros de resumen de pago requeridos/i,
      );
      expect(() => calculateCheckoutStoreCreditDiscount(undefined as any)).toThrow(
        /Parámetros de resumen de pago requeridos/i,
      );
    });

    it('Sad Path 2: throws Error when subtotal is negative', () => {
      expect(() =>
        calculateCheckoutStoreCreditDiscount({
          subtotal: -25.0,
          storeCreditBalance: 10.0,
          applyStoreCredit: true,
        }),
      ).toThrow(/El subtotal debe ser un número no negativo/i);
    });

    it('Sad Path 3: throws Error when subtotal is NaN or non-numeric', () => {
      expect(() =>
        calculateCheckoutStoreCreditDiscount({
          subtotal: NaN,
          storeCreditBalance: 10.0,
          applyStoreCredit: true,
        }),
      ).toThrow(/El subtotal debe ser un número no negativo/i);

      expect(() =>
        calculateCheckoutStoreCreditDiscount({
          subtotal: 'invalid' as any,
          storeCreditBalance: 10.0,
          applyStoreCredit: true,
        }),
      ).toThrow(/El subtotal debe ser un número no negativo/i);
    });

    it('Sad Path 4: treats negative store credit balance defensively as $0.00 without negative deduction', () => {
      const result = calculateCheckoutStoreCreditDiscount({
        subtotal: 50.0,
        storeCreditBalance: -20.0, // Corrupted or negative value in DB
        applyStoreCredit: true,
      });

      expect(result.grossTotal).toBe(50.0);
      expect(result.storeCreditApplied).toBe(0.0);
      expect(result.finalTotal).toBe(50.0);
      expect(result.remainingCreditBalance).toBe(0.0);
    });

    it('Sad Path 5: treats negative fees defensively as $0.00', () => {
      const result = calculateCheckoutStoreCreditDiscount({
        subtotal: 50.0,
        deliveryFee: -15.0,
        processingFee: -5.0,
        salesTax: -2.0,
        storeCreditBalance: 20.0,
        applyStoreCredit: true,
      });

      expect(result.grossTotal).toBe(50.0);
      expect(result.storeCreditApplied).toBe(20.0);
      expect(result.finalTotal).toBe(30.0);
    });
  });
});
