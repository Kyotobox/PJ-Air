'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export interface CartItem {
    id: number;
    name: string;
    price: number; // This will be the dynamic final price
    originalPrice: number; // Fixed base price from catalog
    quantity: number;
    image: string;
    description: string;
}

interface CartContextType {
    cart: CartItem[];
    addToCart: (product: any, quantity: number) => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
    getCartCount: () => number;
    getRawSubtotal: () => number;
    getDiscountedSubtotal: () => number;
    getFinalTotal: () => number;
    getItemPrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function calculateItemPrice(item: { id: number; price: number; originalPrice?: number }, profile: any): number {
    const basePrice = Number(item.originalPrice || item.price || 0);
    let finalPrice = basePrice;

    const pd = profile?.productDiscounts?.find((d: any) => Number(d.product_id) === Number(item.id));
    if (pd) {
        if (pd.special_price !== null && pd.special_price !== undefined && Number(pd.special_price) > 0) {
            finalPrice = Number(pd.special_price);
        } else if (pd.discount_percentage !== null && pd.discount_percentage !== undefined && Number(pd.discount_percentage) > 0) {
            finalPrice = basePrice * (1 - Number(pd.discount_percentage) / 100);
        }
    } else if (profile?.general_discount !== null && profile?.general_discount !== undefined && Number(profile.general_discount) > 0) {
        finalPrice = basePrice * (1 - Number(profile.general_discount) / 100);
    }

    return Math.round((finalPrice + Number.EPSILON) * 100) / 100;
}

export function calculateCartTotals(cart: CartItem[], profile: any) {
    const rawSubtotal = Math.round((cart.reduce((total, item) => {
        const itemPrice = Number(item.originalPrice || item.price || 0);
        return total + (itemPrice * item.quantity);
    }, 0) + Number.EPSILON) * 100) / 100;

    const discountedSubtotal = Math.round((cart.reduce((acc, item) => {
        const unitPrice = calculateItemPrice(item, profile);
        return acc + (unitPrice * item.quantity);
    }, 0) + Number.EPSILON) * 100) / 100;

    const fee = Number(profile?.delivery_fee) || 0;
    const finalTotal = Math.round((discountedSubtotal + fee + Number.EPSILON) * 100) / 100;

    return { rawSubtotal, discountedSubtotal, finalTotal };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { profile } = useAuth();
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Key depends on user ID to isolate carts
    const cartKey = profile?.id ? `jhoanes-cart-${profile.id}` : 'jhoanes-cart-guest';

    // Load from localStorage when user changes or component mounts
    useEffect(() => {
        const savedCart = localStorage.getItem(cartKey);
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Error loading cart", e);
                setCart([]);
            }
        } else {
            setCart([]);
        }
    }, [cartKey]);

    // Save to localStorage on cart change
    useEffect(() => {
        if (cart.length > 0) {
            localStorage.setItem(cartKey, JSON.stringify(cart));
        } else {
            localStorage.removeItem(cartKey);
        }
    }, [cart, cartKey]);

    const addToCart = (product: any, quantity: number) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => 
                    item.id === product.id 
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prevCart, { 
                id: product.id, 
                name: product.name, 
                price: product.price, 
                originalPrice: product.price,
                image: product.image,
                description: product.description,
                quantity: quantity 
            }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: number, quantity: number) => {
        setCart(prevCart => {
            if (quantity <= 0) {
                return prevCart.filter(item => item.id !== productId);
            }
            return prevCart.map(item => 
                item.id === productId ? { ...item, quantity } : item
            );
        });
    };

    const clearCart = () => {
        setCart([]);
    };

    const getItemPrice = (item: CartItem): number => {
        return calculateItemPrice(item, profile);
    };

    const getRawSubtotal = () => {
        const raw = cart.reduce((total, item) => {
            const itemPrice = Number(item.originalPrice || item.price || 0);
            return total + (itemPrice * item.quantity);
        }, 0);
        return Math.round((raw + Number.EPSILON) * 100) / 100;
    };

    const getDiscountedSubtotal = () => {
        const total = cart.reduce((acc, item) => {
            const unitPrice = getItemPrice(item);
            return acc + (unitPrice * item.quantity);
        }, 0);
        return Math.round((total + Number.EPSILON) * 100) / 100;
    };

    const getCartTotal = () => getDiscountedSubtotal();

    const getFinalTotal = () => {
        const afterDisc = getDiscountedSubtotal();
        const fee = Number(profile?.delivery_fee) || 0;
        return Math.round((afterDisc + fee + Number.EPSILON) * 100) / 100;
    };

    const getCartCount = () => {
        return cart.reduce((count, item) => count + item.quantity, 0);
    };

    return (
        <CartContext.Provider value={{ 
            cart, 
            addToCart, 
            removeFromCart, 
            updateQuantity,
            clearCart, 
            getCartTotal, 
            getCartCount,
            getRawSubtotal,
            getDiscountedSubtotal,
            getFinalTotal,
            getItemPrice
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
