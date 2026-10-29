/**
 * Pure frontend fee calculator in strict parity with backend FeeCalculatorService (§1, §4, §6)
 * - STRIPE_CARD: 3.5% (round(amount * 0.035, 2))
 * - ACH / ACH_DEBIT: 0.8% capped at $5.00 (min(round(amount * 0.008, 2), 5.00))
 * - ZELLE, CREDIT, CHECK, CASH: $0.00 (0%)
 */

export function calculateProcessingFee(amount: number, method: string): number {
  const numericAmount = Math.max(0, Number(amount) || 0);
  if (!numericAmount || isNaN(numericAmount)) return 0.00;

  const normalized = (method || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (
    normalized === 'STRIPE_CARD' ||
    normalized === 'CARD' ||
    normalized === 'STRIPE' ||
    normalized === 'CREDIT_CARD' ||
    normalized === 'DEBIT_CARD'
  ) {
    return Math.round(numericAmount * 0.035 * 100) / 100;
  }

  if (
    normalized === 'ACH' ||
    normalized === 'ACH_DEBIT' ||
    normalized === 'US_BANK_ACCOUNT' ||
    normalized === 'BANK_ACCOUNT'
  ) {
    const calculated = Math.round(numericAmount * 0.008 * 100) / 100;
    return Math.min(calculated, 5.00);
  }

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

  return 0.00;
}

export function getFeeLabel(method: string, locale: string = 'es'): string {
  const normalized = (method || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (
    normalized === 'STRIPE_CARD' ||
    normalized === 'CARD' ||
    normalized === 'STRIPE' ||
    normalized === 'CREDIT_CARD' ||
    normalized === 'DEBIT_CARD'
  ) {
    return locale === 'en' ? 'Processing Fee (Card 3.5%)' : 'Processing Fee (Tarjeta 3.5%)';
  }
  if (
    normalized === 'ACH' ||
    normalized === 'ACH_DEBIT' ||
    normalized === 'US_BANK_ACCOUNT'
  ) {
    return locale === 'en' ? 'Processing Fee (ACH 0.8%, max $5.00)' : 'Processing Fee (ACH 0.8%, máx $5.00)';
  }
  return locale === 'en' ? 'Processing Fee' : 'Processing Fee';
}
