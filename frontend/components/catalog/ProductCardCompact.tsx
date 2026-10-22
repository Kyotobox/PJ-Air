'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Check, Plus, Minus } from 'lucide-react';
import { Product } from '@/lib/products';
import { useLanguage } from '@/context/LanguageContext';

interface ProductCardCompactProps {
    product: Product;
    quantity: number | string;
    isInCart?: number;
    isJustAdded: boolean;
    onIncrement: (id: number) => void;
    onDecrement: (id: number) => void;
    onAddToCart: (product: Product) => void;
}

export const ProductCardCompact = ({
    product,
    quantity,
    isInCart,
    isJustAdded,
    onIncrement,
    onDecrement,
    onAddToCart,
}: ProductCardCompactProps) => {
    const { t, locale } = useLanguage();

    return (
        <div className="group bg-white rounded-[2rem] border border-border/60 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col overflow-hidden w-[220px] shrink-0">
            {/* Image */}
            <Link href={`/catalog/${product.id}`} className="relative w-full aspect-square overflow-hidden bg-muted/20">
                <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=400';
                    }}
                />
                {isInCart ? (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1">
                        <Check size={10} strokeWidth={3} /> {isInCart}
                    </div>
                ) : null}
            </Link>

            {/* Info */}
            <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-bold text-sm leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {product.name}
                </h3>
                <p className="text-xl font-black text-foreground/90 tracking-tight">${product.price}</p>

                {/* Qty + Cart */}
                <div className="flex items-center gap-2 mt-auto pt-2">
                    <div className="grid grid-cols-[28px_auto_28px] items-center bg-muted rounded-xl overflow-hidden border border-border/40 shrink-0">
                        <button
                            type="button"
                            onClick={() => onDecrement(product.id)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                            aria-label="Decrease"
                        >
                            <Minus size={13} strokeWidth={2.5} />
                        </button>
                        <span className="px-1 text-sm font-bold min-w-[24px] text-center">{quantity}</span>
                        <button
                            type="button"
                            onClick={() => onIncrement(product.id)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                            aria-label="Increase"
                        >
                            <Plus size={13} strokeWidth={2.5} />
                        </button>
                    </div>
                    <button
                        onClick={() => onAddToCart(product)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isJustAdded
                                ? 'bg-green-500 text-white'
                                : 'bg-primary text-white hover:bg-primary/90'
                        }`}
                    >
                        {isJustAdded ? (
                            <><Check size={12} strokeWidth={3} /> {t.product.added}</>
                        ) : (
                            <><ShoppingCart size={12} strokeWidth={2.5} /> {t.product.addToOrder}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
