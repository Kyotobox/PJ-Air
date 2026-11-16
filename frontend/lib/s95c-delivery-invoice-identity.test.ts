import { describe, it, expect } from 'vitest';
import {
  getClientBusinessName,
  getClientContactName,
  getClientFullIdentity,
  assertValidClientIdentityInput,
  FALLBACK_BUSINESS_NAME,
} from './client-identity';

describe('S95C: Delivery Driver Business Visibility & Invoice Commercial Identity (§1, §4, §6)', () => {
  // =========================================================================
  // 1. DELIVERY DRIVER CARDS & DRAWER - COMMERCIAL IDENTITY (HAPPY PATH)
  // =========================================================================
  describe('Driver Delivery Cards & Drawer Identity Resolution', () => {
    it('resolves business nickname for delivery card title when nickname exists', () => {
      const order = {
        id: 'ord-del-101',
        user: {
          id: 'u-101',
          email: 'store@carmenbakery.com',
          profile: {
            nickname: 'Carmen Bakery - Astoria Branch',
            full_name: 'Carmen Rodriguez',
            phone: '718-555-0144',
          },
        },
      };

      const businessName = getClientBusinessName(order.user);
      const contactName = getClientContactName(order.user);

      expect(businessName).toBe('Carmen Bakery - Astoria Branch');
      expect(contactName).toBe('Carmen Rodriguez');
    });

    it('prioritizes DBA over contact name for driver view when nickname is absent', () => {
      const order = {
        id: 'ord-del-102',
        user: {
          id: 'u-102',
          dba: 'Sweet Corner Deli & Cafe',
          legal_business_name: 'Corner Hospitality Corp',
          profile: {
            full_name: 'Mario Rossi',
            phone: '917-555-8822',
          },
        },
      };

      const businessName = getClientBusinessName(order.user);
      const contactName = getClientContactName(order.user);

      expect(businessName).toBe('Sweet Corner Deli & Cafe');
      expect(contactName).toBe('Mario Rossi');
    });

    it('prioritizes legal_business_name over personal contact name when no nickname or DBA', () => {
      const order = {
        id: 'ord-del-103',
        user: {
          id: 'u-103',
          legal_business_name: 'Carmen Bakery LLC',
          profile: {
            full_name: 'Carmen Rodriguez',
            phone: '718-555-9900',
          },
        },
      };

      const businessName = getClientBusinessName(order.user);
      const contactName = getClientContactName(order.user);

      expect(businessName).toBe('Carmen Bakery LLC');
      expect(contactName).toBe('Carmen Rodriguez');
    });

    it('falls back to personal contact name when no business identity exists', () => {
      const order = {
        id: 'ord-del-104',
        user: {
          id: 'u-104',
          email: 'individual@gmail.com',
          profile: {
            full_name: 'John Individual',
            phone: '646-555-1234',
          },
        },
      };

      const businessName = getClientBusinessName(order.user);
      const contactName = getClientContactName(order.user);

      expect(businessName).toBe('John Individual');
      expect(contactName).toBe('John Individual');
    });

    it('resolves structured full identity with phone for direct click-to-call driver functionality', () => {
      const order = {
        id: 'ord-del-105',
        user: {
          id: 'u-105',
          legal_business_name: 'Queens Pastry House LLC',
          profile: {
            full_name: 'Elena Rostova',
            phone: '347-555-7766',
          },
        },
      };

      const identity = getClientFullIdentity(order.user);
      expect(identity.businessName).toBe('Queens Pastry House LLC');
      expect(identity.contactName).toBe('Elena Rostova');
      expect(identity.phone).toBe('347-555-7766');
    });
  });

  // =========================================================================
  // 2. INVOICE PRINT BILL TO SECTION (HAPPY PATH)
  // =========================================================================
  describe('Invoice Printout Commercial Identity (handlePrintInvoice)', () => {
    function simulateInvoicePartiesHtml(order: any): string {
      const customerName = getClientBusinessName(order.user);
      const attnName = getClientContactName(order.user);
      const clientPhone = order.user?.profile?.phone || order.user?.phone || order.delivery_phone || order.phone || '';
      const deliveryAddress = order.address ? `${order.address.address}, ${order.address.city}` : 'Direct Delivery';

      return `
        <div class="party">
            <h3>Bill To / Customer Details:</h3>
            <p><b>Customer:</b> ${customerName}</p>
            ${attnName ? `<p><b>Attn:</b> ${attnName}</p>` : ''}
            ${clientPhone ? `<p><b>Phone:</b> ${clientPhone}</p>` : ''}
            <p><b>Delivery Address:</b> ${deliveryAddress}</p>
        </div>
      `;
    }

    it('renders Customer with business name and Attn with personal contact name', () => {
      const order = {
        id: 'inv-s95c-001',
        user: {
          legal_business_name: 'Carmen Bakery LLC',
          profile: {
            full_name: 'Carmen Rodriguez',
            phone: '718-555-9876',
          },
        },
        address: {
          address: '3304 Broadway',
          city: 'Astoria',
        },
      };

      const html = simulateInvoicePartiesHtml(order);

      // Customer must be the commercial entity
      expect(html).toContain('<p><b>Customer:</b> Carmen Bakery LLC</p>');
      // Attn must be the contact person
      expect(html).toContain('<p><b>Attn:</b> Carmen Rodriguez</p>');
      // Phone is included
      expect(html).toContain('<p><b>Phone:</b> 718-555-9876</p>');
      // Does NOT output Customer as Carmen Rodriguez
      expect(html).not.toContain('<p><b>Customer:</b> Carmen Rodriguez</p>');
    });

    it('omits Attn line completely when contact name is absent or null', () => {
      const order = {
        id: 'inv-s95c-002',
        user: {
          legal_business_name: 'Enterprise Wholesale Corp',
          email: 'ap@enterprisewholesale.com',
          profile: null,
        },
      };

      const html = simulateInvoicePartiesHtml(order);

      expect(html).toContain('<p><b>Customer:</b> Enterprise Wholesale Corp</p>');
      expect(html).not.toContain('<p><b>Attn:</b>');
    });

    it('renders Attn from signer_name when profile.full_name is not defined', () => {
      const order = {
        id: 'inv-s95c-003',
        user: {
          dba: 'Metro Gourmet Mart',
          signer_name: 'Alexandria Ocasio',
          profile: null,
        },
      };

      const html = simulateInvoicePartiesHtml(order);

      expect(html).toContain('<p><b>Customer:</b> Metro Gourmet Mart</p>');
      expect(html).toContain('<p><b>Attn:</b> Alexandria Ocasio</p>');
    });
  });

  // =========================================================================
  // 3. SAD PATHS & BOUNDARY VALUE VALIDATION (§6 MANDATORY)
  // =========================================================================
  describe('Sad Path and Boundary Handling (§6)', () => {
    it('throws TypeError when assertValidClientIdentityInput receives null or undefined', () => {
      expect(() => assertValidClientIdentityInput(null)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(null)).toThrow(
        'Invalid client identity input: input cannot be null or undefined',
      );
      expect(() => assertValidClientIdentityInput(undefined)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(undefined)).toThrow(
        'Invalid client identity input: input cannot be null or undefined',
      );
    });

    it('throws TypeError when assertValidClientIdentityInput receives primitive non-object types', () => {
      expect(() => assertValidClientIdentityInput('string')).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(12345)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(true)).toThrow(TypeError);
    });

    it('handles empty order / user objects safely without crashing and returns fallback', () => {
      expect(getClientBusinessName(null)).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName(undefined)).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName({})).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName({ user: null })).toBe(FALLBACK_BUSINESS_NAME);
      expect(getClientBusinessName({ user: {} })).toBe(FALLBACK_BUSINESS_NAME);

      expect(getClientContactName(null)).toBeNull();
      expect(getClientContactName(undefined)).toBeNull();
      expect(getClientContactName({})).toBeNull();
      expect(getClientContactName({ user: null })).toBeNull();
    });

    it('ignores whitespace-only strings and traverses to next precedence candidate', () => {
      const order = {
        user: {
          profile: {
            nickname: '   ',
            company_name: '  \t  ',
            full_name: 'Real Human Contact',
          },
          dba: '    \n  ',
          legal_business_name: 'Valid Legal Company',
        },
      };

      // Nickname, DBA and company_name are empty/whitespace, so it reaches legal_business_name
      expect(getClientBusinessName(order.user)).toBe('Valid Legal Company');
      expect(getClientContactName(order.user)).toBe('Real Human Contact');
    });

    it('returns structured fallback identity when object contains only null fields', () => {
      const identity = getClientFullIdentity({
        user: {
          profile: { nickname: null, full_name: null, phone: null },
          dba: null,
          legal_business_name: null,
          email: null,
        },
      });

      expect(identity.businessName).toBe(FALLBACK_BUSINESS_NAME);
      expect(identity.contactName).toBeNull();
      expect(identity.email).toBe('');
      expect(identity.phone).toBeNull();
    });
  });
});
