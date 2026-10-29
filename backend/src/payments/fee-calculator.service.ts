import { Injectable } from '@nestjs/common';

export enum FeePaymentMethod {
  STRIPE_CARD = 'STRIPE_CARD',
  ACH = 'ACH',
  ACH_DEBIT = 'ACH_DEBIT',
  ZELLE = 'ZELLE',
  CREDIT = 'CREDIT',
  CHECK = 'CHECK',
  CASH = 'CASH',
}

export interface FeeBreakdown {
  fee: number;
  rate: number;
  isCapped: boolean;
  maxCap: number | null;
  originalAmount: number;
  totalWithFee: number;
  normalizedMethod: string;
}

@Injectable()
export class FeeCalculatorService {
  /**
   * Deterministic calculation of processing fees according to payment method:
   * - STRIPE_CARD: 3.5% (round(amount * 0.035, 2))
   * - ACH / ACH_DEBIT: 0.8% with a maximum cap of $5.00 (min(round(amount * 0.008, 2), 5.00))
   * - ZELLE, CREDIT, CHECK, CASH: $0.00 (0%)
   *
   * @param amount Base monetary amount in USD
   * @param paymentMethod Payment method string/identifier
   * @returns Calculated fee rounded to 2 decimal places
   */
  static calculateFee(amount: number, paymentMethod: string): number {
    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return 0.00;
    }

    if (!paymentMethod || typeof paymentMethod !== 'string') {
      return 0.00;
    }

    const normalized = paymentMethod.trim().toUpperCase().replace(/[\s-]+/g, '_');

    // 1. Stripe Card / Credit / Debit Card: 3.5%
    if (
      normalized === 'STRIPE_CARD' ||
      normalized === 'CARD' ||
      normalized === 'STRIPE' ||
      normalized === 'CREDIT_CARD' ||
      normalized === 'DEBIT_CARD'
    ) {
      return Math.round(numericAmount * 0.035 * 100) / 100;
    }

    // 2. ACH / ACH Direct Debit: 0.8% capped at $5.00
    if (
      normalized === 'ACH' ||
      normalized === 'ACH_DEBIT' ||
      normalized === 'US_BANK_ACCOUNT' ||
      normalized === 'BANK_ACCOUNT'
    ) {
      const calculated = Math.round(numericAmount * 0.008 * 100) / 100;
      return Math.min(calculated, 5.00);
    }

    // 3. Exempt Methods: Zelle, B2B Credit, Checks, Cash (0%)
    if (
      normalized === 'ZELLE' ||
      normalized === 'CREDIT' ||
      normalized === 'CHECK' ||
      normalized === 'CHEQUE' ||
      normalized === 'CASH' ||
      normalized === 'EFECTIVO'
    ) {
      return 0.00;
    }

    // Default unknown methods to 0.00
    return 0.00;
  }

  /**
   * Instance method proxying static calculateFee for NestJS DI compatibility
   */
  calculateFee(amount: number, paymentMethod: string): number {
    return FeeCalculatorService.calculateFee(amount, paymentMethod);
  }

  /**
   * Detailed breakdown of fee rate, application, and caps for audit & UI receipts
   */
  static getFeeBreakdown(amount: number, paymentMethod: string): FeeBreakdown {
    const numericAmount = Math.max(0, Number(amount) || 0);
    const fee = this.calculateFee(numericAmount, paymentMethod);
    const normalized = (paymentMethod || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

    let rate = 0;
    let isCapped = false;
    let maxCap: number | null = null;

    if (
      normalized === 'STRIPE_CARD' ||
      normalized === 'CARD' ||
      normalized === 'STRIPE' ||
      normalized === 'CREDIT_CARD' ||
      normalized === 'DEBIT_CARD'
    ) {
      rate = 0.035;
    } else if (
      normalized === 'ACH' ||
      normalized === 'ACH_DEBIT' ||
      normalized === 'US_BANK_ACCOUNT' ||
      normalized === 'BANK_ACCOUNT'
    ) {
      rate = 0.008;
      maxCap = 5.00;
      const uncapped = Math.round(numericAmount * 0.008 * 100) / 100;
      if (uncapped >= 5.00) {
        isCapped = true;
      }
    }

    return {
      fee,
      rate,
      isCapped,
      maxCap,
      originalAmount: numericAmount,
      totalWithFee: Math.round((numericAmount + fee) * 100) / 100,
      normalizedMethod: normalized,
    };
  }

  getFeeBreakdown(amount: number, paymentMethod: string): FeeBreakdown {
    return FeeCalculatorService.getFeeBreakdown(amount, paymentMethod);
  }
}
