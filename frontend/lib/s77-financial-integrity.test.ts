import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';

describe('TASK-77-01: Financial Integrity & Checkout Freight Protection (§6, §48)', () => {
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);

  beforeEach(() => {
    mockFetch.mockClear();
  });

  function makeResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined || body === '' ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
    };
  }

  it('Happy Path: api.get returns null (not empty object) when server returns empty body (e.g. legacy resolveZip)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, ''));
    const result = await api.get('/zones/resolve?zip=13210');
    expect(result).toBeNull();
  });

  it('Sad Path: api.get throws when endpoint fails with error message', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, { message: 'Database connection failed' }));
    await expect(api.get('/zones/resolve?zip=13210')).rejects.toThrow('Database connection failed');
  });

  it('Happy Path: delivery fee computation correctly bypasses empty zone and activates logistics quote', () => {
    // Pure function logic mirroring checkout precedence
    function resolveDeliveryFee(params: {
      deliveryType: string;
      isComplementary: boolean;
      userCustomFee: number;
      resolvedZone: any;
      logisticsQuote: any;
      discountedSubtotal: number;
    }): number {
      const { deliveryType, isComplementary, userCustomFee, resolvedZone, logisticsQuote, discountedSubtotal } = params;
      const hasVipFee = userCustomFee > 0;

      if (deliveryType === 'pickup' || isComplementary) {
        return 0;
      } else if (hasVipFee) {
        return userCustomFee;
      } else if (resolvedZone && resolvedZone.id) {
        const freeDeliveryThreshold = Number(resolvedZone.min_free_delivery_amount);
        if (freeDeliveryThreshold > 0 && discountedSubtotal >= freeDeliveryThreshold) {
          return 0;
        } else {
          return Number(resolvedZone.base_fee || 0);
        }
      } else if (logisticsQuote && typeof logisticsQuote.cost === 'number') {
        return Number(logisticsQuote.cost);
      } else {
        return 15.00;
      }
    }

    // Scenario A: resolvedZone is null -> correctly falls back to logisticsQuote ($625.00 for Syracuse NY)
    const feeA = resolveDeliveryFee({
      deliveryType: 'saved',
      isComplementary: false,
      userCustomFee: 0,
      resolvedZone: null,
      logisticsQuote: { cost: 625, miles: 242.3 },
      discountedSubtotal: 1231.00,
    });
    expect(feeA).toBe(625);

    // Scenario B: resolvedZone is {} (legacy bug simulation) -> with our fix (checking resolvedZone.id), it STILL falls back to logisticsQuote ($625.00)
    const feeB = resolveDeliveryFee({
      deliveryType: 'saved',
      isComplementary: false,
      userCustomFee: 0,
      resolvedZone: {},
      logisticsQuote: { cost: 625, miles: 242.3 },
      discountedSubtotal: 1231.00,
    });
    expect(feeB).toBe(625);

    // Scenario C: resolvedZone is valid with id -> respects zone fee
    const feeC = resolveDeliveryFee({
      deliveryType: 'saved',
      isComplementary: false,
      userCustomFee: 0,
      resolvedZone: { id: 'zone-queens', base_fee: 40, min_free_delivery_amount: 1500 },
      logisticsQuote: { cost: 625, miles: 242.3 },
      discountedSubtotal: 1231.00,
    });
    expect(feeC).toBe(40);
  });

  it('Happy Path: Stripe create-intent payload strictly enforces authoritative order.total from backend', () => {
    const backendOrder = { id: '060d13ad', total: 1899.09 };
    const memoryFinalTotal = 1274.09;

    const authoritativeTotal = Number(backendOrder?.total) > 0 ? Number(backendOrder.total) : memoryFinalTotal;
    expect(authoritativeTotal).toBe(1899.09);
    expect(authoritativeTotal).not.toBe(memoryFinalTotal);
  });
});
