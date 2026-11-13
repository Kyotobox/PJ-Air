import { describe, it, expect } from 'vitest';
import { 
    calculateOrderFinancials, 
    validateDeliveryFeeOverride,
    type OrderItemCalculationInput 
} from './order-finance';

describe('Sprint S83B: Order Financials and Delivery Fee Override (TASK-83-02)', () => {
    const mockItems: OrderItemCalculationInput[] = [
        { quantity: 2, price_at_time: 15.50 }, // 31.00
        { quantity: 3, price_at_time: 10.00 }, // 30.00
    ]; // Subtotal: 61.00

    describe('calculateOrderFinancials - Happy Paths', () => {
        it('calculates correct itemsTotal without discounts or fees', () => {
            const summary = calculateOrderFinancials(mockItems);
            expect(summary.itemsTotal).toBe(61.00);
            expect(summary.discountAmount).toBe(0);
            expect(summary.deliveryFee).toBe(0);
            expect(summary.grandTotal).toBe(61.00);
        });

        it('calculates total with manual delivery fee override', () => {
            const summary = calculateOrderFinancials(mockItems, { deliveryFee: 25.50 });
            expect(summary.itemsTotal).toBe(61.00);
            expect(summary.deliveryFee).toBe(25.50);
            expect(summary.grandTotal).toBe(86.50);
        });

        it('calculates dynamic total with percentage discount and delivery fee', () => {
            // 61.00 - 10% (6.10) + delivery (15.00) = 69.90
            const summary = calculateOrderFinancials(mockItems, {
                globalDiscountPercentage: 10,
                deliveryFee: 15.00,
            });
            expect(summary.itemsTotal).toBe(61.00);
            expect(summary.discountAmount).toBe(6.10);
            expect(summary.discountPercentage).toBe(10);
            expect(summary.deliveryFee).toBe(15.00);
            expect(summary.grandTotal).toBe(69.90);
        });

        it('calculates total with fixed discount amount, packaging fee and delivery fee', () => {
            // 61.00 - 10.00 (fixed) + (5.00 packaging - 2.00 discount = 3.00) + 12.00 delivery = 66.00
            const summary = calculateOrderFinancials(mockItems, {
                globalDiscountAmount: 10.00,
                packagingFee: 5.00,
                packagingDiscount: 2.00,
                deliveryFee: 12.00,
            });
            expect(summary.itemsTotal).toBe(61.00);
            expect(summary.discountAmount).toBe(10.00);
            expect(summary.netPackagingFee).toBe(3.00);
            expect(summary.deliveryFee).toBe(12.00);
            expect(summary.grandTotal).toBe(66.00);
        });

        it('handles 0.00 delivery fee correctly (pickup or waived delivery)', () => {
            const summary = calculateOrderFinancials(mockItems, { deliveryFee: 0 });
            expect(summary.deliveryFee).toBe(0);
            expect(summary.grandTotal).toBe(61.00);
        });

        it('updates dynamically in real-time when delivery fee is modified from 10 to 35', () => {
            const first = calculateOrderFinancials(mockItems, { deliveryFee: 10 });
            expect(first.grandTotal).toBe(71.00);

            const updated = calculateOrderFinancials(mockItems, { deliveryFee: 35 });
            expect(updated.grandTotal).toBe(96.00);
            expect(updated.grandTotal - first.grandTotal).toBe(25.00);
        });
    });

    describe('calculateOrderFinancials - Boundary & Sad Paths (§6)', () => {
        it('throws explicit error when items parameter is null or undefined (Sad Path 1)', () => {
            expect(() => calculateOrderFinancials(null as any)).toThrowError(
                'La lista de productos del pedido es inválida o no está definida'
            );
            expect(() => calculateOrderFinancials(undefined as any)).toThrowError(
                'La lista de productos del pedido es inválida o no está definida'
            );
        });

        it('handles negative or invalid quantity gracefully without negative subtotal (Sad Path 2)', () => {
            const badItems = [
                { quantity: -5, price_at_time: 20 },
                { quantity: 2, price_at_time: 10 },
            ];
            const summary = calculateOrderFinancials(badItems);
            expect(summary.itemsTotal).toBe(20.00); // Only positive quantity counted
        });

        it('caps grandTotal at zero if discount exceeds items total (Sad Path 3)', () => {
            const summary = calculateOrderFinancials(mockItems, { globalDiscountAmount: 999.99 });
            expect(summary.grandTotal).toBe(0.00);
        });
    });

    describe('validateDeliveryFeeOverride - Validation & Sad Paths (§6)', () => {
        it('validates and formats valid numeric fees (Happy Path)', () => {
            expect(validateDeliveryFeeOverride(15)).toBe(15.00);
            expect(validateDeliveryFeeOverride('24.50')).toBe(24.50);
            expect(validateDeliveryFeeOverride(0)).toBe(0.00);
        });

        it('throws error for empty, null or undefined input (Sad Path 1)', () => {
            expect(() => validateDeliveryFeeOverride(null)).toThrowError(
                'La tarifa de entrega no puede estar vacía'
            );
            expect(() => validateDeliveryFeeOverride(undefined)).toThrowError(
                'La tarifa de entrega no puede estar vacía'
            );
            expect(() => validateDeliveryFeeOverride('')).toThrowError(
                'La tarifa de entrega no puede estar vacía'
            );
        });

        it('throws error for NaN / non-numeric string (Sad Path 2)', () => {
            expect(() => validateDeliveryFeeOverride('abc')).toThrowError(
                'La tarifa de entrega debe ser un número válido'
            );
        });

        it('throws error for negative delivery fee (Sad Path 3)', () => {
            expect(() => validateDeliveryFeeOverride(-10)).toThrowError(
                'La tarifa de entrega no puede ser negativa'
            );
        });

        it('throws error for excessively high delivery fee exceeding limit (Sad Path 4)', () => {
            expect(() => validateDeliveryFeeOverride(15000)).toThrowError(
                'La tarifa de entrega supera el límite máximo permitido ($10,000.00)'
            );
        });
    });
});
