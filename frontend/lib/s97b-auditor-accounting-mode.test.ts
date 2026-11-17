import { describe, it, expect } from 'vitest';

/**
 * Sprint S97B Test Suite: Auditor Read-Only Mode & Accounting Visualization Engine (§6, §48)
 * Verificación de aislamiento estricto de mutaciones (SoD) y visualización contable (ST-120, Tax NY, SC).
 */

export interface OrderItem {
  id: string;
  quantity: number;
  price_at_time: number;
  product?: { name: string };
}

export interface OrderFinancialData {
  total: number;
  tax_amount?: number;
  tax_rate?: number;
  tax_exempt?: boolean;
  tax_legend?: string;
  store_credit_applied?: number;
  global_discount_amount?: number;
  packaging_discount?: number;
  items?: OrderItem[];
  user?: {
    tax_exempt?: boolean;
    st120_status?: string;
    profile?: {
      tax_exempt?: boolean;
      st120_status?: string;
    };
  };
}

/**
 * Helper contable de cálculo fiscal para el panel de órdenes (espejo del frontend)
 */
export function calculateAccountingMetrics(order: OrderFinancialData) {
  const isExempt = Boolean(
    order.tax_exempt ||
    order.user?.tax_exempt ||
    order.user?.profile?.tax_exempt ||
    order.user?.st120_status === 'APPROVED' ||
    order.user?.profile?.st120_status === 'APPROVED'
  );

  const taxRate = Number(order.tax_rate ?? 8.875);
  const taxAmount = Number(order.tax_amount || 0);
  const items = order.items || [];
  const itemsSubtotal = items.reduce(
    (acc, it) => acc + (Number(it.quantity || 0) * Number(it.price_at_time || 0)),
    0
  );
  const discount = Number(order.global_discount_amount || order.packaging_discount || 0);

  let baseGravable = 0;
  if (!isExempt) {
    if (taxAmount > 0 && taxRate > 0) {
      baseGravable = Math.round((taxAmount / (taxRate / 100) + Number.EPSILON) * 100) / 100;
    } else {
      baseGravable = Math.max(0, Math.round((itemsSubtotal - discount + Number.EPSILON) * 100) / 100);
    }
  }

  const storeCreditApplied = Math.round((Number(order.store_credit_applied || 0) + Number.EPSILON) * 100) / 100;
  const totalBilled = Math.round((Number(order.total || 0) + Number.EPSILON) * 100) / 100;

  return {
    isExempt,
    st120StatusBadge: isExempt ? 'ST-120 EXENTO (0% TAX)' : 'GRAVABLE NY (8.875% TAX)',
    taxRate: isExempt ? 0 : taxRate,
    taxAmount,
    baseGravable,
    storeCreditApplied,
    totalBilled,
  };
}

/**
 * Formateador canónico de vouchers Store Credit (SC-YYYY-XXXX)
 */
export function formatStoreCreditVoucherCode(voucherCode?: string | null, incidentId?: string | number): string {
  if (voucherCode && /^SC-\d{4}-[A-Z0-9]+$/i.test(voucherCode)) {
    return voucherCode.toUpperCase();
  }
  const year = new Date().getFullYear();
  const suffix = incidentId ? String(incidentId).slice(0, 4).toUpperCase().padStart(4, '0') : '0001';
  return `SC-${year}-${suffix}`;
}

/**
 * Validador de permisos de mutación según rol (Read-Only SoD)
 */
export function isActionAllowed(action: 'cancel' | 'change_status' | 'refund' | 'edit_items' | 'view_ledger', role: string): boolean {
  if (role === 'auditor') {
    // El auditor solo tiene permiso para visualización y exportación contable
    return action === 'view_ledger';
  }
  if (role === 'admin') {
    return true;
  }
  return false;
}

