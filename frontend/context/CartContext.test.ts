import { describe, it, expect } from 'vitest';
import { calculateItemPrice, calculateCartTotals, CartItem } from './CartContext';

describe('CartContext Pricing & Discount Parity', () => {
  const mockProfile = {
    id: 'user-123',
    general_discount: 10, // 10%
    delivery_fee: 5.0,
    productDiscounts: [
      { product_id: 1, special_price: 18.0 }, // base price 20 -> 18
      { product_id: 2, discount_percentage: 20 }, // base price 10 -> 8
    ],
  };

  it('calculates individual item price according to priority: special price > discount percentage > general discount', () => {
    // Product 1: Has special price 18.0
    const price1 = calculateItemPrice({ id: 1, price: 20 }, mockProfile);
    expect(price1).toBe(18.0);

    // Product 2: Has discount percentage 20% -> 10 * 0.8 = 8.0
    const price2 = calculateItemPrice({ id: 2, price: 10 }, mockProfile);
    expect(price2).toBe(8.0);

    // Product 3: No specific discount -> 10% general discount -> 15 * 0.9 = 13.5
    const price3 = calculateItemPrice({ id: 3, price: 15 }, mockProfile);
    expect(price3).toBe(13.5);

    // Anonymous/no profile: Full price
    const priceAnon = calculateItemPrice({ id: 3, price: 15 }, null);
    expect(priceAnon).toBe(15.0);
  });

  it('calculates raw subtotal, discounted subtotal, and final total matching backend parity', () => {
    const cart: CartItem[] = [
      { id: 1, name: 'Pan de Bono', price: 20, originalPrice: 20, quantity: 2, image: '', description: '' },
      { id: 2, name: 'Croissant', price: 10, originalPrice: 10, quantity: 1, image: '', description: '' },
      { id: 3, name: 'Baguette', price: 10, originalPrice: 10, quantity: 3, image: '', description: '' },
    ];

    const totals = calculateCartTotals(cart, mockProfile);

    // Raw subtotal: (20 * 2) + (10 * 1) + (10 * 3) = 80
    expect(totals.rawSubtotal).toBe(80);

    // Discounted subtotal:
    // P1: 18 * 2 = 36
    // P2: 8 * 1 = 8
    // P3: 9 * 3 = 27 (10 - 10% = 9)
    // Sum = 36 + 8 + 27 = 71
    expect(totals.discountedSubtotal).toBe(71);

    // Final total: 71 + 5 (delivery fee) = 76
    expect(totals.finalTotal).toBe(76);
  });
});
