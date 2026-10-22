'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { ArrowLeft, Tag, Search, ShoppingCart, Check, Plus, Minus, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { API_URL } from '@/lib/config';

function ProductCard({
    product, quantity, isInCart, isJustAdded, onIncrement, onDecrement, onQuantityChange, onAddToCart,
}: {
    product: any; quantity: number | string; isInCart?: number; isJustAdded: boolean;
    onIncrement: (id: number) => void; onDecrement: (id: number) => void; 
    onQuantityChange: (id: number, val: string) => void;
    onAddToCart: (p: any) => void;
}) {
    const { t, locale } = useLanguage();
    return (
        <div className="group bg-white rounded-3xl border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col overflow-hidden">
            <Link href={`/catalog/${product.id}`} className="relative w-full aspect-square overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 block">
                <img src={product.image?.startsWith('http') ? product.image : `${API_URL}${product.image}`} alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?q=80&w=400'; }} />
                {isInCart ? (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1">
                        <Check size={9} /> {isInCart}
                    </div>
                ) : null}
            </Link>
            <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[40px]">{product.name}</h3>
                <p className="text-xl font-black text-foreground">${product.price}</p>
                {product.category?.min_qty > 1 && (
                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        <Info size={10} />
                        <span className="text-[9px] font-black uppercase tracking-tight">{locale === 'en' ? `Min: ${product.category.min_qty} units` : `Mínimo: ${product.category.min_qty} unidades`}</span>
                    </div>
                )}
                <div className="w-full flex items-center justify-between bg-muted/40 rounded-2xl border border-border/50 p-1">
                    <button 
                        type="button"
                        onClick={() => onDecrement(product.id)}
                        aria-label="Disminuir cantidad"
                        className="w-9 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white rounded-xl transition-all active:scale-90"
                    >
                        <Minus size={13} strokeWidth={2.5} />
                    </button>
                    <input 
                        type="number" 
                        value={quantity}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || (Number(val) >= 1 && Number(val) <= 999)) {
                                onQuantityChange(product.id, val);
                            }
                        }}
                        className="flex-1 bg-transparent text-center text-sm font-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none py-1"
                    />
                    <button 
                        type="button"
                        onClick={() => onIncrement(product.id)}
                        aria-label="Aumentar cantidad"
                        className="w-9 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-white rounded-xl transition-all active:scale-90"
                    >
                        <Plus size={13} strokeWidth={2.5} />
                    </button>
                </div>
                <button onClick={() => onAddToCart(product)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isJustAdded ? 'bg-green-500 text-white scale-95' : 'bg-primary text-white hover:bg-primary/90'}`}>
                    {isJustAdded ? <><Check size={12} /> {t.product.added}</> : <><ShoppingCart size={12} /> {t.product.addToOrder}</>}
                </button>
            </div>
        </div>
    );
}

export default function CategoryPage() {
    const params = useParams();
    const categoryKey = decodeURIComponent((params?.category as string) || '');

    const { addToCart, cart } = useCart();
    const { t, locale } = useLanguage();

    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addedIds, setAddedIds] = useState<number[]>([]);
    const [quantities, setQuantities] = useState<Record<number, number>>({});

    // ── Category Rail Horizontal Scroll ────────────────────────────────────
    const railRef = useRef<HTMLDivElement>(null);
    const [canRailScrollLeft, setCanRailScrollLeft] = useState(false);
    const [canRailScrollRight, setCanRailScrollRight] = useState(false);

    const checkRailScroll = useCallback(() => {
        const el = railRef.current;
        if (!el) return;
        setCanRailScrollLeft(el.scrollLeft > 4);
        setCanRailScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    const scrollCategoryRail = (dir: 'left' | 'right') => {
        railRef.current?.scrollBy({
            left: dir === 'left' ? -240 : 240,
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            setIsLoading(true);
            try {
                const data = await api.get('/products') as any[];
                if (!mounted) return;
                setProducts(Array.isArray(data) ? data : []);
                setQuantities((data || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: 1 }), {}));
            } catch (err) { console.error(err); }
            finally { if (mounted) setIsLoading(false); }
        })();
        return () => { mounted = false; };
    }, []);

    // All categories (Sorted by highest product count descending)
    const categoryGroups = useMemo(() => {
        const map: Record<string, { labelEn: string; count: number }> = {};
        products.forEach(p => {
            if (p.category?.name) {
                const key = p.category.name;
                if (!map[key]) map[key] = { labelEn: p.category.name_en || key, count: 0 };
                map[key].count++;
            }
        });
        return Object.entries(map)
            .sort(([keyA, a], [keyB, b]) => (b.count - a.count) || keyA.localeCompare(keyB))
            .map(([key, { labelEn, count }]) => ({
                key,
                label: locale === 'en' ? labelEn : key,
                count,
            }));
    }, [products, locale]);

    useEffect(() => {
        checkRailScroll();
        const el = railRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkRailScroll, { passive: true });
        window.addEventListener('resize', checkRailScroll);
        return () => {
            el.removeEventListener('scroll', checkRailScroll);
            window.removeEventListener('resize', checkRailScroll);
        };
    }, [checkRailScroll, categoryGroups]);

    const categoryProducts = useMemo(() =>
        products
            .filter(p => p.category?.name === categoryKey)
            .sort((a, b) => a.name.localeCompare(b.name))
    , [products, categoryKey]);

    const categoryLabel = useMemo(() => {
        const first = categoryProducts[0];
        if (locale === 'en' && first?.category?.name_en) return first.category.name_en;
        return categoryKey;
    }, [categoryProducts, categoryKey, locale]);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return categoryProducts;
        const q = searchQuery.toLowerCase();
        return categoryProducts.filter(p => p.name.toLowerCase().includes(q));
    }, [categoryProducts, searchQuery]);

    const handleIncrement = (id: number) => setQuantities(p => ({ ...p, [id]: (Number(p[id]) || categoryProducts.find(cp => cp.id === id)?.category?.min_qty || 1) + 1 }));
    const handleDecrement = (id: number) => {
        const prod = categoryProducts.find(p => p.id === id);
        const min = Number(prod?.category?.min_qty) || 1;
        setQuantities(p => ({ ...p, [id]: Math.max(min, (Number(p[id]) || min) - 1) }));
    };
    const handleQuantityChange = (id: number, val: string) => {
        const prod = categoryProducts.find(p => p.id === id);
        const min = Number(prod?.category?.min_qty) || 1;
        if (val !== '' && Number(val) < min) return; // ignore lower than min if typing
        setQuantities(p => ({ ...p, [id]: val as any }));
    };

    const handleAddToCart = (product: any) => {
        let q = Number(quantities[product.id]);
        const min = Number(product.category?.min_qty) || 1;
        if (isNaN(q) || q < min) q = min; 
        addToCart(product, q);
        setAddedIds(p => [...p, product.id]);
        setTimeout(() => setAddedIds(p => p.filter(i => i !== product.id)), 2000);
    };

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#fdfcfb 0%,#f9f6f0 100%)' }}>
            <Navbar />
            <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-14 py-10">

                {/* ── Category Navigation Rail + Search Bar ─── */}
                <div className="mb-8 flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white/70 backdrop-blur-md p-3 sm:p-3.5 rounded-[2rem] border border-border/60 shadow-xs">
                    
                    {/* Scrollable Category Rail with Navigation Arrows */}
                    <div className="relative flex-1 min-w-0 flex items-center">
                        {/* Left Arrow for Rail */}
                        <button 
                            type="button"
                            onClick={() => scrollCategoryRail('left')}
                            aria-label="Scroll categories left"
                            className={`hidden sm:flex shrink-0 w-8 h-8 rounded-full bg-white border border-border/60 shadow-xs items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all mr-1 z-10 ${canRailScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        >
                            <ChevronLeft size={16} strokeWidth={2.5} />
                        </button>

                        {/* Scrollable track */}
                        <div 
                            ref={railRef}
                            onScroll={checkRailScroll}
                            className="flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-1 no-scrollbar flex-1"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {/* "All" pill — Back to homepage */}
                            <Link
                                href="/"
                                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-border/60 text-[11px] font-black uppercase tracking-wider text-foreground/75 hover:bg-primary hover:text-white hover:border-primary shadow-xs transition-all group"
                            >
                                <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                                <span>{locale === 'en' ? 'All' : 'Todos'}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-muted group-hover:bg-white/20 text-muted-foreground group-hover:text-white transition-colors">
                                    {products.length}
                                </span>
                            </Link>

                            {/* Category pills ordered by highest product count */}
                            {!isLoading && categoryGroups.map(({ key, label, count }) => (
                                <Link
                                    key={key}
                                    href={`/catalog/category/${encodeURIComponent(key)}`}
                                    className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs transition-all border ${
                                        key === categoryKey
                                            ? 'bg-primary text-white border-primary shadow-sm'
                                            : 'bg-white border-border/60 text-foreground/75 hover:bg-primary hover:text-white hover:border-primary'
                                    }`}
                                >
                                    <span>{label}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                        key === categoryKey
                                            ? 'bg-white/20 text-white'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {count}
                                    </span>
                                </Link>
                            ))}
                        </div>

                        {/* Right Arrow for Rail */}
                        <button 
                            type="button"
                            onClick={() => scrollCategoryRail('right')}
                            aria-label="Scroll categories right"
                            className={`hidden sm:flex shrink-0 w-8 h-8 rounded-full bg-white border border-border/60 shadow-xs items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all ml-1 z-10 ${canRailScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        >
                            <ChevronRight size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Search Box — clean docking */}
                    <div className="relative shrink-0 w-full md:w-64 border-t md:border-t-0 md:border-l border-border/40 pt-2 md:pt-0 md:pl-3">
                        <Search size={15} className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder={t.catalog.searchPlaceholder}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 rounded-full bg-white border border-border/60 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all shadow-xs placeholder:text-muted-foreground/50"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary text-xs font-bold"
                            >✕</button>
                        )}
                    </div>
                </div>

                {/* ── Category title ──────────────────────────────────── */}
                <div className="flex items-center gap-3 mb-7">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                        <Tag size={18} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight leading-none">{categoryLabel}</h1>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                            {isLoading ? '...' : `${categoryProducts.length} ${locale === 'en' ? 'products' : 'productos'}`}
                        </p>
                    </div>
                </div>

                {/* ── Products ─────────────────────────────────────────── */}
                {isLoading ? (
                    <div className="flex flex-col items-center py-32 gap-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">{t.catalog.loading}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 text-center bg-white rounded-3xl border border-border/40">
                        <p className="text-muted-foreground font-medium">{t.catalog.noProducts}</p>
                        <Link href="/" className="mt-4 inline-block text-sm font-bold text-primary hover:underline">
                            {locale === 'en' ? '← Back to catalog' : '← Volver al catálogo'}
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4"
                         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,200px),1fr))' }}>
                        {filtered.map(product => (
                            <ProductCard key={product.id} product={product}
                                quantity={quantities[product.id] || 1}
                                isInCart={cart.find(i => i.id === product.id)?.quantity}
                                isJustAdded={addedIds.includes(product.id)}
                                onIncrement={handleIncrement}
                                onDecrement={handleDecrement}
                                onQuantityChange={handleQuantityChange}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
