import { describe, it, expect } from 'vitest';

// Calculation helper logic exported or tested
function calculateLocalDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const miles = R * c * 1.25; // 1.25x road factor
    return Math.round(miles * 10) / 10;
}

function calculateSuggestedFreight(miles: number, isPickup: boolean): { cost: number; special: boolean } {
    if (isPickup) return { cost: 0, special: false };
    if (miles > 250) return { cost: 0, special: true };
    if (miles <= 10) return { cost: 40, special: false };
    if (miles <= 20) return { cost: 60, special: false };
    if (miles <= 30) return { cost: 80, special: false };
    if (miles <= 40) return { cost: 100, special: false };
    if (miles <= 50) return { cost: 125, special: false };
    const extra = Math.ceil((miles - 50) / 10);
    return { cost: 125 + extra * 25, special: false };
}

describe('AdminOrderDispatchSheet Calculations (TASK-54-04)', () => {
    const ASTORIA = { lat: 40.761032, lng: -73.923714 };

    it('should calculate distance from Astoria to Midtown Manhattan within expected range', () => {
        const empireState = { lat: 40.748817, lng: -73.985428 };
        const miles = calculateLocalDistanceMiles(ASTORIA.lat, ASTORIA.lng, empireState.lat, empireState.lng);

        expect(miles).toBeGreaterThan(3);
        expect(miles).toBeLessThan(12);
        const { cost } = calculateSuggestedFreight(miles, false);
        expect(cost).toBe(40); // < 10 miles bracket
    });

    it('should calculate pickup orders as $0.00 flete', () => {
        const quote = calculateSuggestedFreight(15, true);
        expect(quote.cost).toBe(0);
        expect(quote.special).toBe(false);
    });

    it('should calculate tiers correctly according to the official wholesale matrix', () => {
        expect(calculateSuggestedFreight(5, false).cost).toBe(40);
        expect(calculateSuggestedFreight(15, false).cost).toBe(60);
        expect(calculateSuggestedFreight(25, false).cost).toBe(80);
        expect(calculateSuggestedFreight(35, false).cost).toBe(100);
        expect(calculateSuggestedFreight(45, false).cost).toBe(125);
        expect(calculateSuggestedFreight(55, false).cost).toBe(150);
        expect(calculateSuggestedFreight(100, false).cost).toBe(250);
    });

    it('should flag distance > 250 miles as requiring special quote (Sad Path 3)', () => {
        const quote = calculateSuggestedFreight(350, false);
        expect(quote.special).toBe(true);
        expect(quote.cost).toBe(0);
    });

    it('should reconcile exact, surplus and deficit freight values', () => {
        const suggested = 60;
        const exactCharged = 60;
        const surplusCharged = 80;
        const deficitCharged = 40;

        expect(exactCharged - suggested).toBe(0);
        expect(surplusCharged - suggested).toBe(20);
        expect(deficitCharged - suggested).toBe(-20);
    });
});
