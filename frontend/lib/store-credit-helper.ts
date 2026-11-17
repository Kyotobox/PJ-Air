/**
 * store-credit-helper.ts
 * Motor de utilidades, validaciones y lógica de cálculo para Saldo a Favor (Store Credit SC).
 * Soporta formateo determinista SC-YYYY-XXXX, cálculo de montos compensatorios,
 * acumulación atómica de balance y auditoría de incidencias (§1, §4, §6).
 */

export interface StoreCreditIncident {
  id: string;
  order_id: string;
  user_id?: string;
  product_id: number;
  quantity: number;
  reason_category: string;
  description?: string | null;
  photo_url?: string | null;
  amount: number;
  voucher_code: string;
  status: 'pending_review' | 'approved' | 'rejected' | string;
  reviewed_by?: string | null;
  created_at: string;
  updated_at?: string;
  product_name?: string;
}

export interface StoreCreditBalanceStatus {
  label: string;
  status: 'positive' | 'zero' | 'negative';
  color: 'emerald' | 'slate' | 'rose' | 'amber';
  hasCredit: boolean;
  formatted: string;
}

export interface CompensationCalculationInput {
  quantity: number;
  unitPrice: number;
  maxQuantity?: number;
}

export interface StoreCreditIssuanceInput {
  orderId: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  maxQuantity?: number;
  reasonCategory: string;
  maxOrderTotal?: number;
  alreadyCreditedAmount?: number;
  description?: string;
  photoUrl?: string;
}

export interface StoreCreditValidationResult {
  isValid: boolean;
  error?: string;
  amount?: number;
}

/**
 * Formatea un número correlativo al formato canónico SC-YYYY-XXXX (ej. SC-2026-0001).
 * Si el correlativo supera 9999, preserva todos los dígitos sin truncamiento.
 */
export function formatVoucherCode(sequenceNumber: number, year: number = new Date().getFullYear()): string {
  if (typeof sequenceNumber !== 'number' || isNaN(sequenceNumber) || !Number.isFinite(sequenceNumber)) {
    throw new Error('El número correlativo de voucher debe ser un número finito válido');
  }
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error('El número correlativo de voucher debe ser un entero positivo mayor a cero');
  }
  if (typeof year !== 'number' || isNaN(year) || year < 2000 || year > 2100) {
    throw new Error('El año del voucher debe ser un año gregoriano válido (2000-2100)');
  }

  const padded = String(sequenceNumber).padStart(4, '0');
  return `SC-${year}-${padded}`;
}

/**
 * Parsea y descompone un código de voucher en año y correlativo.
 * Retorna null si la cadena no cumple la especificación formal SC-YYYY-XXXX.
 */
export function parseVoucherCode(code: string | null | undefined): { year: number; sequence: number } | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim().toUpperCase();
  const match = trimmed.match(/^SC-(\d{4})-(\d{4,})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const sequence = parseInt(match[2], 10);

  if (isNaN(year) || isNaN(sequence) || year < 2000 || year > 2100 || sequence <= 0) {
    return null;
  }

  return { year, sequence };
}

/**
 * Valida si un código cumple con la sintaxis canónica de Store Credit.
 */
export function isValidVoucherCode(code: string | null | undefined): boolean {
  return parseVoucherCode(code) !== null;
}

/**
 * Normaliza y sanea un voucher code a mayúsculas y sin espacios.
 */
export function normalizeVoucherCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Calcula el monto compensatorio redondeado a 2 decimales con determinismo financiero.
 */
export function calculateCompensationAmount(quantity: number, unitPrice: number): number {
  if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
    throw new Error('La cantidad compensatoria debe ser un número positivo mayor a cero');
  }
  if (typeof unitPrice !== 'number' || isNaN(unitPrice) || unitPrice < 0) {
    throw new Error('El precio unitario no puede ser negativo ni inválido');
  }

  const raw = quantity * unitPrice;
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el límite máximo permitido para emitir saldo a favor en una orden,
 * evitando compensaciones que superen el valor original del pedido.
 */
export function calculateMaxAllowedCompensation(orderTotal: number, alreadyCreditedAmount: number = 0): number {
  const safeTotal = typeof orderTotal === 'number' && !isNaN(orderTotal) ? Math.max(0, orderTotal) : 0;
  const safeCredited = typeof alreadyCreditedAmount === 'number' && !isNaN(alreadyCreditedAmount)
    ? Math.max(0, alreadyCreditedAmount)
    : 0;

  const diff = safeTotal - safeCredited;
  return Math.max(0, Math.round((diff + Number.EPSILON) * 100) / 100);
}

