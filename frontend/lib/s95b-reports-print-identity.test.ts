import { describe, it, expect } from 'vitest';
import {
  generateKitchenPrintHtml,
  generateKitchenExcelWorkbook,
  KitchenPrintOptions,
} from './kitchen-dispatch';
import {
  getClientBusinessName,
  getClientContactName,
  getClientFullIdentity,
  assertValidClientIdentityInput,
  FALLBACK_BUSINESS_NAME,
} from './client-identity';

describe('S95B: Business Identity in Kitchen Sheets, Reports Matrix & Invoices (§1, §4, §6)', () => {
  const sampleItems = [
    {
      product: { name: 'Artisanal Croissant', category: 'Croissants' },
      quantity: 12,
      notes: '',
    },
    {
      product: { name: 'Almond Croissant', category: 'Croissants' },
      quantity: 6,
      notes: 'Sin azúcar glass',
    },
  ];

  // =========================================================================
  // 1. KITCHEN DISPATCH (HTML & EXCEL) - HAPPY PATH
  // =========================================================================
  describe('Kitchen Dispatch Engine - Commercial Business Name (Happy Path)', () => {
    it('renders the business nickname in the yellow header box and PEDIDO line when user has nickname', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-s95b-001',
        deliveryDateStr: '2026-11-20',
        driverName: 'William Medina',
        deliveryAddress: '31-01 Broadway, Astoria, NY',
        packingStyle: 'CAJAS DE CARTON',
        items: sampleItems,
        order: {
          id: 'ord-s95b-001',
          user: {
            id: 'u-101',
            email: 'chef@lepetitcroissant.com',
            profile: {
              nickname: 'Le Petit Croissant Astoria',
              full_name: 'Pierre Dubois',
              company_name: 'Dubois Bakery Group LLC',
            },
          },
        },
      };

      const html = generateKitchenPrintHtml(options);

      // Yellow box with exact business name
      expect(html).toContain('yellow-header-box');
      expect(html).toContain('PEDIDO:');
      expect(html).toContain('LE PETIT CROISSANT ASTORIA');
      expect(html).not.toContain('PIERRE DUBOIS');
    });

    it('renders DBA in yellow box and PEDIDO line when nickname is absent but DBA is present', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-s95b-002',
        deliveryDateStr: '2026-11-20',
        driverName: 'William Medina',
        deliveryAddress: '1418 Cortelyou Rd, Brooklyn, NY',
        packingStyle: 'CAJA PLASTICA / CONTENEDORES',
        items: sampleItems,
        user: {
          id: 'u-102',
          dba: 'Sunrise Artisan Cafe',
          legal_business_name: 'Sunrise Gourmet Holdings Inc',
          profile: {
            full_name: 'Maria Rossi',
          },
        },
      };

      const html = generateKitchenPrintHtml(options);

      expect(html).toContain('PEDIDO:</span> SUNRISE ARTISAN CAFE');
      expect(html).not.toContain('MARIA ROSSI');
    });

    it('generates Excel workbook with filename and cell A1 reflecting commercial business name', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-s95b-003-excel',
        deliveryDateStr: '2026-11-20',
        driverName: 'William Medina',
        deliveryAddress: '3304 Broadway, Astoria, NY',
        packingStyle: 'CAJAS DE CARTON',
        items: sampleItems,
        order: {
          user: {
            profile: {
              nickname: 'Cafe Dolce Vita',
              full_name: 'Giuseppe Verdi',
            },
          },
        },
      };

      const { workbook, filename } = generateKitchenExcelWorkbook(options);

      expect(filename).toBe('Hoja_Cocina_ORD-S95B_Cafe_Dolce_Vita.xlsx');

      const sheetName = workbook.SheetNames[0];
      expect(sheetName).toBe('CAFE DOLCE VITA');

      const sheet = workbook.Sheets[sheetName];
      const a1Value = sheet['A1']?.v as string;
      expect(a1Value).toContain('PEDIDO: CAFE DOLCE VITA');
      expect(a1Value).not.toContain('GIUSEPPE VERDI');
    });

    it('uses clientName string directly when no order or user object is passed (backward compatibility)', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-compat-999',
        clientName: 'Direct Client Store',
        deliveryDateStr: '2026-11-20',
        driverName: 'William Medina',
        deliveryAddress: 'Direct Address',
        packingStyle: 'CAJAS DE CARTON',
        items: sampleItems,
      };

      const html = generateKitchenPrintHtml(options);
      expect(html).toContain('PEDIDO:</span> DIRECT CLIENT STORE');

      const { filename } = generateKitchenExcelWorkbook(options);
      expect(filename).toBe('Hoja_Cocina_ORD-COMP_Direct_Client_Store.xlsx');
    });
  });

  // =========================================================================
  // 2. KITCHEN DISPATCH (HTML & EXCEL) - SAD PATH (§6 Mandatorio)
  // =========================================================================
  describe('Kitchen Dispatch Engine - Sad Path (§6)', () => {
    it('falls back safely to CLIENTE without crashing when clientName and user are null/undefined', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-sad-null',
        driverName: 'William Medina',
        deliveryAddress: 'N/A',
        packingStyle: 'CAJAS DE CARTON',
        items: [],
      };

      const html = generateKitchenPrintHtml(options);
      expect(html).toContain('PEDIDO:</span> CLIENTE');

      const { filename } = generateKitchenExcelWorkbook(options);
      expect(filename).toBe('Hoja_Cocina_ORD-SAD-_CLIENTE.xlsx');
    });

    it('handles empty or whitespace-only business names by falling back safely', () => {
      const options: KitchenPrintOptions = {
        orderId: 'ord-sad-empty',
        clientName: '   ',
        driverName: 'William Medina',
        deliveryAddress: 'N/A',
        packingStyle: 'CAJAS DE CARTON',
        items: [],
        user: {
          profile: {
            nickname: '   ',
            full_name: '   ',
          },
          dba: '   ',
          company_name: '   ',
          email: '   ',
        },
      };

      const html = generateKitchenPrintHtml(options);
      expect(html).toContain('PEDIDO:</span> CLIENTE B2B');

      const { filename } = generateKitchenExcelWorkbook(options);
      expect(filename).toBe('Hoja_Cocina_ORD-SAD-_Cliente_B2B.xlsx');
    });
  });

  // =========================================================================
  // 3. INVOICE BILL TO & PRODUCTION PRINT IDENTITY
  // =========================================================================
  describe('Invoice & Production Print Identity Resolution', () => {
    it('resolves Customer to Business Name and contactName to personal name for Attn section', () => {
      const user = {
        profile: {
          nickname: 'Brooklyn Bread House',
          full_name: 'Carlos Mendoza',
          phone: '(718) 555-1234',
        },
        dba: 'BBH Brooklyn',
        company_name: 'Brooklyn Bread House Corp',
      };

      const businessName = getClientBusinessName(user);
      const contactName = getClientContactName(user);

      expect(businessName).toBe('Brooklyn Bread House');
      expect(contactName).toBe('Carlos Mendoza');

      // Bill To HTML simulation
      const billToCustomerHtml = `<p><b>Customer:</b> ${businessName}</p>`;
      const billToAttnHtml = contactName ? `<p><b>Attn:</b> ${contactName}</p>` : '';

      expect(billToCustomerHtml).toBe('<p><b>Customer:</b> Brooklyn Bread House</p>');
      expect(billToAttnHtml).toBe('<p><b>Attn:</b> Carlos Mendoza</p>');
    });

    it('omits Attn section when user has no personal contact name', () => {
      const user = {
        dba: 'Sunset Wholesale Deli',
        company_name: 'Sunset Deli Inc',
        profile: null,
      };

      const businessName = getClientBusinessName(user);
      const contactName = getClientContactName(user);

      expect(businessName).toBe('Sunset Wholesale Deli');
      expect(contactName).toBeNull();

      const billToAttnHtml = contactName ? `<p><b>Attn:</b> ${contactName}</p>` : '';
      expect(billToAttnHtml).toBe('');
    });

    it('enforces assertValidClientIdentityInput rejecting null, undefined, or non-object (§6 Sad Path)', () => {
      expect(() => assertValidClientIdentityInput(null)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(undefined)).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput('invalid-string')).toThrow(TypeError);
      expect(() => assertValidClientIdentityInput(12345)).toThrow(TypeError);

      // Valid object does not throw
      expect(() => assertValidClientIdentityInput({ user: {} })).not.toThrow();
    });
  });

  // =========================================================================
  // 4. REPORTS MATRIX COLUMN & SEARCH FILTERING
  // =========================================================================
  describe('Reports Matrix Client Columns and Search Filtering', () => {
    const clients = [
      {
        id: 'c-1',
        email: 'owner@broadwaydiner.com',
        dba: 'Broadway Diner & Bakery',
        profile: {
          nickname: 'Broadway Diner',
          full_name: 'Arthur Dent',
          company_name: 'Broadway Diner LLC',
        },
      },
      {
        id: 'c-2',
        email: 'info@queenscoffee.com',
        legal_business_name: 'Queens Specialty Coffee LLC',
        profile: {
          full_name: 'Ford Prefect',
        },
      },
      {
        id: 'c-3',
        email: 'tricia@earth.com',
        profile: {
          full_name: 'Tricia McMillan',
        },
      },
    ];

    it('resolves matrix column headers with business name prioritized', () => {
      const client1Header = getClientBusinessName(clients[0]);
      const client2Header = getClientBusinessName(clients[1]);
      const client3Header = getClientBusinessName(clients[2]);

      expect(client1Header).toBe('Broadway Diner'); // nickname wins
      expect(client2Header).toBe('Queens Specialty Coffee LLC'); // legal business name wins over full_name
      expect(client3Header).toBe('Tricia McMillan'); // full_name fallback when no business info
    });

    it('filters clients search query by commercial business name, contact, and email', () => {
      const searchClients = (query: string) => {
        const q = query.toLowerCase();
        return clients.filter(c => {
          const bizName = getClientBusinessName(c).toLowerCase();
          return (
            bizName.includes(q) ||
            (c.profile?.nickname || '').toLowerCase().includes(q) ||
            (c.profile?.full_name || '').toLowerCase().includes(q) ||
            (c.profile?.company_name || '').toLowerCase().includes(q) ||
            (c.legal_business_name || '').toLowerCase().includes(q) ||
            (c.dba || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
          );
        });
      };

      // Search by business nickname
      expect(searchClients('Broadway')).toHaveLength(1);
      expect(searchClients('Broadway')[0].id).toBe('c-1');

      // Search by legal name
      expect(searchClients('Queens Specialty')).toHaveLength(1);
      expect(searchClients('Queens Specialty')[0].id).toBe('c-2');

      // Search by contact person
      expect(searchClients('Tricia')).toHaveLength(1);
      expect(searchClients('Tricia')[0].id).toBe('c-3');

      // Sad path: search with no match
      expect(searchClients('NonExistentBakery')).toHaveLength(0);
    });
  });
});
