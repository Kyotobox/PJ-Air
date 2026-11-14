import { describe, it, expect } from 'vitest';

export interface WirePaymentOrderPayload {
  ach_enabled: boolean;
  wire_receipt_url: string | null;
  wire_reference: string | null;
}

export function validateWirePaymentOrder(payload: WirePaymentOrderPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.ach_enabled) {
    throw new Error('ACH / Wire transfer payment is not enabled for this client account');
  }

  if (!payload.wire_receipt_url || !payload.wire_receipt_url.trim()) {
    throw new Error('Comprobante de transferencia bancaria (voucher/receipt) is required for ACH / Wire payments');
  }

  if (!payload.wire_reference || !payload.wire_reference.trim()) {
    throw new Error('Bank confirmation or reference number is mandatory');
  }

  return { valid: true, errors };
}

describe('Sprint S89: ACH / Wire Transfer Validation & Checkout Shield (§4, §6)', () => {
  const validWirePayload: WirePaymentOrderPayload = {
    ach_enabled: true,
    wire_receipt_url: 'https://storage.jhoanes.com/wire/voucher_12345.pdf',
    wire_reference: 'WIRE-TRACE-8849201',
  };

  it('Happy Path: validates wire order when voucher receipt and reference are attached', () => {
    const result = validateWirePaymentOrder(validWirePayload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Sad Path 1 (§6): throws when wire receipt url is null', () => {
    expect(() =>
      validateWirePaymentOrder({
        ...validWirePayload,
        wire_receipt_url: null,
      })
    ).toThrow(/Comprobante de transferencia bancaria.*is required/i);
  });

  it('Sad Path 2 (§6): throws when wire receipt url is empty string', () => {
    expect(() =>
      validateWirePaymentOrder({
        ...validWirePayload,
        wire_receipt_url: '   ',
      })
    ).toThrow(/Comprobante de transferencia bancaria.*is required/i);
  });

  it('Sad Path 3 (§6): throws when wire reference is missing or empty string', () => {
    expect(() =>
      validateWirePaymentOrder({
        ...validWirePayload,
        wire_reference: '',
      })
    ).toThrow(/Bank confirmation or reference number is mandatory/i);
  });

  it('Sad Path 4 (§6): throws when client account is not authorized for ACH (ach_enabled: false)', () => {
    expect(() =>
      validateWirePaymentOrder({
        ...validWirePayload,
        ach_enabled: false,
      })
    ).toThrow(/ACH \/ Wire transfer payment is not enabled/i);
  });

  it('Checkout Submit Button Rule: disables place order button when receipt or reference is missing for ACH', () => {
    const isConfirmDisabled = (
      cartLength: number,
      paymentMethod: string,
      achReceiptUrl: string | null,
      achReference: string
    ) => {
      if (cartLength === 0) return true;
      if (paymentMethod === 'ach') {
        if (!achReceiptUrl || !achReference.trim()) {
          return true;
        }
      }
      return false;
    };

    // Disabled when receipt is null
    expect(isConfirmDisabled(1, 'ach', null, 'WIRE-123')).toBe(true);
    // Disabled when reference is empty
    expect(isConfirmDisabled(1, 'ach', 'https://storage/voucher.pdf', '')).toBe(true);
    // Disabled when cart is empty
    expect(isConfirmDisabled(0, 'ach', 'https://storage/voucher.pdf', 'WIRE-123')).toBe(true);
    // Enabled when receipt and reference are provided
    expect(isConfirmDisabled(2, 'ach', 'https://storage/voucher.pdf', 'WIRE-123')).toBe(false);
  });
});
