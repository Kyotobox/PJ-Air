import { describe, it, expect } from 'vitest';
import {
  getClientBusinessName,
  getClientContactName,
  getClientFullIdentity,
  assertValidClientIdentityInput,
  cleanString,
  FALLBACK_BUSINESS_NAME,
} from './client-identity';

describe('Canonical Client Identity Helper (Frontend) - Sprint S95 (TASK-95-01)', () => {
  describe('getClientBusinessName - Precedence Hierarchy (Happy Paths)', () => {
    it('Priority 1: returns user.profile.nickname when all fields are present', () => {
      const user = {
        email: 'owner@parisienne.com',
        legal_business_name: 'Parisienne French Bakery LLC',
        dba: 'La Parisienne NYC',
        company_name: 'Parisienne Foods Corp',
        signer_name: 'Pierre Dubois',
        profile: {
          nickname: 'Café Parisienne',
          company_name: 'Parisienne Bakery & Café',
          full_name: 'Pierre Dubois',
        },
      };

      expect(getClientBusinessName(user)).toBe('Café Parisienne');
    });

    it('Priority 2: returns user.dba over company_name and legal_business_name when nickname is missing', () => {
      const user = {
        email: 'billing@brooklynbake.com',
        legal_business_name: 'Brooklyn Artisanal Baking Corporation',
        dba: 'Brooklyn Bakehouse',
        company_name: 'Brooklyn Artisanal Group',
        profile: {
          nickname: '', // Empty nickname
          company_name: 'Brooklyn Bake Co',
          full_name: 'Sarah Connor',
        },
      };

      expect(getClientBusinessName(user)).toBe('Brooklyn Bakehouse');
    });

    it('Priority 2: returns user.dba when profile.nickname is only whitespace', () => {
      const user = {
        dba: 'Downtown Roasters',
        legal_business_name: 'Roasters Holding Inc',
        profile: {
          nickname: '   \t  ',
          company_name: 'Roasters Retail LLC',
        },
      };

      expect(getClientBusinessName(user)).toBe('Downtown Roasters');
    });

    it('Priority 3: returns user.profile.company_name over legal_business_name when nickname and dba are absent', () => {
      const user = {
        email: 'info@greenwichcafe.com',
        legal_business_name: 'Greenwich Hospitality Group LLC',
        dba: '',
        profile: {
          nickname: null,
          company_name: 'Greenwich Corner Café',
          full_name: 'Alice Smith',
        },
      };

      expect(getClientBusinessName(user)).toBe('Greenwich Corner Café');
    });

    it('Priority 3b: returns user.company_name when profile is missing or lacks company_name', () => {
      const userWithoutProfile = {
        email: 'info@tribecaeats.com',
        legal_business_name: 'Tribeca Culinary Ventures LLC',
        company_name: 'Tribeca Eats & Treats',
        profile: null,
      };

      expect(getClientBusinessName(userWithoutProfile)).toBe('Tribeca Eats & Treats');
    });

    it('Priority 4: returns user.legal_business_name over full_name and email when higher business fields are absent', () => {
      const user = {
        email: 'contact@sohopastry.com',
        legal_business_name: 'SoHo Artisan Pastries Inc',
        dba: null,
        company_name: '   ',
        profile: {
          nickname: '',
          company_name: '',
          full_name: 'John Dough',
        },
      };

      expect(getClientBusinessName(user)).toBe('SoHo Artisan Pastries Inc');
    });

    it('Priority 5: returns user.profile.full_name as personal contact fallback only when no business fields exist', () => {
      const user = {
        email: 'chef.maria@gmail.com',
        profile: {
          nickname: '',
          company_name: '',
          full_name: 'Maria Rodriguez',
        },
      };

      expect(getClientBusinessName(user)).toBe('Maria Rodriguez');
    });

    it('Priority 6: returns user.email when no business fields and no contact full_name exist', () => {
      const user = {
        email: 'solo.caterer@domain.com',
        profile: {
          full_name: '',
        },
      };

      expect(getClientBusinessName(user)).toBe('solo.caterer@domain.com');
    });

    it('Priority 7: returns "Cliente B2B" as safe final fallback when user has no identifying fields', () => {
      const emptyUser = {};
      expect(getClientBusinessName(emptyUser)).toBe(FALLBACK_BUSINESS_NAME);
    });

    it('Order Resolution: correctly extracts identity from an Order object with nested user', () => {
      const order = {
        id: 'ord-uuid-001',
        total: 150.0,
        user: {
          dba: 'Astoria Specialty Coffee',
          profile: {
            nickname: 'Astoria Coffee Hub',
          },
        },
      };

      expect(getClientBusinessName(order)).toBe('Astoria Coffee Hub');
    });

    it('Trims whitespace from resolved business name', () => {
      const user = {
        profile: {
          nickname: '   Hudson Yard Bagels   ',
        },
      };

      expect(getClientBusinessName(user)).toBe('Hudson Yard Bagels');
    });
  });

  describe('getClientContactName', () => {
    it('returns user.profile.full_name when available', () => {
      const user = {
        signer_name: 'Frank Miller',
        profile: {
          full_name: 'Frank A. Miller',
        },
      };

      expect(getClientContactName(user)).toBe('Frank A. Miller');
    });

    it('falls back to user.signer_name when full_name is absent or whitespace', () => {
      const user = {
        signer_name: 'Robert Vance',
        profile: {
          full_name: '   ',
        },
      };

      expect(getClientContactName(user)).toBe('Robert Vance');
    });

    it('returns null when neither full_name nor signer_name is present', () => {
      const user = {
        email: 'no.signer@bakery.com',
        profile: {},
      };

      expect(getClientContactName(user)).toBeNull();
    });

    it('works with nested Order object', () => {
      const order = {
        id: 'ord-999',
        user: {
          signer_name: 'Laura Palmer',
        },
      };

      expect(getClientContactName(order)).toBe('Laura Palmer');
    });
  });

  describe('getClientFullIdentity', () => {
    it('returns complete identity structure with all fields populated', () => {
      const user = {
        email: 'contact@manhattanbakes.com',
        legal_business_name: 'Manhattan Baking Co LLC',
        dba: 'Manhattan Bakes',
        signer_name: 'Arthur Dent',
        profile: {
          nickname: 'M-Bakes Flatiron',
          full_name: 'Arthur Dent',
          phone: '+1 212 555 0199',
        },
      };

      const identity = getClientFullIdentity(user);
      expect(identity).toEqual({
        businessName: 'M-Bakes Flatiron',
        contactName: 'Arthur Dent',
        email: 'contact@manhattanbakes.com',
        phone: '+1 212 555 0199',
      });
    });

    it('handles partial identity gracefully with defaults', () => {
      const user = {
        email: 'simple@cafeshop.com',
      };

      const identity = getClientFullIdentity(user);
      expect(identity).toEqual({
        businessName: 'simple@cafeshop.com',
        contactName: null,
        email: 'simple@cafeshop.com',
        phone: null,
      });
    });

    it('returns safe default structure for null or undefined input', () => {
      expect(getClientFullIdentity(null)).toEqual({
        businessName: FALLBACK_BUSINESS_NAME,
        contactName: null,
        email: '',
        phone: null,
      });

      expect(getClientFullIdentity(undefined)).toEqual({
        businessName: FALLBACK_BUSINESS_NAME,
        contactName: null,
        email: '',
        phone: null,
      });
    });

    it('resolves phone from signer_phone when profile phone is absent', () => {
      const user = {
        email: 'admin@b2b.com',
        signer_phone: '555-123-4567',
        profile: {
          nickname: 'Quick Mart',
        },
      };

      const identity = getClientFullIdentity(user);
      expect(identity.phone).toBe('555-123-4567');
    });
  });

  describe('Sad Paths & Boundary Conditions (§6)', () => {
    it('returns "Cliente B2B" for null, undefined, and non-object inputs', () => {
      expect(getClientBusinessName(null)).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName(undefined)).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName(12345)).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName('string-input')).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName(true)).toBe(FALLBACK_BUSINESS_NAME);
    });

    it('returns "Cliente B2B" when profile is empty or contains only whitespace fields', () => {
      const userWithEmptyProfile = {
        profile: {},
      };
      expect(getClientBusinessName(userWithEmptyProfile)).toBe(FALLBACK_BUSINESS_NAME);

      const userWithWhitespace = {
        profile: {
          nickname: '     ',
          company_name: ' \t \n ',
          full_name: '   ',
        },
        dba: '   ',
        legal_business_name: '   ',
        email: '   ',
      };
      expect(getClientBusinessName(userWithWhitespace)).toBe(FALLBACK_BUSINESS_NAME);
    });

    it('handles Order with null or missing user without throwing', () => {
      expect(getClientBusinessName({ user: null })).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName({ user: undefined })).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientContactName({ user: null })).toBeNull();
      expect(getClientContactName({ user: undefined })).toBeNull();
    });

    it('cleanString helper returns null for non-string, empty, or whitespace values', () => {
      expect(cleanString(null)).toBeNull();
      expect(cleanString(undefined)).toBeNull();
      expect(cleanString('')).toBeNull();
      expect(cleanString('     ')).toBeNull();
      expect(cleanString(100)).toBeNull();
      expect(cleanString({})).toBeNull();
      expect(cleanString('  valid  ')).toBe('valid');
    });

    it('Mandatorio con Throws (§6): assertValidClientIdentityInput throws TypeError on null/undefined', () => {
      expect(() => assertValidClientIdentityInput(null)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(undefined)).toThrow(
        'Invalid client identity input: input cannot be null or undefined'
      );
      expect(() => assertValidClientIdentityInput(123 as any)).toThrow(
        'Invalid client identity input: input must be an object'
      );
      expect(() => assertValidClientIdentityInput('invalid' as any)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput({})).not.toThrow();
    });
  });
});
