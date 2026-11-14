import { describe, it, expect } from 'vitest';

export interface ZellePaymentOrderPayload {
  zelle_enabled: boolean;
  zelle_reference: string | null;
  isAdmin?: boolean;
}

export function validateZellePaymentOrder(payload: ZellePaymentOrderPayload): { valid: boolean } {
  if (!payload.zelle_enabled && !payload.isAdmin) {
    throw new Error('El método de pago Zelle no está habilitado para esta cuenta');
  }

  if (!payload.zelle_reference || !payload.zelle_reference.trim()) {
    throw new Error('El número de referencia o confirmación de Zelle es obligatorio');
  }

  return { valid: true };
}

export interface DeliveryFeeCalculationInput {
  free_delivery_enabled?: boolean;
  waive_delivery_fee?: boolean;
  is_pickup?: boolean;
  user_delivery_fee?: number | null;
  mileage_quote?: number;
}

export function calculateCheckoutDeliveryFee(input: DeliveryFeeCalculationInput): number {
  if (input.free_delivery_enabled || input.waive_delivery_fee || input.is_pickup) {
    return 0.00;
  }
  if (input.user_delivery_fee !== null && input.user_delivery_fee !== undefined && input.user_delivery_fee > 0) {
    return Number(input.user_delivery_fee);
  }
  const base = input.mileage_quote !== undefined ? Number(input.mileage_quote) : 15.00;
  return isNaN(base) || base < 0 ? 0 : base;
}

describe('Sprint S94: Zelle B2B Control & Dual Free Delivery Engine (TASK-94-01 & TASK-94-02) (§4, §6)', () => {
  describe('Zelle Validation', () => {
    it('Happy Path: validates order with zelle when client has zelle_enabled: true and reference', () => {
      const res = validateZellePaymentOrder({
        zelle_enabled: true,
        zelle_reference: 'ZEL-CONF-889900',
      });
      expect(res.valid).toBe(true);
    });

    it('Sad Path 1 (§6): throws when client does not have zelle_enabled: true', () => {
      expect(() =>
        validateZellePaymentOrder({
          zelle_enabled: false,
          zelle_reference: 'ZEL-CONF-889900',
        })
      ).toThrow(/El método de pago Zelle no está habilitado para esta cuenta/i);
    });

    it('Sad Path 2 (§6): throws when zelle reference is missing or empty', () => {
      expect(() =>
        validateZellePaymentOrder({
          zelle_enabled: true,
          zelle_reference: '   ',
        })
      ).toThrow(/El número de referencia o confirmación de Zelle es obligatorio/i);
    });

    it('Happy Path: allows admin to bypass client zelle_enabled flag', () => {
      const res = validateZellePaymentOrder({
        zelle_enabled: false,
        zelle_reference: 'ZEL-ADMIN-OVERRIDE',
        isAdmin: true,
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Dual Free Delivery Engine', () => {
    it('Happy Path: applies $0.00 delivery fee when client has permanent free_delivery_enabled: true', () => {
      const fee = calculateCheckoutDeliveryFee({
        free_delivery_enabled: true,
        user_delivery_fee: 55,
        mileage_quote: 60,
      });
      expect(fee).toBe(0.00);
    });

    it('Happy Path: applies $0.00 delivery fee when order has punctual waive_delivery_fee: true', () => {
      const fee = calculateCheckoutDeliveryFee({
        free_delivery_enabled: false,
        waive_delivery_fee: true,
        user_delivery_fee: 40,
      });
      expect(fee).toBe(0.00);
    });

    it('Happy Path: returns client specific delivery fee when neither free delivery flag is active', () => {
      const fee = calculateCheckoutDeliveryFee({
        free_delivery_enabled: false,
        waive_delivery_fee: false,
        user_delivery_fee: 35,
      });
      expect(fee).toBe(35.00);
    });

    it('Sad Path 3 (§6): handles negative and invalid delivery fee safely by normalizing to 0', () => {
      const fee = calculateCheckoutDeliveryFee({
        free_delivery_enabled: false,
        mileage_quote: -20,
      });
      expect(fee).toBe(0.00);
    });
  });
});
