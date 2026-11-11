import { describe, it, expect } from 'vitest';

export function calculateEffectiveDeliveryFee(params: {
    deliveryType: 'saved' | 'other' | 'pickup';
    isComplementaryOrder: boolean;
    userCustomFee: number;
    logisticsQuoteCost?: number | null;
    contingencyFallback?: number;
}): number {
    const { deliveryType, isComplementaryOrder, userCustomFee, logisticsQuoteCost, contingencyFallback = 15.00 } = params;
    const hasVipFee = userCustomFee > 0;

    if (deliveryType === 'pickup' || isComplementaryOrder) {
        return 0;
    }
    if (hasVipFee) {
        return userCustomFee;
    }
    if (typeof logisticsQuoteCost === 'number') {
        return logisticsQuoteCost;
    }
    return contingencyFallback;
}

describe('Sprint S78 - Delivery Precedence Matrix & Zone Eradication (§48, §6)', () => {
    it('Happy path: client with assigned fixed delivery fee ($50.00) strictly pays fixed fee regardless of mileage quote', () => {
        const fee = calculateEffectiveDeliveryFee({
            deliveryType: 'saved',
            isComplementaryOrder: false,
            userCustomFee: 50.00,
            logisticsQuoteCost: 120.00,
        });
        expect(fee).toBe(50.00);
    });

    it('Happy path: client with no fixed fee (0.00) pays dynamic mileage quote cost', () => {
        const fee = calculateEffectiveDeliveryFee({
            deliveryType: 'saved',
            isComplementaryOrder: false,
            userCustomFee: 0,
            logisticsQuoteCost: 35.50,
        });
        expect(fee).toBe(35.50);
    });

    it('Happy path: pickup order always charges $0.00 even if client has an assigned fixed delivery fee', () => {
        const fee = calculateEffectiveDeliveryFee({
            deliveryType: 'pickup',
            isComplementaryOrder: false,
            userCustomFee: 300.00,
            logisticsQuoteCost: 625.00,
        });
        expect(fee).toBe(0.00);
    });

    it('Happy path: complementary order for same delivery date charges $0.00', () => {
        const fee = calculateEffectiveDeliveryFee({
            deliveryType: 'saved',
            isComplementaryOrder: true,
            userCustomFee: 200.00,
            logisticsQuoteCost: 45.00,
        });
        expect(fee).toBe(0.00);
    });

    it('Sad path §6: client with no fixed fee and unmapped coordinates falls back to contingency fee ($15.00)', () => {
        const fee = calculateEffectiveDeliveryFee({
            deliveryType: 'saved',
            isComplementaryOrder: false,
            userCustomFee: 0,
            logisticsQuoteCost: null,
        });
        expect(fee).toBe(15.00);
    });
});
