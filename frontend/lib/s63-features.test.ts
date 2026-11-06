import { describe, it, expect } from 'vitest';
import {
    calculateStoreCredit,
    detectComplementaryOrder,
    updateClientStatusInList,
    formatStoreCreditBannerMessage,
    StoreCreditCalculationInput,
    ComplementaryOrderInput,
    ClientRecord,
} from './s63-features';

describe('S63 Certification Suite (TASK-63-01, TASK-63-03, TASK-63-04, TASK-63-07)', () => {

    // =========================================================================
    // TASK-63-03: Store Credit & Wallet Calculation Tests
    // =========================================================================
    describe('calculateStoreCredit - Saldo a Favor / Store Credit Wallet Logic', () => {
        it('covers 100% of order total when available credit exceeds order amount (Happy Path)', () => {
            const input: StoreCreditCalculationInput = {
                grossAmount: 120.00,
                storeCreditAvailable: 200.00,
                applyCredit: true,
            };
            const result = calculateStoreCredit(input);

            expect(result.applied).toBe(120.00);
            expect(result.finalTotal).toBe(0.00);
            expect(result.isPaidWithStoreCredit).toBe(true);
            expect(result.remainingStoreCredit).toBe(80.00);
        });

        it('covers partial order total when available credit is less than order amount (Happy Path)', () => {
            const input: StoreCreditCalculationInput = {
                grossAmount: 350.50,
                storeCreditAvailable: 100.00,
                applyCredit: true,
            };
            const result = calculateStoreCredit(input);

            expect(result.applied).toBe(100.00);
            expect(result.finalTotal).toBe(250.50);
            expect(result.isPaidWithStoreCredit).toBe(false);
            expect(result.remainingStoreCredit).toBe(0.00);
        });

        it('covers exact order amount when credit equals total (Boundary Happy Path)', () => {
            const input: StoreCreditCalculationInput = {
                grossAmount: 85.25,
                storeCreditAvailable: 85.25,
                applyCredit: true,
            };
            const result = calculateStoreCredit(input);

            expect(result.applied).toBe(85.25);
            expect(result.finalTotal).toBe(0.00);
            expect(result.isPaidWithStoreCredit).toBe(true);
            expect(result.remainingStoreCredit).toBe(0.00);
        });

        it('does not apply credit when user unchecks applyCredit option', () => {
            const input: StoreCreditCalculationInput = {
                grossAmount: 150.00,
                storeCreditAvailable: 50.00,
                applyCredit: false,
            };
            const result = calculateStoreCredit(input);

            expect(result.applied).toBe(0.00);
            expect(result.finalTotal).toBe(150.00);
            expect(result.isPaidWithStoreCredit).toBe(false);
            expect(result.remainingStoreCredit).toBe(50.00);
        });

        it('handles zero store credit balance smoothly', () => {
            const input: StoreCreditCalculationInput = {
                grossAmount: 90.00,
                storeCreditAvailable: 0.00,
                applyCredit: true,
            };
            const result = calculateStoreCredit(input);

            expect(result.applied).toBe(0.00);
            expect(result.finalTotal).toBe(90.00);
            expect(result.isPaidWithStoreCredit).toBe(false);
            expect(result.remainingStoreCredit).toBe(0.00);
        });

        // --- Sad Paths (§6) ---
        it('throws error when gross amount is negative (Sad Path)', () => {
            expect(() =>
                calculateStoreCredit({
                    grossAmount: -25.00,
                    storeCreditAvailable: 50.00,
                })
            ).toThrow('Gross amount cannot be negative');
        });

        it('throws error when store credit balance is negative (Sad Path)', () => {
            expect(() =>
                calculateStoreCredit({
                    grossAmount: 100.00,
                    storeCreditAvailable: -10.00,
                })
            ).toThrow('Store credit available cannot be negative');
        });

        it('throws error when gross amount is NaN or undefined (Sad Path)', () => {
            expect(() =>
                calculateStoreCredit({
                    grossAmount: NaN,
                    storeCreditAvailable: 50.00,
                })
            ).toThrow('Gross amount must be a valid number');

            expect(() =>
                calculateStoreCredit({
                    grossAmount: undefined as any,
                    storeCreditAvailable: 50.00,
                })
            ).toThrow('Gross amount must be a valid number');
        });

        it('throws error when store credit available is NaN or null (Sad Path)', () => {
            expect(() =>
                calculateStoreCredit({
                    grossAmount: 100.00,
                    storeCreditAvailable: null as any,
                })
            ).toThrow('Store credit available must be a valid number');
        });
    });

    // =========================================================================
    // TASK-63-04: Complementary Order Detection ($0 Delivery Fee) Tests
    // =========================================================================
    describe('detectComplementaryOrder - Complementary Order $0 Delivery Fee Logic', () => {
        const sampleOrders = [
            {
                id: 'ord-101',
                delivery_date: '2026-11-15T10:00:00.000Z',
                status: 'paid',
                address_id: 'addr-01',
            },
            {
                id: 'ord-102',
                delivery_date: '2026-11-20T10:00:00.000Z',
                status: 'pending',
                address_id: 'addr-02',
            },
            {
                id: 'ord-103',
                delivery_date: '2026-11-25T10:00:00.000Z',
                status: 'cancelled',
                address_id: 'addr-01',
            },
        ];

        it('waives delivery fee to $0.00 when active order exists on same delivery date (Happy Path)', () => {
            const input: ComplementaryOrderInput = {
                existingOrders: sampleOrders,
                targetDeliveryDate: '2026-11-15',
                targetAddressId: 'addr-01',
                baseDeliveryFee: 15.00,
            };
            const result = detectComplementaryOrder(input);

            expect(result.isComplementary).toBe(true);
            expect(result.deliveryFee).toBe(0.00);
            expect(result.note).toBe('Complementario a orden existente');
            expect(result.matchedOrderId).toBe('ord-101');
        });

        it('waives delivery fee even when date has ISO timestamp format (Happy Path)', () => {
            const input: ComplementaryOrderInput = {
                existingOrders: sampleOrders,
                targetDeliveryDate: '2026-11-20T08:30:00.000Z',
                targetAddressId: 'addr-02',
                baseDeliveryFee: 20.00,
            };
            const result = detectComplementaryOrder(input);

            expect(result.isComplementary).toBe(true);
            expect(result.deliveryFee).toBe(0.00);
            expect(result.note).toBe('Complementario a orden existente');
            expect(result.matchedOrderId).toBe('ord-102');
        });

        it('charges standard delivery fee when no orders match the date', () => {
            const input: ComplementaryOrderInput = {
                existingOrders: sampleOrders,
                targetDeliveryDate: '2026-11-16',
                targetAddressId: 'addr-01',
                baseDeliveryFee: 15.00,
            };
            const result = detectComplementaryOrder(input);

            expect(result.isComplementary).toBe(false);
            expect(result.deliveryFee).toBe(15.00);
            expect(result.note).toBeNull();
        });

        it('ignores cancelled orders on the same delivery date and charges delivery fee', () => {
            const input: ComplementaryOrderInput = {
                existingOrders: sampleOrders,
                targetDeliveryDate: '2026-11-25',
                targetAddressId: 'addr-01',
                baseDeliveryFee: 15.00,
            };
            const result = detectComplementaryOrder(input);

            expect(result.isComplementary).toBe(false);
            expect(result.deliveryFee).toBe(15.00);
            expect(result.note).toBeNull();
        });

        it('charges delivery fee when targetDeliveryDate is null or undefined', () => {
            const input: ComplementaryOrderInput = {
                existingOrders: sampleOrders,
                targetDeliveryDate: null,
                baseDeliveryFee: 15.00,
            };
            const result = detectComplementaryOrder(input);

            expect(result.isComplementary).toBe(false);
            expect(result.deliveryFee).toBe(15.00);
            expect(result.note).toBeNull();
        });

        // --- Sad Paths (§6) ---
        it('throws error when base delivery fee is negative (Sad Path)', () => {
            expect(() =>
                detectComplementaryOrder({
                    existingOrders: sampleOrders,
                    targetDeliveryDate: '2026-11-15',
                    baseDeliveryFee: -5.00,
                })
            ).toThrow('Base delivery fee cannot be negative');
        });

        it('throws error when base delivery fee is NaN or null (Sad Path)', () => {
            expect(() =>
                detectComplementaryOrder({
                    existingOrders: sampleOrders,
                    targetDeliveryDate: '2026-11-15',
                    baseDeliveryFee: NaN,
                })
            ).toThrow('Base delivery fee must be a valid number');
        });

        it('throws error when existingOrders is not an array (Sad Path)', () => {
            expect(() =>
                detectComplementaryOrder({
                    existingOrders: null as any,
                    targetDeliveryDate: '2026-11-15',
                    baseDeliveryFee: 15.00,
                })
            ).toThrow('Existing orders must be an array');
        });
    });

    // =========================================================================
    // TASK-63-01: Admin Client Status Toggle Tests
    // =========================================================================
    describe('updateClientStatusInList - Client Active/Inactive State Management', () => {
        const clientList: ClientRecord[] = [
            { id: 'usr-1', name: 'Panadería Central', email: 'panaderia@example.com', is_active: true },
            { id: 'usr-2', name: 'Café Del Sol', email: 'delsol@example.com', is_active: true },
            { id: 'usr-3', name: 'Bodega Latina', email: 'bodega@example.com', is_active: false },
        ];

        it('toggles client from active to inactive (Happy Path)', () => {
            const updated = updateClientStatusInList(clientList, 'usr-1', false);

            expect(updated[0].is_active).toBe(false);
            expect(updated[1].is_active).toBe(true); // Untouched
            expect(clientList[0].is_active).toBe(true); // Original list is immutable
        });

        it('toggles client from inactive to active (Happy Path)', () => {
            const updated = updateClientStatusInList(clientList, 'usr-3', true);

            expect(updated[2].is_active).toBe(true);
            expect(clientList[2].is_active).toBe(false); // Original list is immutable
        });

        // --- Sad Paths (§6) ---
        it('throws error when client ID is not found in list (Sad Path)', () => {
            expect(() =>
                updateClientStatusInList(clientList, 'usr-999', false)
            ).toThrow('Client with ID "usr-999" not found in list');
        });

        it('throws error when new active status is not a boolean (Sad Path)', () => {
            expect(() =>
                updateClientStatusInList(clientList, 'usr-1', 'inactive' as any)
            ).toThrow('New active status must be a boolean');
        });

        it('throws error when client ID is missing or empty (Sad Path)', () => {
            expect(() =>
                updateClientStatusInList(clientList, '', false)
            ).toThrow('Client ID is required');

            expect(() =>
                updateClientStatusInList(clientList, null as any, false)
            ).toThrow('Client ID is required');
        });

        it('throws error when clients argument is not an array (Sad Path)', () => {
            expect(() =>
                updateClientStatusInList('not-an-array' as any, 'usr-1', false)
            ).toThrow('Clients must be an array');
        });
    });

    // =========================================================================
    // TASK-63-03: Store Credit Banner Formatter Tests
    // =========================================================================
    describe('formatStoreCreditBannerMessage - Banner Text Formatting', () => {
        it('formats banner in Spanish correctly (Happy Path)', () => {
            const msg = formatStoreCreditBannerMessage(45.50, 'es');
            expect(msg).toBe('Tienes $45.50 de Saldo a Favor disponible');
        });

        it('formats banner in English correctly (Happy Path)', () => {
            const msg = formatStoreCreditBannerMessage(125.00, 'en');
            expect(msg).toBe('You have $125.00 of Store Credit available');
        });

        // --- Sad Paths (§6) ---
        it('throws error when credit balance is negative (Sad Path)', () => {
            expect(() => formatStoreCreditBannerMessage(-5.00, 'es')).toThrow(
                'Store credit balance must be a non-negative number'
            );
        });

        it('throws error when credit balance is NaN (Sad Path)', () => {
            expect(() => formatStoreCreditBannerMessage(NaN, 'es')).toThrow(
                'Store credit balance must be a non-negative number'
            );
        });
    });

    // =========================================================================
    // End-to-End Dynamic Breakdown Formula Consistency
    // =========================================================================
    describe('Dynamic Fee Breakdown & Store Credit Consistency', () => {
        it('satisfies Subtotal + Delivery + Fee - StoreCredit = FinalTotal', () => {
            const subtotal = 300.00;
            const deliveryFee = 0.00; // Complementary order ($0)
            const processingFee = 0.00; // ACH or Zelle (0%)
            const gross = subtotal + deliveryFee + processingFee;
            const storeCredit = 75.00;

            const creditRes = calculateStoreCredit({
                grossAmount: gross,
                storeCreditAvailable: storeCredit,
                applyCredit: true,
            });

            expect(creditRes.applied).toBe(75.00);
            expect(creditRes.finalTotal).toBe(225.00);

            const calculatedTotal = subtotal + deliveryFee + processingFee - creditRes.applied;
            expect(calculatedTotal).toBe(creditRes.finalTotal);
        });
    });
});
