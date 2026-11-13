/**
 * Order Financial & Delivery Fee Calculation Engine (TASK-83-02 / Sprint S83B)
 * Centralizes calculation for order subtotal, discount, packaging fee, and manual delivery fee override.
 */

export interface OrderFinancialSummary {
    itemsTotal: number;
    discountAmount: number;
    discountPercentage?: number;
    packagingFee: number;
    packagingDiscount: number;
    netPackagingFee: number;
    deliveryFee: number;
    grandTotal: number;
}

export interface OrderItemCalculationInput {
    quantity: number;
    price_at_time?: number;
    price?: number;
}

export interface OrderCalculationOptions {
    globalDiscountPercentage?: number | null;
    globalDiscountAmount?: number | null;
    packagingFee?: number | null;
    packagingDiscount?: number | null;
    deliveryFee?: number | null;
}

/**
 * Validates and normalizes manual delivery fee override inputs.
 * Throws explicit errors for sad paths (§6).
 */
export function validateDeliveryFeeOverride(fee: unknown): number {
    if (fee === null || fee === undefined || fee === '') {
        throw new Error('La tarifa de entrega no puede estar vacía');
    }
    const num = Number(fee);
    if (isNaN(num)) {
        throw new Error('La tarifa de entrega debe ser un número válido');
    }
    if (num < 0) {
        throw new Error('La tarifa de entrega no puede ser negativa');
    }
    if (num > 10000) {
        throw new Error('La tarifa de entrega supera el límite máximo permitido ($10,000.00)');
    }
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates complete financial breakdown of an order.
 * Follows canonical formula:
 *   grandTotal = itemsTotal - discount + netPackagingFee + deliveryFee
 */
export function calculateOrderFinancials(
    items: OrderItemCalculationInput[],
    options?: OrderCalculationOptions
): OrderFinancialSummary {
    if (!items || !Array.isArray(items)) {
        throw new Error('La lista de productos del pedido es inválida o no está definida');
    }

    const itemsTotal = items.reduce((acc, item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        const price = Math.max(0, Number(item.price_at_time ?? item.price ?? 0));
        return acc + (qty * price);
    }, 0);

    const roundedItemsTotal = Math.round((itemsTotal + Number.EPSILON) * 100) / 100;

    let discountAmount = 0;
    let discountPercentage: number | undefined = undefined;

    if (options?.globalDiscountPercentage !== undefined && options?.globalDiscountPercentage !== null && Number(options.globalDiscountPercentage) > 0) {
        discountPercentage = Number(options.globalDiscountPercentage);
        discountAmount = Math.round((roundedItemsTotal * (discountPercentage / 100) + Number.EPSILON) * 100) / 100;
    } else if (options?.globalDiscountAmount !== undefined && options?.globalDiscountAmount !== null && Number(options.globalDiscountAmount) > 0) {
        discountAmount = Math.min(roundedItemsTotal, Math.round((Number(options.globalDiscountAmount) + Number.EPSILON) * 100) / 100);
    }

    const packagingFee = Math.max(0, Number(options?.packagingFee || 0));
    const packagingDiscount = Math.max(0, Number(options?.packagingDiscount || 0));
    const netPackagingFee = Math.round((Math.max(0, packagingFee - packagingDiscount) + Number.EPSILON) * 100) / 100;

    const deliveryFee = options?.deliveryFee !== undefined && options?.deliveryFee !== null
        ? Math.max(0, Math.round((Number(options.deliveryFee) + Number.EPSILON) * 100) / 100)
        : 0;

    const grandTotal = Math.max(0, Math.round((roundedItemsTotal - discountAmount + netPackagingFee + deliveryFee + Number.EPSILON) * 100) / 100);

    return {
        itemsTotal: roundedItemsTotal,
        discountAmount,
        discountPercentage,
        packagingFee,
        packagingDiscount,
        netPackagingFee,
        deliveryFee,
        grandTotal,
    };
}
