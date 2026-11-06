/**
 * S63 Business Logic & Feature Utilities
 * - Store Credit Calculation & Wallet Application (TASK-63-03)
 * - Complementary Order Detection ($0 Delivery Fee) (TASK-63-04)
 * - Client Inactive/Active State Management (TASK-63-01)
 */

export interface StoreCreditCalculationInput {
    grossAmount: number;
    storeCreditAvailable: number;
    applyCredit?: boolean;
}

export interface StoreCreditCalculationResult {
    applied: number;
    finalTotal: number;
    isPaidWithStoreCredit: boolean;
    remainingStoreCredit: number;
}

export interface ComplementaryOrderInput {
    existingOrders: Array<{
        id: string | number;
        delivery_date?: string | null;
        status?: string;
        address_id?: string | null;
        destination?: string | null;
    }>;
    targetDeliveryDate?: string | null;
    targetAddressId?: string | null;
    baseDeliveryFee: number;
}

export interface ComplementaryOrderResult {
    isComplementary: boolean;
    deliveryFee: number;
    note: string | null;
    matchedOrderId?: string | number;
}

export interface ClientRecord {
    id: string | number;
    name?: string;
    email?: string;
    is_active?: boolean;
    [key: string]: any;
}

/**
 * Calculates store credit deduction against order gross total.
 * Throws on invalid negative inputs (§6 sad path).
 */
export function calculateStoreCredit(
    input: StoreCreditCalculationInput
): StoreCreditCalculationResult {
    if (input.grossAmount === null || input.grossAmount === undefined || isNaN(input.grossAmount)) {
        throw new Error('Gross amount must be a valid number');
    }
    if (input.grossAmount < 0) {
        throw new Error('Gross amount cannot be negative');
    }
    if (
        input.storeCreditAvailable === null ||
        input.storeCreditAvailable === undefined ||
        isNaN(input.storeCreditAvailable)
    ) {
        throw new Error('Store credit available must be a valid number');
    }
    if (input.storeCreditAvailable < 0) {
        throw new Error('Store credit available cannot be negative');
    }

    const apply = input.applyCredit !== false;
    const available = Number(input.storeCreditAvailable.toFixed(2));
    const gross = Number(input.grossAmount.toFixed(2));

    if (!apply || available <= 0 || gross === 0) {
        return {
            applied: 0,
            finalTotal: gross,
            isPaidWithStoreCredit: false,
            remainingStoreCredit: available,
        };
    }

    const applied = Number(Math.min(gross, available).toFixed(2));
    const finalTotal = Number(Math.max(0, gross - applied).toFixed(2));
    const remainingStoreCredit = Number((available - applied).toFixed(2));
    const isPaidWithStoreCredit = finalTotal === 0 && gross > 0;

    return {
        applied,
        finalTotal,
        isPaidWithStoreCredit,
        remainingStoreCredit,
    };
}

/**
 * Normalizes date strings to YYYY-MM-DD for comparison.
 */
function normalizeDate(d?: string | null): string {
    if (!d || typeof d !== 'string') return '';
    return d.split('T')[0].trim();
}

/**
 * Detects if a customer already has an active order scheduled for the same delivery date.
 * If yes, waives delivery fee ($0.00) and marks as complementary.
 */
export function detectComplementaryOrder(
    input: ComplementaryOrderInput
): ComplementaryOrderResult {
    if (input.baseDeliveryFee === null || input.baseDeliveryFee === undefined || isNaN(input.baseDeliveryFee)) {
        throw new Error('Base delivery fee must be a valid number');
    }
    if (input.baseDeliveryFee < 0) {
        throw new Error('Base delivery fee cannot be negative');
    }
    if (!input.existingOrders || !Array.isArray(input.existingOrders)) {
        throw new Error('Existing orders must be an array');
    }

    const targetDate = normalizeDate(input.targetDeliveryDate);
    if (!targetDate) {
        return {
            isComplementary: false,
            deliveryFee: Number(input.baseDeliveryFee.toFixed(2)),
            note: null,
        };
    }

    const activeOrders = input.existingOrders.filter((order) => {
        if (!order) return false;
        const status = (order.status || '').toLowerCase().trim();
        return status !== 'cancelled' && status !== 'rejected' && status !== 'refunded';
    });

    const matchingOrder = activeOrders.find((order) => {
        const orderDate = normalizeDate(order.delivery_date);
        if (orderDate !== targetDate) return false;

        if (input.targetAddressId && order.address_id) {
            return String(order.address_id) === String(input.targetAddressId);
        }

        return true;
    });

    if (matchingOrder) {
        return {
            isComplementary: true,
            deliveryFee: 0.0,
            note: 'Complementario a orden existente',
            matchedOrderId: matchingOrder.id,
        };
    }

    return {
        isComplementary: false,
        deliveryFee: Number(input.baseDeliveryFee.toFixed(2)),
        note: null,
    };
}

/**
 * Updates client is_active status in an immutable client list.
 * Throws if client not found or arguments are invalid (§6 sad path).
 */
export function updateClientStatusInList<T extends ClientRecord>(
    clients: T[],
    clientId: string | number,
    newActiveStatus: boolean
): T[] {
    if (!Array.isArray(clients)) {
        throw new Error('Clients must be an array');
    }
    if (clientId === null || clientId === undefined || clientId === '') {
        throw new Error('Client ID is required');
    }
    if (typeof newActiveStatus !== 'boolean') {
        throw new Error('New active status must be a boolean');
    }

    const clientIndex = clients.findIndex((c) => String(c.id) === String(clientId));
    if (clientIndex === -1) {
        throw new Error(`Client with ID "${clientId}" not found in list`);
    }

    const updated = [...clients];
    updated[clientIndex] = {
        ...updated[clientIndex],
        is_active: newActiveStatus,
    };
    return updated;
}

/**
 * Formats user-facing store credit banner message.
 */
export function formatStoreCreditBannerMessage(
    creditBalance: number,
    locale: 'es' | 'en' = 'es'
): string {
    if (creditBalance === null || creditBalance === undefined || isNaN(creditBalance) || creditBalance < 0) {
        throw new Error('Store credit balance must be a non-negative number');
    }
    const formatted = creditBalance.toFixed(2);
    if (locale === 'en') {
        return `You have $${formatted} of Store Credit available`;
    }
    return `Tienes $${formatted} de Saldo a Favor disponible`;
}
