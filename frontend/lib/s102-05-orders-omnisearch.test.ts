import { describe, it, expect } from 'vitest';
import {
  normalizeDispatchDate,
  parseDispatchDateStrict,
  isPendingVerificationOrder,
  isDraftOrder,
  orderMatchesSearch,
  checkMatchesSearch,
  computeCrossTabMatches,
  computeCrossTabMatchesStrict,
  Order,
} from './orders-omnisearch';

/**
 * Sprint S102: Omnichannel Search & Date Normalization Test Suite (§4, §6, §48)
 * TASK-102-05: Búsqueda omnicanal en /admin/orders con badges de coincidencia inter-pestañas
 * y normalización de fechas textuales en filtro de despacho.
 */
describe('Sprint S102: Omnichannel Orders Search & Date Normalization (§4, §6, §48)', () => {
  // =========================================================================
  // 1. Normalización de fechas de despacho (normalizeDispatchDate & parseDispatchDateStrict)
  // =========================================================================
  describe('1. Normalización de Fechas de Despacho (normalizeDispatchDate)', () => {
    it('normalizes standard ISO date strings (YYYY-MM-DD)', () => {
      expect(normalizeDispatchDate('2026-11-13')).toBe('2026-11-13');
    });

    it('normalizes ISO datetime strings with timezone (YYYY-MM-DDTHH:mm:ss.sssZ)', () => {
      expect(normalizeDispatchDate('2026-11-13T08:30:00.000Z')).toBe('2026-11-13');
    });

    it('normalizes datetime strings with spaces (YYYY-MM-DD HH:mm:ss)', () => {
      expect(normalizeDispatchDate('2026-11-13 14:00:00')).toBe('2026-11-13');
    });

    it('normalizes textual dates without year using referenceCreatedAt ("Friday, November 13")', () => {
      const normalized = normalizeDispatchDate('Friday, November 13', '2026-11-01T10:00:00.000Z');
      expect(normalized).toBe('2026-11-13');
    });

    it('normalizes textual dates with year ("Friday, November 13, 2026")', () => {
      expect(normalizeDispatchDate('Friday, November 13, 2026')).toBe('2026-11-13');
    });

    it('normalizes abbreviated textual dates ("Fri, Nov 13, 2026")', () => {
      expect(normalizeDispatchDate('Fri, Nov 13, 2026')).toBe('2026-11-13');
    });

    it('normalizes date with weekday colon format ("Friday: Nov 13, 2026")', () => {
      expect(normalizeDispatchDate('Friday: Nov 13, 2026')).toBe('2026-11-13');
    });

    it('normalizes slash dates ("11/13/2026")', () => {
      expect(normalizeDispatchDate('11/13/2026')).toBe('2026-11-13');
    });

    it('falls back to referenceCreatedAt when rawDate is undefined or empty', () => {
      expect(normalizeDispatchDate(undefined, '2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
      expect(normalizeDispatchDate('', '2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
      expect(normalizeDispatchDate(null, '2026-11-05T00:00:00.000Z')).toBe('2026-11-05');
    });

    it('returns empty string when both rawDate and referenceCreatedAt are missing or empty', () => {
      expect(normalizeDispatchDate(null, null)).toBe('');
      expect(normalizeDispatchDate('', '')).toBe('');
      expect(normalizeDispatchDate(undefined, undefined)).toBe('');
    });

    it('prevents silent failures in date range comparison for textual dates', () => {
      // Caso real: delivery_date venía como "Friday, November 13"
      // Antes: "Friday, November 13".split(' ')[0] = "Friday,"
      // Comparación string: "Friday," >= "2026-11-10" era true, pero "Friday," <= "2026-11-15" fallaba!
      const rawTextualDate = 'Friday, November 13';
      const refCreatedAt = '2026-11-01T10:00:00.000Z';
      const startDate = '2026-11-10';
      const endDate = '2026-11-15';

      const normalized = normalizeDispatchDate(rawTextualDate, refCreatedAt);
      expect(normalized).toBe('2026-11-13');

      const matchesRange = (!startDate || normalized >= startDate) && (!endDate || normalized <= endDate);
      expect(matchesRange).toBe(true);
    });

    // --- Sad Paths (§6) ---
    describe('Sad Paths (§6)', () => {
      it('throws an explicit error when both date and reference are missing in strict parser', () => {
        expect(() => parseDispatchDateStrict(null, null)).toThrow(
          'Invalid dispatch date: date and reference are both missing'
        );
        expect(() => parseDispatchDateStrict('', '')).toThrow(
          'Invalid dispatch date: date and reference are both missing'
        );
      });

      it('throws an explicit error when date string is completely unparseable garbage', () => {
        expect(() => parseDispatchDateStrict('unparseable-gibberish-xyz-###', null)).toThrow(
          'Unable to parse dispatch date: "unparseable-gibberish-xyz-###"'
        );
      });
    });
  });

  // =========================================================================
  // 2. Clasificación de Órdenes por Pestaña
  // =========================================================================
  describe('2. Clasificación de Órdenes por Pestaña', () => {
    it('detects pending verification for Zelle, Check and Wire payment statuses', () => {
      expect(isPendingVerificationOrder({ payment_status: 'pending_zelle_verification' })).toBe(true);
      expect(isPendingVerificationOrder({ payment_status: 'pending_check_verification' })).toBe(true);
      expect(isPendingVerificationOrder({ payment_status: 'pending_wire_verification' })).toBe(true);
      expect(isPendingVerificationOrder({ payment_status: 'paid' })).toBe(false);
      expect(isPendingVerificationOrder({ payment_status: undefined })).toBe(false);
    });

    it('detects draft orders correctly without invoice numbers in pending or cancelled statuses', () => {
      expect(isDraftOrder({ invoice_number: undefined, status: 'pending', payment_status: 'pending' })).toBe(true);
      expect(isDraftOrder({ invoice_number: '', status: 'cancelled', payment_status: 'pending' })).toBe(true);
      expect(isDraftOrder({ invoice_number: '', status: 'cancelado', payment_status: 'pending' })).toBe(true);

      // No es borrador si ya tiene invoice_number
      expect(isDraftOrder({ invoice_number: 'INV-1001', status: 'pending', payment_status: 'pending' })).toBe(false);

      // No es borrador si está en verificación pendiente
      expect(isDraftOrder({ invoice_number: undefined, status: 'pending', payment_status: 'pending_zelle_verification' })).toBe(false);
    });
  });

  // =========================================================================
  // 3. Búsqueda y Coincidencias Inter-Pestañas (computeCrossTabMatches)
  // =========================================================================
  describe('3. Búsqueda Omnicanal Inter-Pestañas (computeCrossTabMatches)', () => {
    const mockOrders: Order[] = [
      {
        id: 'ord-001',
        invoice_number: 'INV-2026-001',
        total: 120.5,
        status: 'Pedido',
        payment_status: 'paid',
        created_at: '2026-11-20T10:00:00Z',
        delivery_date: '2026-11-22',
        user: {
          email: 'cafe.central@example.com',
          profile: { full_name: 'Carlos Panadero', nickname: 'Cafe Central' },
        },
        items: [{ id: 'item-1', quantity: 20, price_at_time: 3.5, product: { name: 'Croissant Mantequilla' } }],
      },
      {
        id: 'ord-002',
        invoice_number: undefined,
        total: 85.0,
        status: 'pending',
        payment_status: 'pending_zelle_verification',
        created_at: '2026-11-21T11:00:00Z',
        delivery_date: 'Friday, November 28',
        user: {
          email: 'zelle.client@example.com',
          profile: { full_name: 'Zelle Comprador', nickname: 'Bistro 88' },
        },
        items: [{ id: 'item-2', quantity: 15, price_at_time: 4.0, product: { name: 'Pan de Bono' } }],
      },
      {
        id: 'ord-003',
        invoice_number: undefined,
        total: 50.0,
        status: 'pending',
        payment_status: 'pending',
        created_at: '2026-11-22T09:00:00Z',
        delivery_date: '2026-11-25',
        user: {
          email: 'draft.user@example.com',
          profile: { full_name: 'Daniel Borrador', nickname: 'Borrador Shop' },
        },
        items: [{ id: 'item-3', quantity: 5, price_at_time: 5.0, product: { name: 'Croissant Chocolate' } }],
      },
    ];

    const mockChecks = {
      inHand: [
        {
          id: 'chk-1',
          check_number: 'CHK-9988',
          bank_name: 'Chase Bank',
          notes: 'Pago adelantado de Pan de Bono',
          user: { email: 'chase.client@example.com' },
          order_id: 'ord-002',
        },
      ],
      deposited: [],
      bounced: [],
    };

    it('returns empty array when search query is empty or whitespace only', () => {
      expect(computeCrossTabMatches({ activeTab: 'orders', search: '', orders: mockOrders })).toEqual([]);
      expect(computeCrossTabMatches({ activeTab: 'orders', search: '   ', orders: mockOrders })).toEqual([]);
    });

    it('when on "orders" tab and searching for "Zelle Comprador", suggests "pending_verification"', () => {
      const matches = computeCrossTabMatches({
        activeTab: 'orders',
        search: 'Zelle Comprador',
        orders: mockOrders,
      });

      // Debe sugerir pending_verification (1 coincidencia)
      const pendingMatch = matches.find((m) => m.tab === 'pending_verification');
      expect(pendingMatch).toBeDefined();
      expect(pendingMatch?.count).toBe(1);
      expect(pendingMatch?.label).toBe('Verificaciones Pendientes');

      // No debe sugerir la pestaña activa ("orders")
      expect(matches.some((m) => m.tab === 'orders')).toBe(false);
    });

    it('when on "pending_verification" tab and searching for "Croissant", suggests "orders" and "drafts"', () => {
      const matches = computeCrossTabMatches({
        activeTab: 'pending_verification',
        search: 'Croissant',
        orders: mockOrders,
      });

      // En "orders" hay 2 órdenes con Croissant (ord-001 y ord-003)
      const ordersMatch = matches.find((m) => m.tab === 'orders');
      expect(ordersMatch).toBeDefined();
      expect(ordersMatch?.count).toBe(2);

      // En "drafts" hay 1 orden con Croissant (ord-003)
      const draftsMatch = matches.find((m) => m.tab === 'drafts');
      expect(draftsMatch).toBeDefined();
      expect(draftsMatch?.count).toBe(1);

      // No debe sugerir "pending_verification"
      expect(matches.some((m) => m.tab === 'pending_verification')).toBe(false);
    });

    it('when on "drafts" tab and searching for "cafe.central", suggests "orders"', () => {
      const matches = computeCrossTabMatches({
        activeTab: 'drafts',
        search: 'cafe.central',
        orders: mockOrders,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].tab).toBe('orders');
      expect(matches[0].count).toBe(1);
      expect(matches[0].label).toBe('Todas las Órdenes');
    });

    it('cross-references checks tabs when searching for check numbers', () => {
      const matches = computeCrossTabMatches({
        activeTab: 'orders',
        search: 'CHK-9988',
        orders: mockOrders,
        checksReconciliation: mockChecks,
      });

      const inHandMatch = matches.find((m) => m.tab === 'in_hand');
      expect(inHandMatch).toBeDefined();
      expect(inHandMatch?.count).toBe(1);
      expect(inHandMatch?.label).toBe('Cheques en Cartera');
    });

    it('is case-insensitive and trims leading/trailing spaces in search', () => {
      const matches = computeCrossTabMatches({
        activeTab: 'pending_verification',
        search: '  CROISSANT MANTEQUILLA  ',
        orders: mockOrders,
      });

      const ordersMatch = matches.find((m) => m.tab === 'orders');
      expect(ordersMatch).toBeDefined();
      expect(ordersMatch?.count).toBe(1);
    });

    // --- Sad Paths (§6) ---
    describe('Sad Paths (§6)', () => {
      it('throws an explicit error when params is not an object or orders is not an array', () => {
        expect(() => computeCrossTabMatchesStrict(null)).toThrow('Invalid arguments: params must be an object');
        expect(() => computeCrossTabMatchesStrict({ orders: 'invalid' })).toThrow(
          'Invalid arguments: orders must be an array'
        );
      });
    });
  });

  // =========================================================================
  // 4. Predicados de Búsqueda de Órdenes y Cheques
  // =========================================================================
  describe('4. Predicados de Coincidencia (orderMatchesSearch & checkMatchesSearch)', () => {
    const testOrder: Order = {
      id: 'ord-abc-123',
      invoice_number: 'INV-9999',
      total: 100,
      status: 'Finalizado',
      created_at: '2026-11-20T00:00:00Z',
      user: {
        email: 'boulangerie@test.com',
        dba: 'La Petite Boulangerie',
        legal_business_name: 'Boulangerie LLC',
        profile: {
          full_name: 'Pierre Dupont',
          nickname: 'Pierre',
          company_name: 'Boulangerie Group',
        },
      },
      items: [
        {
          id: 'item-10',
          quantity: 10,
          price_at_time: 2.5,
          product: { name: 'Baguette Rústica', category: 'Panadería Tradicional' },
        },
      ],
    };

    it('matches by invoice number', () => {
      expect(orderMatchesSearch(testOrder, 'INV-9999')).toBe(true);
    });

    it('matches by partial ID', () => {
      expect(orderMatchesSearch(testOrder, 'abc-123')).toBe(true);
    });

    it('matches by user email', () => {
      expect(orderMatchesSearch(testOrder, 'boulangerie@test.com')).toBe(true);
    });

    it('matches by DBA and legal business name', () => {
      expect(orderMatchesSearch(testOrder, 'Petite Boulangerie')).toBe(true);
      expect(orderMatchesSearch(testOrder, 'Boulangerie LLC')).toBe(true);
    });

    it('matches by user profile full name and nickname', () => {
      expect(orderMatchesSearch(testOrder, 'Pierre Dupont')).toBe(true);
      expect(orderMatchesSearch(testOrder, 'Pierre')).toBe(true);
    });

    it('matches by product name and category name', () => {
      expect(orderMatchesSearch(testOrder, 'Baguette')).toBe(true);
      expect(orderMatchesSearch(testOrder, 'Panadería Tradicional')).toBe(true);
    });

    it('returns false when no fields match query', () => {
      expect(orderMatchesSearch(testOrder, 'completely-unrelated-query-xyz')).toBe(false);
    });

    it('matches checks by check number, bank name, notes, email and order_id', () => {
      const check = {
        check_number: '5544',
        bank_name: 'Bank of America',
        notes: 'Depósito semanal',
        user: { email: 'client@boa.com' },
        order_id: 'ord-boa-1',
      };
      expect(checkMatchesSearch(check, '5544')).toBe(true);
      expect(checkMatchesSearch(check, 'America')).toBe(true);
      expect(checkMatchesSearch(check, 'semanal')).toBe(true);
      expect(checkMatchesSearch(check, 'client@boa.com')).toBe(true);
      expect(checkMatchesSearch(check, 'ord-boa-1')).toBe(true);
      expect(checkMatchesSearch(check, 'nonexistent')).toBe(false);
    });
  });
});
