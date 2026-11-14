import { describe, it, expect } from 'vitest';

export interface TestManualOrderLineItem {
  productId: number;
  name: string;
  quantity: number;
  catalogPrice: number;
  customPrice?: number;
}

export function calculateManualOrderTotals(params: {
  items: TestManualOrderLineItem[];
  discountPercentage?: number;
  deliveryType: 'saved' | 'pickup' | 'other';
  deliveryFee: number;
  isTaxExempt: boolean;
}) {
  const { items, discountPercentage = 0, deliveryType, deliveryFee, isTaxExempt } = params;

  // 1. Items subtotal with custom price overrides
  const itemsSubtotal = items.reduce((acc, item) => {
    const unitPrice = (item.customPrice !== undefined && item.customPrice >= 0)
      ? item.customPrice
      : item.catalogPrice;
    return acc + (unitPrice * item.quantity);
  }, 0);

  // 2. Discount calculation (capped at 50%)
  const effectiveDiscountPct = Math.min(Math.max(0, discountPercentage), 50);
  const discountAmount = Math.round(itemsSubtotal * (effectiveDiscountPct / 100) * 100) / 100;

  // 3. Delivery fee (pickup is strictly $0.00, otherwise capped between 0 and 1500)
  const effectiveDeliveryFee = deliveryType === 'pickup' 
    ? 0 
    : Math.min(Math.max(0, deliveryFee), 1500);

  // 4. Sales tax (0% if ST-120 certified, 8.875% otherwise)
  const taxableSubtotal = Math.max(0, itemsSubtotal - discountAmount);
  const salesTaxAmount = isTaxExempt 
    ? 0 
    : Math.round(taxableSubtotal * 0.08875 * 100) / 100;

  // 5. Grand total
  const grandTotal = Math.max(
    0,
    Math.round((itemsSubtotal - discountAmount + effectiveDeliveryFee + salesTaxAmount + Number.EPSILON) * 100) / 100
  );

  return {
    itemsSubtotal: Math.round(itemsSubtotal * 100) / 100,
    discountAmount,
    effectiveDeliveryFee,
    salesTaxAmount,
    grandTotal,
    hasPriceOverrides: items.some(i => i.customPrice !== undefined && i.customPrice !== i.catalogPrice)
  };
}

export function buildManualOrderPayload(params: {
  userId?: string;
  isDraft: boolean;
  adminOverrideCutoff: boolean;
  deliveryDate: string;
  deliveryType: 'saved' | 'pickup' | 'other';
  addressId?: string;
  customAddressText?: string;
  deliveryFee: number;
  discountPercentage: number;
  paymentMethod: string;
  checkNumber?: string;
  checkBank?: string;
  wireReference?: string;
  notes?: string;
  items: TestManualOrderLineItem[];
}) {
  if (!params.userId) {
    throw new Error('Debe seleccionar un cliente para registrar el pedido manual');
  }
  if (!params.items || params.items.length === 0) {
    throw new Error('Debe agregar al menos un producto a la orden');
  }
  if (!params.deliveryDate) {
    throw new Error('La fecha de entrega es obligatoria');
  }

  const totals = calculateManualOrderTotals({
    items: params.items,
    discountPercentage: params.discountPercentage,
    deliveryType: params.deliveryType,
    deliveryFee: params.deliveryFee,
    isTaxExempt: false,
  });

  return {
    userId: params.userId,
    manual_entry: true,
    admin_created: true,
    is_draft: params.isDraft,
    status: params.isDraft ? 'draft' : 'confirmed',
    admin_override_cutoff: params.adminOverrideCutoff,
    override_prices: totals.hasPriceOverrides,
    deliveryDate: params.deliveryDate,
    deliveryType: params.deliveryType,
    addressId: params.deliveryType === 'saved' ? params.addressId : undefined,
    deliveryAddressText: params.deliveryType === 'other' ? params.customAddressText : undefined,
    delivery_fee_charged: totals.effectiveDeliveryFee,
    discount_percentage: params.discountPercentage,
    paymentMethod: params.paymentMethod,
    check_number: params.paymentMethod === 'check' ? params.checkNumber : undefined,
    check_bank: params.paymentMethod === 'check' ? params.checkBank : undefined,
    wire_reference: params.paymentMethod === 'ach' ? params.wireReference : undefined,
    notes: params.notes,
    items: params.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price_at_time: item.customPrice !== undefined ? item.customPrice : item.catalogPrice
    }))
  };
}

