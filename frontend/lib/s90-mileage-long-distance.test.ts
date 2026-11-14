import { describe, it, expect } from 'vitest';

export interface LogisticsQuoteMock {
  miles: number;
  cost: number;
  estimatedCost?: number;
  requiresSpecialQuote: boolean;
  notes?: string;
}

export function resolveCheckoutDeliveryFee(params: {
  deliveryType: string;
  isComplementaryOrder: boolean;
  userCustomFee: number;
  logisticsQuote: LogisticsQuoteMock | null;
}): { deliveryFee: number; feeLabel: string; isSpecialQuote: boolean } {
  const { deliveryType, isComplementaryOrder, userCustomFee, logisticsQuote } = params;
  const hasVipFee = userCustomFee > 0;

  if (deliveryType === 'pickup' || isComplementaryOrder) {
    return { deliveryFee: 0, feeLabel: 'Gratis ($0.00)', isSpecialQuote: false };
  }

  if (hasVipFee) {
    const isLongDistance = Boolean(logisticsQuote?.requiresSpecialQuote);
    return {
      deliveryFee: userCustomFee,
      feeLabel: isLongDistance ? '⭐ Tarifa Acordada (Ruta Larga Distancia)' : '⭐ Tarifa Fija Asignada',
      isSpecialQuote: isLongDistance,
    };
  }

  if (logisticsQuote && logisticsQuote.requiresSpecialQuote) {
    const cost = Number(logisticsQuote.cost || 0);
    return {
      deliveryFee: cost,
      feeLabel: '⚠️ Ruta Larga Distancia • Flete a Coordinar',
      isSpecialQuote: true,
    };
  }

  if (logisticsQuote && typeof logisticsQuote.cost === 'number') {
    return {
      deliveryFee: Number(logisticsQuote.cost),
      feeLabel: `Distancia: ${logisticsQuote.miles} mi desde Astoria`,
      isSpecialQuote: false,
    };
  }

  return {
    deliveryFee: 15.00,
    feeLabel: 'Tarifa Estándar',
    isSpecialQuote: false,
  };
}

describe('Sprint S90: Long Distance Delivery & Manual Freight Resolution', () => {
  it('Happy Path: Prevalencia absoluta de tarifa asignada para cliente en ruta larga (ej. Boston $250.00)', () => {
    const result = resolveCheckoutDeliveryFee({
      deliveryType: 'delivery',
      isComplementaryOrder: false,
      userCustomFee: 250.00,
      logisticsQuote: {
        miles: 265,
        cost: 0,
        estimatedCost: 650,
        requiresSpecialQuote: true,
      },
    });

    expect(result.deliveryFee).toBe(250.00);
    expect(result.feeLabel).toBe('⭐ Tarifa Acordada (Ruta Larga Distancia)');
    expect(result.isSpecialQuote).toBe(true);
  });

  it('Happy Path: Ruta > 250 millas sin tarifa asignada marca flete especial manual por cotizar ($0.00 en checkout)', () => {
    const result = resolveCheckoutDeliveryFee({
      deliveryType: 'delivery',
      isComplementaryOrder: false,
      userCustomFee: 0,
      logisticsQuote: {
        miles: 300,
        cost: 0,
        estimatedCost: 750,
        requiresSpecialQuote: true,
      },
    });

    expect(result.deliveryFee).toBe(0);
    expect(result.feeLabel).toContain('⚠️ Ruta Larga Distancia');
    expect(result.isSpecialQuote).toBe(true);
  });

  it('Happy Path: Ruta metropolitana normal (< 250 millas) aplica cotización por millaje estándar', () => {
    const result = resolveCheckoutDeliveryFee({
      deliveryType: 'delivery',
      isComplementaryOrder: false,
      userCustomFee: 0,
      logisticsQuote: {
        miles: 18,
        cost: 60,
        requiresSpecialQuote: false,
      },
    });

    expect(result.deliveryFee).toBe(60);
    expect(result.feeLabel).toContain('18 mi desde Astoria');
    expect(result.isSpecialQuote).toBe(false);
  });

  it('Sad Path (§6): Pickup en planta o pedido complementario siempre anula flete ($0.00) incluso con tarifa VIP', () => {
    const pickupResult = resolveCheckoutDeliveryFee({
      deliveryType: 'pickup',
      isComplementaryOrder: false,
      userCustomFee: 250.00,
      logisticsQuote: { miles: 265, cost: 0, requiresSpecialQuote: true },
    });
    expect(pickupResult.deliveryFee).toBe(0);

    const complementaryResult = resolveCheckoutDeliveryFee({
      deliveryType: 'delivery',
      isComplementaryOrder: true,
      userCustomFee: 250.00,
      logisticsQuote: { miles: 265, cost: 0, requiresSpecialQuote: true },
    });
    expect(complementaryResult.deliveryFee).toBe(0);
  });

  it('Sad Path (§6): Fallback de contingencia ($15.00) cuando no hay coordenadas ni cotización de logística', () => {
    const fallbackResult = resolveCheckoutDeliveryFee({
      deliveryType: 'delivery',
      isComplementaryOrder: false,
      userCustomFee: 0,
      logisticsQuote: null,
    });
    expect(fallbackResult.deliveryFee).toBe(15.00);
    expect(fallbackResult.feeLabel).toBe('Tarifa Estándar');
  });
});