/**
 * Valida los parámetros numéricos de compensación sin lanzar excepciones.
 */
export function validateCompensationInput(input: CompensationCalculationInput): StoreCreditValidationResult {
  if (!input) {
    return { isValid: false, error: 'Datos de compensación requeridos' };
  }

  const { quantity, unitPrice, maxQuantity } = input;

  if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
    return { isValid: false, error: 'La cantidad debe ser mayor a 0' };
  }

  if (!Number.isInteger(quantity)) {
    return { isValid: false, error: 'La cantidad debe ser un número entero' };
  }

  if (maxQuantity !== undefined && maxQuantity !== null) {
    if (typeof maxQuantity !== 'number' || isNaN(maxQuantity) || maxQuantity <= 0) {
      return { isValid: false, error: 'La cantidad máxima permitida es inválida' };
    }
    if (quantity > maxQuantity) {
      return {
        isValid: false,
        error: `La cantidad solicitada (${quantity}) no puede exceder las unidades ordenadas (${maxQuantity})`,
      };
    }
  }

  if (typeof unitPrice !== 'number' || isNaN(unitPrice) || unitPrice < 0) {
    return { isValid: false, error: 'El precio unitario no puede ser negativo ni inválido' };
  }

  const amount = Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100;
  return { isValid: true, amount };
}

/**
 * Aserción estricta de compensación que arroja excepción ante datos inválidos (§6).
 */
export function assertValidCompensationInput(input: CompensationCalculationInput): number {
  const result = validateCompensationInput(input);
  if (!result.isValid) {
    throw new Error(result.error || 'Parámetros de compensación inválidos');
  }
  return result.amount ?? 0;
}

/**
 * Valida integralmente una solicitud de emisión administrativa de Store Credit.
 */
export function validateStoreCreditIssuance(input: StoreCreditIssuanceInput): StoreCreditValidationResult {
  if (!input) {
    return { isValid: false, error: 'Datos de emisión de crédito requeridos' };
  }

  if (!input.orderId || typeof input.orderId !== 'string' || input.orderId.trim() === '') {
    return { isValid: false, error: 'El ID de la orden es mandatorio' };
  }

  if (typeof input.productId !== 'number' || isNaN(input.productId) || input.productId <= 0) {
    return { isValid: false, error: 'ID de producto inválido' };
  }

  const compVal = validateCompensationInput({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    maxQuantity: input.maxQuantity,
  });

  if (!compVal.isValid) {
    return compVal;
  }

  const amount = compVal.amount!;

  if (input.maxOrderTotal !== undefined && input.maxOrderTotal !== null) {
    const maxAllowed = calculateMaxAllowedCompensation(input.maxOrderTotal, input.alreadyCreditedAmount ?? 0);
    if (amount > maxAllowed) {
      return {
        isValid: false,
        error: `El monto compensatorio ($${amount.toFixed(2)}) supera el saldo compensable máximo ($${maxAllowed.toFixed(2)})`,
      };
    }
  }

  if (!input.reasonCategory || typeof input.reasonCategory !== 'string' || input.reasonCategory.trim() === '') {
    return { isValid: false, error: 'Debe especificar el motivo de la incidencia' };
  }

  return { isValid: true, amount };
}

/**
 * Aserción estricta de emisión administrativa con excepción mandatoria (§6).
 */
export function assertValidStoreCreditIssuance(input: StoreCreditIssuanceInput): number {
  const result = validateStoreCreditIssuance(input);
  if (!result.isValid) {
    throw new Error(result.error || 'Validación de emisión de saldo a favor fallida');
  }
  return result.amount!;
}

/**
 * Aplica una operación atómica al saldo de un usuario (acreditación o débito).
 * Garantiza que el saldo nunca quede en valores decimales inconsistentes.
 */