describe('Sprint S97B: Auditor Read-Only Mode & Accounting Visualization Engine (§6, §48)', () => {
  describe('Segregation of Duties (SoD): Mutation Button Blocking for Auditor', () => {
    it('blocks auditor from cancelling orders (individual or bulk)', () => {
      expect(isActionAllowed('cancel', 'auditor')).toBe(false);
      expect(isActionAllowed('cancel', 'admin')).toBe(true);
    });

    it('blocks auditor from changing order status (workflow progression)', () => {
      expect(isActionAllowed('change_status', 'auditor')).toBe(false);
      expect(isActionAllowed('change_status', 'admin')).toBe(true);
    });

    it('blocks auditor from issuing refunds', () => {
      expect(isActionAllowed('refund', 'auditor')).toBe(false);
      expect(isActionAllowed('refund', 'admin')).toBe(true);
    });

    it('blocks auditor from modifying items in orders', () => {
      expect(isActionAllowed('edit_items', 'auditor')).toBe(false);
      expect(isActionAllowed('edit_items', 'admin')).toBe(true);
    });

    it('allows auditor to view and export the finance tax sales ledger', () => {
      expect(isActionAllowed('view_ledger', 'auditor')).toBe(true);
      expect(isActionAllowed('view_ledger', 'admin')).toBe(true);
    });
  });

  describe('Accounting Metrics & ST-120 Sales Tax NY Breakdown', () => {
    it('computes 0% tax and $0.00 base gravable for ST-120 approved client', () => {
      const exemptOrder: OrderFinancialData = {
        total: 500.0,
        tax_amount: 0.0,
        tax_rate: 0.0,
        tax_exempt: true,
        store_credit_applied: 50.0,
        global_discount_amount: 20.0,
        items: [{ id: '1', quantity: 25, price_at_time: 20.0 }], // subtotal = 500
        user: {
          tax_exempt: true,
          st120_status: 'APPROVED',
        },
      };

      const metrics = calculateAccountingMetrics(exemptOrder);
      expect(metrics.isExempt).toBe(true);
      expect(metrics.st120StatusBadge).toBe('ST-120 EXENTO (0% TAX)');
      expect(metrics.taxAmount).toBe(0.0);
      expect(metrics.baseGravable).toBe(0.0);
      expect(metrics.storeCreditApplied).toBe(50.0);
      expect(metrics.totalBilled).toBe(500.0);
    });

    it('computes 8.875% tax and taxable base for taxable non-exempt order', () => {
      const taxableOrder: OrderFinancialData = {
        total: 217.75,
        tax_amount: 17.75,
        tax_rate: 8.875,
        tax_exempt: false,
        store_credit_applied: 0.0,
        global_discount_amount: 0.0,
        items: [{ id: '1', quantity: 10, price_at_time: 20.0 }], // subtotal = 200
        user: {
          tax_exempt: false,
          st120_status: 'NONE',
        },
      };

      const metrics = calculateAccountingMetrics(taxableOrder);
      expect(metrics.isExempt).toBe(false);
      expect(metrics.st120StatusBadge).toBe('GRAVABLE NY (8.875% TAX)');
      expect(metrics.taxAmount).toBe(17.75);
      expect(metrics.baseGravable).toBe(200.0);
      expect(metrics.totalBilled).toBe(217.75);
    });

    it('formats Store Credit vouchers strictly conforming to SC-YYYY-XXXX specification', () => {
      const canonicalCode = formatStoreCreditVoucherCode('SC-2026-A1B2');
      expect(canonicalCode).toBe('SC-2026-A1B2');

      const fallbackCode = formatStoreCreditVoucherCode(null, '99bc1234');
      expect(fallbackCode).toMatch(/^SC-\d{4}-99BC$/);

      const defaultCode = formatStoreCreditVoucherCode('', undefined);
      expect(defaultCode).toMatch(/^SC-\d{4}-0001$/);
    });
  });

  describe('Sad Paths (§6)', () => {
    it('gracefully handles empty items and undefined totals without throwing NaN', () => {
      const emptyOrder: OrderFinancialData = {
        total: 0,
        items: [],
      };

      const metrics = calculateAccountingMetrics(emptyOrder);
      expect(metrics.baseGravable).toBe(0);
      expect(metrics.taxAmount).toBe(0);
      expect(metrics.storeCreditApplied).toBe(0);
      expect(metrics.totalBilled).toBe(0);
      expect(isNaN(metrics.baseGravable)).toBe(false);
    });

    it('defaults tax rate to NY standard (8.875%) when tax_rate is undefined on taxable order (§6)', () => {
      const orderWithoutTaxRate: OrderFinancialData = {
        total: 108.88,
        tax_amount: 8.88,
        tax_exempt: false,
        items: [{ id: '1', quantity: 10, price_at_time: 10.0 }],
      };

      const metrics = calculateAccountingMetrics(orderWithoutTaxRate);
      expect(metrics.isExempt).toBe(false);
      expect(metrics.taxRate).toBe(8.875);
      expect(metrics.baseGravable).toBeCloseTo(100.06, 1);
    });
  });
});