describe('Sprint S91: Frontend Manual Orders Entry (/admin/orders/new)', () => {
  it('Happy Path: calculates custom prices and manual freight correctly', () => {
    const items: TestManualOrderLineItem[] = [
      { productId: 1, name: 'Pan de Bono', quantity: 10, catalogPrice: 20.00, customPrice: 18.50 },
      { productId: 2, name: 'Buñuelo', quantity: 5, catalogPrice: 15.00 } // Uses catalog price
    ];

    const result = calculateManualOrderTotals({
      items,
      discountPercentage: 10, // 10% discount
      deliveryType: 'saved',
      deliveryFee: 250.00, // Boston interstate route
      isTaxExempt: true // ST-120 certified
    });

    // Subtotal: 10 * 18.50 ($185) + 5 * 15.00 ($75) = $260.00
    expect(result.itemsSubtotal).toBe(260.00);
    // Discount: 10% of 260 = $26.00
    expect(result.discountAmount).toBe(26.00);
    // Flete: $250.00
    expect(result.effectiveDeliveryFee).toBe(250.00);
    // Sales tax: $0.00 (Exempt)
    expect(result.salesTaxAmount).toBe(0.00);
    // Grand total: 260 - 26 + 250 = $484.00
    expect(result.grandTotal).toBe(484.00);
    expect(result.hasPriceOverrides).toBe(true);
  });

  it('Happy Path: pickup delivery strictly nullifies delivery fee to $0.00', () => {
    const items: TestManualOrderLineItem[] = [
      { productId: 1, name: 'Pan de Bono', quantity: 2, catalogPrice: 20.00 }
    ];

    const result = calculateManualOrderTotals({
      items,
      discountPercentage: 0,
      deliveryType: 'pickup',
      deliveryFee: 150.00,
      isTaxExempt: true
    });

    expect(result.effectiveDeliveryFee).toBe(0);
    expect(result.grandTotal).toBe(40.00);
  });

  it('Happy Path: calculates NY sales tax when client is not ST-120 exempt', () => {
    const items: TestManualOrderLineItem[] = [
      { productId: 1, name: 'Pan', quantity: 5, catalogPrice: 20.00 }
    ];

    const result = calculateManualOrderTotals({
      items,
      discountPercentage: 0,
      deliveryType: 'pickup',
      deliveryFee: 0,
      isTaxExempt: false
    });

    // Subtotal: $100.00. Tax: 8.875% of $100 = $8.88
    expect(result.salesTaxAmount).toBe(8.88);
    expect(result.grandTotal).toBe(108.88);
  });

  it('Sad Path (§6): discount percentage is capped at 50% max', () => {
    const items: TestManualOrderLineItem[] = [
      { productId: 1, name: 'Pan', quantity: 1, catalogPrice: 100.00 }
    ];

    const result = calculateManualOrderTotals({
      items,
      discountPercentage: 75, // Attempted 75%
      deliveryType: 'pickup',
      deliveryFee: 0,
      isTaxExempt: true
    });

    expect(result.discountAmount).toBe(50.00); // Capped at 50%
    expect(result.grandTotal).toBe(50.00);
  });

  it('Sad Path (§6): payload builder throws when client is missing', () => {
    expect(() => buildManualOrderPayload({
      userId: '',
      isDraft: false,
      adminOverrideCutoff: false,
      deliveryDate: '2026-11-20',
      deliveryType: 'saved',
      deliveryFee: 0,
      discountPercentage: 0,
      paymentMethod: 'cash',
      items: [{ productId: 1, name: 'Pan', quantity: 1, catalogPrice: 20 }]
    })).toThrow('Debe seleccionar un cliente para registrar el pedido manual');
  });

  it('Sad Path (§6): payload builder throws when items are empty', () => {
    expect(() => buildManualOrderPayload({
      userId: 'user-123',
      isDraft: false,
      adminOverrideCutoff: false,
      deliveryDate: '2026-11-20',
      deliveryType: 'saved',
      deliveryFee: 0,
      discountPercentage: 0,
      paymentMethod: 'cash',
      items: []
    })).toThrow('Debe agregar al menos un producto a la orden');
  });

  it('Happy Path: constructs draft payload vs confirmed invoice payload', () => {
    const draft = buildManualOrderPayload({
      userId: 'user-b2b-456',
      isDraft: true,
      adminOverrideCutoff: true,
      deliveryDate: '2026-11-15',
      deliveryType: 'other',
      customAddressText: '150 Broadway, Somerville, MA',
      deliveryFee: 250,
      discountPercentage: 0,
      paymentMethod: 'credit',
      items: [{ productId: 1, name: 'Pan', quantity: 2, catalogPrice: 20, customPrice: 18 }]
    });

    expect(draft.is_draft).toBe(true);
    expect(draft.status).toBe('draft');
    expect(draft.admin_override_cutoff).toBe(true);
    expect(draft.override_prices).toBe(true);
    expect(draft.deliveryAddressText).toBe('150 Broadway, Somerville, MA');
    expect(draft.delivery_fee_charged).toBe(250);

    const confirmed = buildManualOrderPayload({
      userId: 'user-b2b-456',
      isDraft: false,
      adminOverrideCutoff: false,
      deliveryDate: '2026-11-20',
      deliveryType: 'saved',
      addressId: 'addr-789',
      deliveryFee: 0,
      discountPercentage: 0,
      paymentMethod: 'check',
      checkNumber: '8841',
      checkBank: 'Chase',
      items: [{ productId: 1, name: 'Pan', quantity: 1, catalogPrice: 20 }]
    });

    expect(confirmed.is_draft).toBe(false);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.check_number).toBe('8841');
    expect(confirmed.check_bank).toBe('Chase');
  });
});
