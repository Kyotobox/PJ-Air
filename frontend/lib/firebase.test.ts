import { describe, it, expect } from 'vitest';
import { formatPhoneNumber, toE164Phone, sendOtpSms, confirmOtpCode } from './firebase';

describe('Firebase & Phone Verification Helpers', () => {
  describe('formatPhoneNumber', () => {
    it('returns empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('');
    });

    it('formats 3 digits properly', () => {
      expect(formatPhoneNumber('305')).toBe('+1 (305');
    });

    it('formats 6 digits properly', () => {
      expect(formatPhoneNumber('305555')).toBe('+1 (305) 555');
    });

    it('formats 10 digits as standard US phone mask', () => {
      expect(formatPhoneNumber('3055550100')).toBe('+1 (305) 555-0100');
    });

    it('handles leading 1 cleanly', () => {
      expect(formatPhoneNumber('13055550100')).toBe('+1 (305) 555-0100');
    });
  });

  describe('toE164Phone', () => {
    it('converts 10-digit phone to E.164 with +1 prefix', () => {
      expect(toE164Phone('3055550100')).toBe('+13055550100');
    });

    it('strips non-digits and ensures +1 prefix', () => {
      expect(toE164Phone('+1 (305) 555-0100')).toBe('+13055550100');
    });
  });

  describe('sendOtpSms & confirmOtpCode simulation mode', () => {
    it('sends simulated OTP and confirms with valid test code (123456)', async () => {
      const confirmation = await sendOtpSms('+13055550100');
      expect(confirmation).toBeDefined();
      expect(typeof confirmation.confirm).toBe('function');

      const res = await confirmOtpCode(confirmation, '123456');
      expect(res.success).toBe(true);
      expect(res.idToken).toBe('mock-valid-firebase-token');
      expect(res.phone).toBe('+13055550100');
    });

    it('throws error when verifying with wrong code', async () => {
      const confirmation = await sendOtpSms('+13055550100');
      await expect(confirmOtpCode(confirmation, '999999')).rejects.toThrow(
        /invalid or expired verification code/i
      );
    });

    it('throws error when confirmation object is invalid', async () => {
      await expect(confirmOtpCode(null as any, '123456')).rejects.toThrow(
        /no active verification session/i
      );
    });
  });
});
