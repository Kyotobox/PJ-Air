import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  describe('sendOtpSms & confirmOtpCode with real dynamic verification', () => {
    const originalFetch = globalThis.fetch;
    const realGeneratedCode = '482915';

    beforeEach(() => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (url.includes('/api/auth/send-sms-otp')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              verificationId: 'backend-otp-v123',
            }),
          });
        }
        if (url.includes('/api/auth/verify-sms-otp')) {
          const body = JSON.parse(opts?.body || '{}');
          if (body.code === realGeneratedCode) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                success: true,
                idToken: 'valid-test-token-otp-482915',
              }),
            });
          }
          return Promise.resolve({
            ok: false,
            json: async () => ({
              message: 'Invalid or expired verification code',
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch url: ${url}`));
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('sends OTP via backend and confirms with matching generated code', async () => {
      const confirmation = await sendOtpSms('+13055550100');
      expect(confirmation).toBeDefined();
      expect(typeof confirmation.confirm).toBe('function');

      const res = await confirmOtpCode(confirmation, realGeneratedCode);
      expect(res.success).toBe(true);
      expect(res.idToken).toBe('valid-test-token-otp-482915');
      expect(res.phone).toBe('+13055550100');
    });

    it('strictly rejects hardcoded 123456 when code is dynamic (Sad Path §6)', async () => {
      const confirmation = await sendOtpSms('+13055550100');
      await expect(confirmOtpCode(confirmation, '123456')).rejects.toThrow(
        /invalid or expired verification code/i
      );
    });

    it('throws error when verifying with wrong code (Sad Path §6)', async () => {
      const confirmation = await sendOtpSms('+13055550100');
      await expect(confirmOtpCode(confirmation, '999999')).rejects.toThrow(
        /invalid or expired verification code/i
      );
    });

    it('throws error when confirmation object is invalid', async () => {
      await expect(confirmOtpCode(null as any, realGeneratedCode)).rejects.toThrow(
        /no active verification session/i
      );
    });
  });
});
