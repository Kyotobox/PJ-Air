/**
 * B2B Account Statement & Wholesale Check Payment Helpers (§1, §4, §6)
 * Pure domain logic for S60B
 */

export interface StatementOrder {
  id: string;
  created_at: string;
  delivery_date?: string;
  total: number;
  refunded_amount?: number;
  payment_status: string;
  payment_method?: string;
}

export interface StatementSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  ordersCount: number;
}

export function filterOrdersByDateRange(
  orders: StatementOrder[],
  range: 'current_month' | 'last_30_days' | 'all',
  referenceDate: Date = new Date()
): StatementOrder[] {
  if (!Array.isArray(orders)) return [];

  return orders.filter((order) => {
    if (!order) return false;

    let effectiveDate: Date | null = null;

    if (order.delivery_date && typeof order.delivery_date === 'string') {
      let dStr = order.delivery_date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        dStr = `${dStr}T12:00:00`;
      }
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        effectiveDate = d;
      }
    }

    if (!effectiveDate && order.created_at && typeof order.created_at === 'string') {
      let cStr = order.created_at.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cStr)) {
        cStr = `${cStr}T12:00:00`;
      }
      const d = new Date(cStr);
      if (!isNaN(d.getTime())) {
        effectiveDate = d;
      }
    }

    if (!effectiveDate) return false;

    if (range === 'current_month') {
      return (
        effectiveDate.getFullYear() === referenceDate.getFullYear() &&
        effectiveDate.getMonth() === referenceDate.getMonth()
      );
    }

    if (range === 'last_30_days') {
      const thirtyDaysAgo = new Date(referenceDate);
      thirtyDaysAgo.setDate(referenceDate.getDate() - 30);
      return effectiveDate >= thirtyDaysAgo && effectiveDate <= referenceDate;
    }

    return true;
  });
}

export function calculateStatementSummary(orders: StatementOrder[]): StatementSummary {
  if (!Array.isArray(orders) || orders.length === 0) {
    return {
      totalInvoiced: 0,
      totalPaid: 0,
      totalPending: 0,
      ordersCount: 0,
    };
  }

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalPending = 0;

  for (const o of orders) {
    const rawTotal = Number(o.total) || 0;
    const rawRefund = Number(o.refunded_amount) || 0;
    const net = Math.max(0, rawTotal - rawRefund);
    totalInvoiced += net;

    const isPaid = (o.payment_status || '').toLowerCase() === 'paid';
    if (isPaid) {
      totalPaid += net;
    } else {
      totalPending += net;
    }
  }

  return {
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalPending: Math.round(totalPending * 100) / 100,
    ordersCount: orders.length,
  };
}

export interface WholesaleRegistrationInput {
  legal_business_name: string;
  ein: string;
  business_address: string;
  company_name: string;
  tax_id: string;
  signer_name: string;
  signer_title?: string;
  signer_phone?: string;
  signer_email?: string;
  terms_consent_1: boolean;
  terms_consent_2: boolean;
  terms_consent_3: boolean;
  signature_text: string;
}

export function validateWholesaleRegistration(input: WholesaleRegistrationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.legal_business_name || !input.legal_business_name.trim()) {
    errors.push('Legal business name is required');
  }
  if (!input.ein || !input.ein.trim()) {
    errors.push('EIN is required');
  }
  if (!input.business_address || !input.business_address.trim()) {
    errors.push('Business address is required');
  }
  if (!input.company_name || !input.company_name.trim()) {
    errors.push('Company name is required');
  }
  if (!input.tax_id || !input.tax_id.trim()) {
    errors.push('Tax ID is required');
  }
  if (!input.signer_name || !input.signer_name.trim()) {
    errors.push('Signer name is required');
  }
  if (!input.terms_consent_1) {
    errors.push('Commercial terms consent checkbox 1 is mandatory');
  }
  if (!input.terms_consent_2) {
    errors.push('Card-on-file Stripe authorization checkbox 2 is mandatory');
  }
  if (!input.terms_consent_3) {
    errors.push('Electronic signature acceptance checkbox 3 is mandatory');
  }
  if (!input.signature_text || input.signature_text.trim().length < 3) {
    errors.push('Binding electronic signature (full typed name) is required');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return { valid: true, errors: [] };
}

export interface CheckPaymentOrderInput {
  client_check_enabled: boolean;
  check_image_url: string | null;
  check_number: string;
  check_bank: string;
  check_amount: number;
  check_verified: boolean;
}

export function validateCheckPaymentOrder(input: CheckPaymentOrderInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.client_check_enabled) {
    errors.push('Check payment is not enabled for this client account');
  }
  if (!input.check_image_url || !input.check_image_url.trim()) {
    errors.push('Front photo of the check is required');
  }
  if (!input.check_number || !input.check_number.trim()) {
    errors.push('Check number is required');
  }
  if (!input.check_bank || !input.check_bank.trim()) {
    errors.push('Issuing bank is required');
  }
  if (!input.check_amount || input.check_amount <= 0) {
    errors.push('Check amount must be greater than zero');
  }
  if (!input.check_verified) {
    errors.push('Human verification checkbox confirming data matches document is mandatory');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return { valid: true, errors: [] };
}
