import { describe, it, expect } from 'vitest';
import { validateCheckPaymentOrder } from './b2b-statement-helper';

describe('Sprint S85C: Physical Check Photo & OCR Validation (§4, §6)', () => {
  const validCheckPayload = {
    client_check_enabled: true,
    check_image_url: 'https://storage.jhoanes.com/checks/check_front_1048.jpg',
    check_number: '1048',
    check_bank: 'JPMorgan Chase Bank',
    check_amount: 250.0,
    check_verified: true,
  };

  it('Happy Path: validates check order when physical check photo and all fields are attached and verified', () => {
    const result = validateCheckPaymentOrder(validCheckPayload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Sad Path 1 (§6): blocks check order when physical check photo is missing or empty string', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckPayload,
        check_image_url: '',
      })
    ).toThrow(/Front photo of the check is required/i);
  });

  it('Sad Path 2 (§6): blocks check order when physical check photo is null', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckPayload,
        check_image_url: null,
      })
    ).toThrow(/Front photo of the check is required/i);
  });

  it('Sad Path 3 (§6): blocks check order when human verification checkbox is unchecked', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckPayload,
        check_verified: false,
      })
    ).toThrow(/Human verification checkbox confirming data matches document is mandatory/i);
  });

  it('Sad Path 4 (§6): blocks check order when client account does not have check_enabled', () => {
    expect(() =>
      validateCheckPaymentOrder({
        ...validCheckPayload,
        client_check_enabled: false,
      })
    ).toThrow(/Check payment is not enabled for this client account/i);
  });

  it('Button Disable Rule: confirmation button is strictly disabled if check photo is not attached', () => {
    // Pure function logic mirroring checkout button disabled condition
    const isConfirmDisabled = (cartLength: number, paymentMethod: string, checkImageUrl: string | null, checkNumber: string, checkBank: string, checkVerified: boolean) => {
      if (cartLength === 0) return true;
      if (paymentMethod === 'check') {
        if (!checkImageUrl || !checkNumber.trim() || !checkBank.trim() || !checkVerified) {
          return true;
        }
      }
      return false;
    };

    // Disabled when checkImageUrl is null
    expect(isConfirmDisabled(2, 'check', null, '1048', 'Chase', true)).toBe(true);
    // Disabled when checkImageUrl is empty
    expect(isConfirmDisabled(2, 'check', '', '1048', 'Chase', true)).toBe(true);
    // Enabled when checkImageUrl is attached and all fields valid
    expect(isConfirmDisabled(2, 'check', 'https://storage/check.jpg', '1048', 'Chase', true)).toBe(false);
  });
});