export function calculateNewBalance(
  currentBalance: number | null | undefined,
  delta: number,
  operation: 'credit' | 'debit',
): number {
  const base = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : 0;
  if (typeof delta !== 'number' || isNaN(delta) || delta < 0) {
    throw new Error('El valor delta debe ser un número no negativo');
  }

  let finalBalance: number;
  if (operation === 'credit') {
    finalBalance = base + delta;
  } else if (operation === 'debit') {
    finalBalance = Math.max(0, base - delta);
  } else {
    throw new Error(`Operación de balance desconocida: ${(operation as string)}`);
  }

  return Math.round((finalBalance + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un balance numérico al formato de moneda determinista `$XX.XX`.
 */
export function formatStoreCreditBalance(amount: number | null | undefined, currencySymbol: string = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currencySymbol}0.00`;
  }
  return `${currencySymbol}${Number(amount).toFixed(2)}`;
}

/**
 * Diagnóstico semántico del balance de crédito de un cliente.
 */
export function getBalanceStatus(balance: number | null | undefined): StoreCreditBalanceStatus {
  const val = typeof balance === 'number' && !isNaN(balance) ? balance : 0;
  const formatted = formatStoreCreditBalance(val);

  if (val > 0) {
    return {
      label: 'Disponible',
      status: 'positive',
      color: 'emerald',
      hasCredit: true,
      formatted,
    };
  }

  if (val < 0) {
    return {
      label: 'Sobregiro',
      status: 'negative',
      color: 'rose',
      hasCredit: false,
      formatted,
    };
  }

  return {
    label: 'Sin Saldo',
    status: 'zero',
    color: 'slate',
    hasCredit: false,
    formatted,
  };
}

/**
 * Determina si una incidencia está aprobada.
 */
export function isIncidentApproved(incident: Partial<StoreCreditIncident> | null | undefined): boolean {
  if (!incident) return false;
  return incident.status === 'approved';
}

/**
 * Agrupa y suma el total compensado de un listado de incidencias aprobadas.
 */
export function sumApprovedStoreCredits(incidents: Array<Partial<StoreCreditIncident>> | null | undefined): number {
  if (!incidents || !Array.isArray(incidents)) return 0;
  const total = incidents.reduce((acc, inc) => {
    if (inc && inc.status === 'approved') {
      const amt = Number(inc.amount) || 0;
      return acc + amt;
    }
    return acc;
  }, 0);

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export interface CheckoutPaymentSummaryInput {
  subtotal: number;
  deliveryFee?: number;
  processingFee?: number;
  salesTax?: number;
  storeCreditBalance: number;
  applyStoreCredit: boolean;
}

export interface CheckoutPaymentSummaryResult {
  grossTotal: number;
  storeCreditApplied: number;
  finalTotal: number;
  remainingCreditBalance: number;
  isPaidWithStoreCredit: boolean;
}

/**
 * Calcula el desglose y descuento de Store Credit en el resumen de pago de checkout.
 * Garantiza determinismo financiero, redondeo a 2 decimales y previene sobregiros (§4, §6).
 */
export function calculateCheckoutStoreCreditDiscount(
  input: CheckoutPaymentSummaryInput,
): CheckoutPaymentSummaryResult {
  if (!input) {
    throw new Error('Parámetros de resumen de pago requeridos');
  }

  if (typeof input.subtotal !== 'number' || isNaN(input.subtotal) || input.subtotal < 0) {
    throw new Error('El subtotal debe ser un número no negativo');
  }

  const deliveryFee = typeof input.deliveryFee === 'number' && !isNaN(input.deliveryFee) ? Math.max(0, input.deliveryFee) : 0;
  const processingFee = typeof input.processingFee === 'number' && !isNaN(input.processingFee) ? Math.max(0, input.processingFee) : 0;
  const salesTax = typeof input.salesTax === 'number' && !isNaN(input.salesTax) ? Math.max(0, input.salesTax) : 0;

  const grossTotal = Math.round((input.subtotal + deliveryFee + processingFee + salesTax + Number.EPSILON) * 100) / 100;

  const rawCredit = typeof input.storeCreditBalance === 'number' && !isNaN(input.storeCreditBalance)
    ? Math.max(0, input.storeCreditBalance)
    : 0;
  const safeCredit = Math.round((rawCredit + Number.EPSILON) * 100) / 100;

  const storeCreditApplied = input.applyStoreCredit && safeCredit > 0
    ? Math.min(safeCredit, grossTotal)
    : 0;

  const roundedApplied = Math.round((storeCreditApplied + Number.EPSILON) * 100) / 100;
  const finalTotal = Math.max(0, Math.round((grossTotal - roundedApplied + Number.EPSILON) * 100) / 100);
  const remainingCreditBalance = Math.max(0, Math.round((safeCredit - roundedApplied + Number.EPSILON) * 100) / 100);
  const isPaidWithStoreCredit = roundedApplied > 0 && finalTotal === 0;

  return {
    grossTotal,
    storeCreditApplied: roundedApplied,
    finalTotal,
    remainingCreditBalance,
    isPaidWithStoreCredit,
  };
}
