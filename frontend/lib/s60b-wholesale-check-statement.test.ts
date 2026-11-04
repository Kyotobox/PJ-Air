import { describe, it, expect } from 'vitest';
import {
  validateWholesaleRegistration,
  validateCheckPaymentOrder,
  filterOrdersByDateRange,
  calculateStatementSummary,
  StatementOrder,
} from './b2b-statement-helper';

describe('S60B B2B Wholesale Registration & Terms (§4, §6)', () => {
  const validRegistrationPayload = {
    legal_business_name: 'Acme Hospitality LLC',
    ein: '12-3456789',
    business_address: '123 Main St, Brooklyn, NY 11201',
    company_name: 'Acme Cafe',
    tax_id: 'NY-TAX-987654',
    signer_name: 'John Doe',
    signer_title: 'Managing Director',
    signer_phone: '+1 (347) 555-0100',
    signer_email: 'john@acme.com',
    terms_consent_1: true,
    terms_consent_2: true,
    terms_consent_3: true,
    signature_text: 'John Doe',
  };

  it('Happy Path: validates complete wholesale registration with 3 consents and signature', () => {
    const result = validateWholesaleRegistration(validRegistrationPayload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Sad Path 1: throws error when commercial terms consent 1 is missing', () => {
    expect(() =>
      validateWholesaleRegistration({
        ...validRegistrationPayload,
        terms_consent_1: false,
      })
    ).toThrow(/Commercial terms consent checkbox 1 is mandatory/);
  });

  it('Sad Path 2: throws error when card-on-file Stripe authorization consent 2 is missing', () => {
    expect(() =>
      validateWholesaleRegistration({
        ...validRegistrationPayload,
        terms_consent_2: false,
      })
    ).toThrow(/Card-on-file Stripe authorization checkbox 2 is mandatory/);
  });

  it('Sad Path 3: throws error when electronic signature acceptance consent 3 is missing', () => {
    expect(() =>
      validateWholesaleRegistration({
        ...validRegistrationPayload,
        terms_consent_3: false,
      })
    ).toThrow(/Electronic signature acceptance checkbox 3 is mandatory/);
  });

  it('Sad Path 4: throws error when electronic signature text is empty or too short', () => {
    expect(() =>
      validateWholesaleRegistration({
        ...validRegistrationPayload,
        signature_text: '   ',
      })
    ).toThrow(/Binding electronic signature/);
  });

  it('Sad Path 5: throws error when legal business name or EIN is missing', () => {
    expect(() =>
      validateWholesaleRegistration({
        ...validRegistrationPayload,
        legal_business_name: '',
        ein: '',
      })
    ).toThrow(/Legal business name is required/);
  });
});

describe('S60B Check Payment Validation with OCR & Human Checkbox (§4, §6)', () => {
  const validCheckOrder = {
    client_check_enabled: true,
    check_image_url: '/uploads/zelle/check_front_1048.jpg',
    check_number: '1048',
    check_bank: 'JPMorgan Chase Bank',
    check_amount: 350.0,
    check_verified: true,
  };

  it('Happy Path: validates check payment with enabled client and verified checkbox', () => {
    const result = validateCheckPaymentOrder(validCheckOrder);
    expect(result.valid).toBe(true);
  });

  it('Sad Path 1: throws error when client does not have check_enabled', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckOrder,
        client_check_enabled: false,
      })
    ).toThrow(/Check payment is not enabled for this client account/);
  });

  it('Sad Path 2: throws error when check front photo is missing', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckOrder,
        check_image_url: '',
      })
    ).toThrow(/Front photo of the check is required/);
  });

  it('Sad Path 3: throws error when check number or bank is missing', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckOrder,
        check_number: '',
        check_bank: '  ',
      })
    ).toThrow(/Check number is required/);
  });

  it('Sad Path 4: throws error when mandatory human verification checkbox is unchecked', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckOrder,
        check_verified: false,
      })
    ).toThrow(/Human verification checkbox confirming data matches document is mandatory/);
  });
});

describe('S60B Client Account Statement Report & Range Filtering (§4, §6)', () => {
  const mockOrders: StatementOrder[] = [
    {
      id: 'ord-current-1',
      created_at: '2026-11-02T10:00:00Z',
      total: 500.0,
      refunded_amount: 50.0,
      payment_status: 'paid',
      payment_method: 'check',
    },
    {
      id: 'ord-current-2',
      created_at: '2026-11-03T15:00:00Z',
      total: 300.0,
      refunded_amount: 0,
      payment_status: 'pending',
      payment_method: 'credit',
    },
    {
      id: 'ord-past-month',
      created_at: '2026-10-15T12:00:00Z',
      total: 400.0,
      refunded_amount: 0,
      payment_status: 'paid',
      payment_method: 'stripe',
    },
    {
      id: 'ord-old',
      created_at: '2026-08-01T12:00:00Z',
      total: 1000.0,
      refunded_amount: 0,
      payment_status: 'paid',
      payment_method: 'zelle',
    },
  ];

  const refDate = new Date('2026-11-04T12:00:00Z');

  it('Happy Path: filters orders correctly for "current_month"', () => {
    const currentMonthOrders = filterOrdersByDateRange(mockOrders, 'current_month', refDate);
    expect(currentMonthOrders).toHaveLength(2);
    expect(currentMonthOrders.map((o) => o.id)).toEqual(['ord-current-1', 'ord-current-2']);
  });

  it('Happy Path: filters orders correctly for "last_30_days"', () => {
    const last30Orders = filterOrdersByDateRange(mockOrders, 'last_30_days', refDate);
    expect(last30Orders).toHaveLength(3);
    expect(last30Orders.map((o) => o.id)).toEqual(['ord-current-1', 'ord-current-2', 'ord-past-month']);
  });

  it('Happy Path: calculates accurate consolidated statement summary', () => {
    const currentMonthOrders = filterOrdersByDateRange(mockOrders, 'current_month', refDate);
    const summary = calculateStatementSummary(currentMonthOrders);

    // ord-current-1: 500 - 50 = 450 (paid)
    // ord-current-2: 300 - 0 = 300 (pending)
    // Total invoiced: 750, Total paid: 450, Total pending: 300
    expect(summary.totalInvoiced).toBe(750.0);
    expect(summary.totalPaid).toBe(450.0);
    expect(summary.totalPending).toBe(300.0);
    expect(summary.ordersCount).toBe(2);
  });

  it('Sad Path 1: handles empty order list safely without errors', () => {
    const summary = calculateStatementSummary([]);
    expect(summary.totalInvoiced).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.totalPending).toBe(0);
    expect(summary.ordersCount).toBe(0);
  });

  it('Sad Path 2: filters out orders with corrupt or unparseable created_at dates', () => {
    const corruptOrders: any = [
      { id: 'bad-1', created_at: 'not-a-date', total: 100 },
      { id: 'bad-2', created_at: '', total: 100 },
      { id: 'ok-1', created_at: '2026-11-01T00:00:00Z', total: 200 },
    ];
    const filtered = filterOrdersByDateRange(corruptOrders, 'current_month', refDate);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('ok-1');
  });
});
