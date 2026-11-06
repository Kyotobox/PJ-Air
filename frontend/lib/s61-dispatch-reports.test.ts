import { describe, it, expect } from 'vitest';
import {
  filterOrdersByDateRange,
  calculateStatementSummary,
  StatementOrder,
} from './b2b-statement-helper';

describe('S61 B2B Account Statement by Dispatch/Delivery Date (§1, §4, §6)', () => {
  const refDate = new Date('2026-11-04T12:00:00Z');

  describe('Happy Path: Delivery Date Primary Accounting Filter', () => {
    it('includes order created on Oct 28 with delivery_date on Nov 3 in November current_month statement', () => {
      const orders: StatementOrder[] = [
        {
          id: 'ord-oct-created-nov-delivered',
          created_at: '2026-10-28T18:30:00Z',
          delivery_date: '2026-11-03',
          total: 420.0,
          payment_status: 'paid',
          payment_method: 'check',
        },
        {
          id: 'ord-oct-created-oct-delivered',
          created_at: '2026-10-25T10:00:00Z',
          delivery_date: '2026-10-29',
          total: 250.0,
          payment_status: 'paid',
          payment_method: 'credit',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ord-oct-created-nov-delivered');
    });

    it('excludes order created in November whose delivery_date is scheduled for December', () => {
      const orders: StatementOrder[] = [
        {
          id: 'ord-nov-created-dec-delivered',
          created_at: '2026-11-02T09:00:00Z',
          delivery_date: '2026-12-05',
          total: 800.0,
          payment_status: 'pending',
          payment_method: 'credit',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      expect(filtered).toHaveLength(0);
    });

    it('correctly filters orders in last_30_days range based on delivery_date', () => {
      const orders: StatementOrder[] = [
        {
          id: 'ord-delivered-5-days-ago',
          created_at: '2026-09-20T10:00:00Z',
          delivery_date: '2026-10-30',
          total: 310.0,
          payment_status: 'paid',
        },
        {
          id: 'ord-delivered-40-days-ago',
          created_at: '2026-09-10T10:00:00Z',
          delivery_date: '2026-09-22',
          total: 190.0,
          payment_status: 'paid',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'last_30_days', refDate);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ord-delivered-5-days-ago');
    });
  });

  describe('Fallback: created_at when delivery_date is absent', () => {
    it('falls back to created_at when delivery_date is undefined', () => {
      const orders: StatementOrder[] = [
        {
          id: 'ord-no-delivery-nov',
          created_at: '2026-11-01T14:00:00Z',
          total: 150.0,
          payment_status: 'paid',
        },
        {
          id: 'ord-no-delivery-oct',
          created_at: '2026-10-15T14:00:00Z',
          total: 200.0,
          payment_status: 'paid',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ord-no-delivery-nov');
    });

    it('falls back to created_at when delivery_date is empty string or null', () => {
      const orders: any[] = [
        {
          id: 'ord-empty-delivery',
          created_at: '2026-11-02T11:00:00Z',
          delivery_date: '',
          total: 175.0,
          payment_status: 'pending',
        },
        {
          id: 'ord-null-delivery',
          created_at: '2026-11-03T11:00:00Z',
          delivery_date: null,
          total: 225.0,
          payment_status: 'paid',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((o) => o.id)).toEqual(['ord-empty-delivery', 'ord-null-delivery']);
    });
  });

  describe('Sad Paths (§6 Mandatorio)', () => {
    it('Sad Path 1: handles empty array safely returning empty array', () => {
      const filtered = filterOrdersByDateRange([], 'current_month', refDate);
      expect(filtered).toEqual([]);
      expect(filtered).toHaveLength(0);
    });

    it('Sad Path 2: handles non-array input (null / undefined) safely without throwing', () => {
      expect(filterOrdersByDateRange(null as any, 'current_month', refDate)).toEqual([]);
      expect(filterOrdersByDateRange(undefined as any, 'current_month', refDate)).toEqual([]);
    });

    it('Sad Path 3: filters out orders with null or undefined dates completely', () => {
      const badOrders: any[] = [
        { id: 'bad-null-all', created_at: null, delivery_date: null, total: 100 },
        { id: 'bad-undefined-all', created_at: undefined, delivery_date: undefined, total: 200 },
        null,
        undefined,
      ];

      const filtered = filterOrdersByDateRange(badOrders, 'current_month', refDate);
      expect(filtered).toHaveLength(0);
    });

    it('Sad Path 4: filters out orders with corrupt/unparseable created_at and no delivery_date', () => {
      const corruptOrders: any[] = [
        { id: 'corrupt-1', created_at: 'garbage-date-string', total: 100 },
        { id: 'corrupt-2', created_at: '2026-99-99', total: 200 },
        { id: 'corrupt-3', created_at: '', total: 300 },
      ];

      const filtered = filterOrdersByDateRange(corruptOrders, 'current_month', refDate);
      expect(filtered).toHaveLength(0);
    });

    it('Sad Path 5: handles mal-formatted delivery_date by filtering out if created_at is also corrupt', () => {
      const malformattedOrders: any[] = [
        {
          id: 'malformatted-both',
          delivery_date: 'invalid-delivery-date',
          created_at: 'also-not-a-date',
          total: 500,
        },
        {
          id: 'malformatted-no-created',
          delivery_date: '###MAL_FORMAT###',
          total: 500,
        },
      ];

      const filtered = filterOrdersByDateRange(malformattedOrders, 'current_month', refDate);
      expect(filtered).toHaveLength(0);
    });

    it('Sad Path 6: falls back safely to created_at if delivery_date is mal-formatted but created_at is valid', () => {
      const orders: any[] = [
        {
          id: 'ord-malformatted-delivery-valid-created',
          delivery_date: 'NOT_A_VALID_DATE',
          created_at: '2026-11-02T10:00:00Z',
          total: 350,
          payment_status: 'paid',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('ord-malformatted-delivery-valid-created');
    });
  });

  describe('Integration with Statement Financial Calculations', () => {
    it('calculates correct financials on dispatch-date-filtered orders', () => {
      const orders: StatementOrder[] = [
        {
          id: 'ord-nov-delivery-paid',
          created_at: '2026-10-27T10:00:00Z',
          delivery_date: '2026-11-01',
          total: 600.0,
          refunded_amount: 50.0,
          payment_status: 'paid',
        },
        {
          id: 'ord-nov-delivery-pending',
          created_at: '2026-10-31T20:00:00Z',
          delivery_date: '2026-11-02',
          total: 400.0,
          refunded_amount: 0,
          payment_status: 'pending',
        },
      ];

      const filtered = filterOrdersByDateRange(orders, 'current_month', refDate);
      const summary = calculateStatementSummary(filtered);

      // ord 1: 600 - 50 = 550 net (paid)
      // ord 2: 400 - 0 = 400 net (pending)
      // Total invoiced: 950, Paid: 550, Pending: 400
      expect(summary.totalInvoiced).toBe(950.0);
      expect(summary.totalPaid).toBe(550.0);
      expect(summary.totalPending).toBe(400.0);
      expect(summary.ordersCount).toBe(2);
    });
  });
});
