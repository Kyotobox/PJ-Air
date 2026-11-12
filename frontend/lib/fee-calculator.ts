/**
 * Pure frontend fee and discount calculator in strict parity with backend OrdersService and FeeCalculatorService (§1, §4, §6)
 * - STRIPE_CARD: $0.00 (0% - Absorbed in product catalog prices)
 * - ACH / ACH_DEBIT: 0.8% capped at $5.00 (min(round(amount * 0.008, 2), 5.00))
 * - ZELLE, CREDIT, CHECK, CASH: $0.00 (0%)
 * - General Store Discount: Math.round(itemsTotal * (percentage / 100) * 100) / 100 (when is_active && new Date() <= new Date(valid_until))
 */

export interface StoreDiscountConfig {
  reason: string;
  percentage: number;
  valid_until: string;
  is_active: boolean;
}

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
    return 0.00;
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
    return locale === 'en' ? 'Card ($0.00 No Fee)' : 'Tarjeta ($0.00 Sin recargo)';
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

/**
 * Checks whether a store discount is active and still valid according to the current date (§1, §4, §6).
 */
export function isStoreDiscountValid(
  discount?: StoreDiscountConfig | null,
  currentDate: Date = new Date()
): boolean {
  if (!discount || typeof discount !== 'object') return false;
  if (discount.is_active !== true) return false;

  const pct = Number(discount.percentage);
  if (isNaN(pct) || pct <= 0) return false;

  if (!discount.valid_until) return false;
  const validUntilDate = new Date(discount.valid_until);
  if (isNaN(validUntilDate.getTime())) return false;

  return currentDate.getTime() <= validUntilDate.getTime();
}

/**
 * Validates store discount configuration and throws for invalid structural parameters (Sad path §6 support).
 */
export function validateStoreDiscountConfig(discount: any): boolean {
  if (!discount || typeof discount !== 'object') {
    throw new Error('Configuración de descuento general inválida o ausente');
  }
  if (discount.percentage !== undefined && discount.percentage !== null) {
    const pct = Number(discount.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new Error(`Porcentaje de descuento fuera de rango [0-100]: ${discount.percentage}`);
    }
  }
  if (discount.valid_until) {
    const d = new Date(discount.valid_until);
    if (isNaN(d.getTime())) {
      throw new Error(`Fecha de vigencia inválida para descuento general: ${discount.valid_until}`);
    }
  }
  return true;
}

/**
 * Calculates store general discount amount on raw items total in strict parity with backend OrdersService (§1, §4, §6).
 * Formula: Math.round(itemsTotal * (percentage / 100) * 100) / 100
 */
export function calculateStoreDiscount(
  itemsTotal: number,
  discount?: StoreDiscountConfig | null,
  currentDate: Date = new Date()
): number {
  const numericTotal = Math.max(0, Number(itemsTotal) || 0);
  if (!numericTotal || isNaN(numericTotal)) return 0.00;

  if (!isStoreDiscountValid(discount, currentDate)) {
    return 0.00;
  }

  const percentage = Math.min(100, Math.max(0, Number(discount!.percentage) || 0));
  const calculated = Math.round(numericTotal * (percentage / 100) * 100) / 100;
  return Math.min(calculated, numericTotal);
}

/**
 * Calculates full order totals including store general discount, delivery fee, processing fee, sales tax and store credit.
 */
export function calculateOrderTotals(params: {
  itemsSubtotal: number;
  storeDiscount?: StoreDiscountConfig | null;
  deliveryFee?: number;
  processingFee?: number;
  salesTaxRate?: number;
  isTaxExempt?: boolean;
  storeCreditApplied?: number;
  currentDate?: Date;
}): {
  rawSubtotal: number;
  storeDiscountAmount: number;
  discountedSubtotal: number;
  deliveryFee: number;
  processingFee: number;
  salesTax: number;
  grossTotal: number;
  storeCreditDeducted: number;
  finalTotal: number;
} {
  const rawSubtotal = Math.max(0, Number(params.itemsSubtotal) || 0);
  const storeDiscountAmount = calculateStoreDiscount(rawSubtotal, params.storeDiscount, params.currentDate);
  const discountedSubtotal = Math.max(0, Math.round((rawSubtotal - storeDiscountAmount + Number.EPSILON) * 100) / 100);

  const deliveryFee = Math.max(0, Number(params.deliveryFee) || 0);
  const processingFee = Math.max(0, Number(params.processingFee) || 0);

  const isExempt = Boolean(params.isTaxExempt);
  const taxRate = isExempt ? 0 : Math.max(0, Number(params.salesTaxRate ?? 8.875) || 0);
  const salesTax = isExempt
    ? 0.00
    : Math.round((discountedSubtotal * (taxRate / 100) + Number.EPSILON) * 100) / 100;

  const grossTotal = Math.round((discountedSubtotal + deliveryFee + processingFee + salesTax + Number.EPSILON) * 100) / 100;

  const maxCredit = Math.max(0, Number(params.storeCreditApplied) || 0);
  const storeCreditDeducted = Math.min(maxCredit, grossTotal);

  const finalTotal = Math.max(0, Math.round((grossTotal - storeCreditDeducted + Number.EPSILON) * 100) / 100);

  return {
    rawSubtotal,
    storeDiscountAmount,
    discountedSubtotal,
    deliveryFee,
    processingFee,
    salesTax,
    grossTotal,
    storeCreditDeducted,
    finalTotal,
  };
}
