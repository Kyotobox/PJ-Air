'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
    Search, ArrowRight, Tag, Sparkles,
    ShoppingCart, Check, Plus, Minus, Info,
    ChevronLeft, ChevronRight,
    LogIn, UserPlus, Lock, User as UserIcon, Loader2, Eye, EyeOff, X,
} from 'lucide-react';
import Link from 'next/link';
import { API_URL } from '@/lib/config';

// ─────────────────────────────────────────────────────────────────────────────
// Login Modal — shown when user requests authentication
// ─────────────────────────────────────────────────────────────────────────────
function LoginModal({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) {
    const { t, locale } = useLanguage();
    const { updateLocalSession } = useAuth();
    const router = useRouter();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await api.post('/auth/login', {
                email: identifier.trim(),
                password,
            }) as any;
            if (data.session) {
                updateLocalSession(data);
                const userDetail = await api.get(`/users/${data.user.id}`) as any;
                const role = userDetail.role || 'client';
                if (role === 'admin') router.push('/admin');
                else if (role === 'produccion') router.push('/produccion');
                else if (role === 'delivery') router.push('/delivery');
                else onSuccess();
            }
        } catch (err: any) {
            setError(err.message || (locale === 'en' ? 'Invalid credentials' : 'Credenciales incorrectas'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        /* Full-screen overlay */
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
             style={{ background: 'rgba(15,10,5,0.65)', backdropFilter: 'blur(8px)' }}>

            <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in">

                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute right-5 top-5 p-2 text-muted-foreground hover:text-foreground z-20 rounded-full hover:bg-muted transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Top gradient band */}
                <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg,#6B0D0D,#b45309)' }} />

                <div className="p-8 sm:p-10">
                    {/* Logo / title */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-4 text-white"
                             style={{ background: 'linear-gradient(135deg,#6B0D0D,#b45309)' }}>
                            <LogIn size={28} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">
                            {locale === 'en' ? 'Welcome back' : 'Bienvenido'}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {locale === 'en'
                                ? 'Sign in to access the catalog'
                                : 'Inicia sesión para ver el catálogo'}
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Identifier */}
                        <div className="relative">
                            <UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                            <input
                                required
                                type="text"
                                placeholder={locale === 'en' ? 'Email or username' : 'Email o usuario'}
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-border/60 bg-muted/30 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                            <input
                                required
                                type={showPw ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-11 pr-12 py-3.5 rounded-2xl border border-border/60 bg-muted/30 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                            />
                            <button type="button" onClick={() => setShowPw(p => !p)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>

                        {/* Forgot password */}
                        <div className="text-right">
                            <Link href="/auth/forgot-password"
                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                                {locale === 'en' ? 'Forgot password?' : '¿Olvidaste tu contraseña?'}
                            </Link>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 bg-[#111] hover:bg-[#222]"
                        >
                            {isLoading
                                ? <Loader2 size={20} className="animate-spin" />
                                : <><LogIn size={18} /> {locale === 'en' ? 'Sign In' : 'Ingresar'}</>}
                        </button>
                    </form>

                    {/* Register link */}
                    <div className="mt-6 pt-6 border-t border-border/40 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                            {locale === 'en' ? "Don't have an account?" : '¿No tienes cuenta aún?'}
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push('/auth/register')}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#111] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#333] transition-all active:scale-95">
                            <UserPlus size={15} />
                            {locale === 'en' ? 'Create Account' : 'Crear mi cuenta'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card — fills 100% of its container width
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({
    product, quantity, isInCart, isJustAdded,
    onIncrement, onDecrement, onQuantityChange, onAddToCart, profile,
}: {
    product: any;
    quantity: number;
    isInCart?: number;
    isJustAdded: boolean;
    onIncrement: (id: number) => void;
    onDecrement: (id: number) => void;
    onQuantityChange: (id: number, val: string) => void;
    onAddToCart: (p: any) => void;
    profile?: any;
}) {
    const { t, locale } = useLanguage();

    // Calculate dynamic price
    let originalPrice = product.price;
    let finalPrice = product.price;
    let hasDiscount = false;

    if (profile?.productDiscounts) {
        const pd = profile.productDiscounts.find((d: any) => Number(d.product_id) === Number(product.id));
        if (pd) {
            hasDiscount = true;
            if (pd.special_price) finalPrice = Number(pd.special_price);
            else if (pd.discount_percentage) finalPrice = originalPrice * (1 - Number(pd.discount_percentage) / 100);
        }
    }
    
    // Also consider general discount if no product-specific one
    if (!hasDiscount && profile?.general_discount > 0) {
        hasDiscount = true;
        finalPrice = originalPrice * (1 - Number(profile.general_discount) / 100);
    }

    return (
        <div className="group bg-white rounded-3xl border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col overflow-hidden w-full h-full">
            {/* Image */}
            <Link
                href={`/catalog/${product.id}`}
                className="relative w-full overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 block"
                style={{ aspectRatio: '1/1' }}
            >
                <img
                    src={product.image?.startsWith('http') ? product.image : `${API_URL}${product.image}`}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?q=80&w=400';
                    }}
                />
                {!!isInCart && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow">
                        <Check size={9} strokeWidth={3} /> {isInCart}
                    </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-10 h-10 bg-white/90 rounded-2xl flex items-center justify-center shadow-lg">
                        <Info size={17} className="text-primary" />
                    </div>
                </div>
            </Link>

            {/* Details */}
            <div className="p-3 sm:p-4 flex flex-col gap-2 flex-1">
                <h3 className="font-bold text-sm leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[36px]">
                    {product.name}
                </h3>
                <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-lg font-black text-foreground tracking-tight">${finalPrice.toFixed(2)}</p>
                    {hasDiscount && (
                        <p className="text-[10px] font-bold text-muted-foreground/60 line-through decoration-primary/40 decoration-2">${originalPrice.toFixed(2)}</p>
                    )}
                </div>
                {product.category?.min_qty > 1 && (
                    <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        <Info size={10} strokeWidth={3} />
                        <span className="text-[9px] font-black uppercase tracking-tight">{locale === 'en' ? `Min: ${product.category.min_qty} units` : `Mínimo: ${product.category.min_qty} unidades`}</span>
                    </div>
                )}

                {/* Quantity */}
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
                        min="1"
                        value={quantity || ''}
                        onChange={(e) => onQuantityChange(product.id, e.target.value)}
                        onFocus={(e) => {
                            if (quantity === 1) {
                                onQuantityChange(product.id, '');
                            }
                            e.target.select();
                        }}
                        className="flex-1 bg-transparent text-center text-sm font-black outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:bg-primary/5 py-1"
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

                {/* Cart button */}
                <button
                    onClick={() => onAddToCart(product)}
                    className={`mt-auto w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                        isJustAdded
                            ? 'bg-green-500 text-white scale-95'
                            : 'bg-primary text-white hover:bg-primary/90 active:scale-95'
                    }`}
                >
                    {isJustAdded
                        ? <><Check size={12} strokeWidth={3} /> {t.product.added}</>
                        : <><ShoppingCart size={12} /> {t.product.addToOrder}</>}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category carousel row — horizontal scroll with L/R arrow buttons
// ─────────────────────────────────────────────────────────────────────────────
function CategoryCarousel({
    group, quantities, addedIds, cart,
    onIncrement, onDecrement, onQuantityChange, onAddToCart,
    locale, viewAllLabel, profile,
}: {
    group: { key: string; label: string; products: any[] };
    quantities: Record<number, number>;
    addedIds: number[];
    cart: any[];
    onIncrement: (id: number) => void;
    onDecrement: (id: number) => void;
    onQuantityChange: (id: number, val: string) => void;
    onAddToCart: (p: any) => void;
    locale: string;
    viewAllLabel: string;
    profile?: any;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Card width: 220px + 16px gap
    const CARD_WIDTH = 236;

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [checkScroll, group.products]);

    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({
            left: dir === 'left' ? -CARD_WIDTH * 2 : CARD_WIDTH * 2,
            behavior: 'smooth',
        });
    };

    return (
        <div>
            {/* Header with Title on Left and Navigation Controls on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                        <Tag size={18} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight leading-none">
                            {group.label}
                        </h2>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                            {group.products.length} {locale === 'en' ? 'products' : 'productos'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Link
                        href={`/catalog/category/${encodeURIComponent(group.key)}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-border/60 rounded-full text-[11px] font-black uppercase tracking-wider text-primary hover:bg-primary hover:text-white hover:border-primary transition-all shadow-xs group/vab"
                    >
                        <ArrowRight size={13} className="group-hover/vab:translate-x-0.5 transition-transform" />
                        <span>{viewAllLabel}</span>
                        {group.products.length > 3 && (
                            <span className="bg-primary/10 group-hover/vab:bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                                {group.products.length}
                            </span>
                        )}
                    </Link>

                    {/* Unobtrusive Header Navigation Arrows */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-border/60 shadow-xs">
                        <button
                            type="button"
                            onClick={() => scroll('left')}
                            disabled={!canScrollLeft}
                            aria-label="Scroll left"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                canScrollLeft
                                    ? 'text-foreground hover:bg-primary hover:text-white cursor-pointer'
                                    : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                        >
                            <ChevronLeft size={16} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            onClick={() => scroll('right')}
                            disabled={!canScrollRight}
                            aria-label="Scroll right"
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                canScrollRight
                                    ? 'text-foreground hover:bg-primary hover:text-white cursor-pointer'
                                    : 'text-muted-foreground/30 cursor-not-allowed'
                            }`}
                        >
                            <ChevronRight size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable track — clean, unobstructed and touch friendly */}
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={checkScroll}
            >
                {group.products.map(product => (
                    <div
                        key={product.id}
                        style={{ width: '220px', minWidth: '220px' }}
                    >
                        <ProductCard
                            product={product}
                            quantity={quantities[product.id] || 1}
                            isInCart={cart.find(i => i.id === product.id)?.quantity}
                            isJustAdded={addedIds.includes(product.id)}
                            onIncrement={onIncrement}
                            onDecrement={onDecrement}
                            onQuantityChange={onQuantityChange}
                            onAddToCart={onAddToCart}
                            profile={profile}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
    const { addToCart, cart } = useCart();
    const { t, locale } = useLanguage();
    const { user, profile, isLoading: authLoading } = useAuth();

    // Login modal controlled by user action
    const [showLoginModal, setShowLoginModal] = useState(false);

    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
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

    // ── Fetch ──────────────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        (async () => {
            setIsLoading(true);
            setFetchError('');
            try {
                const data = await api.get('/products');
                if (!mounted) return;
                if (Array.isArray(data) && data.length > 0) {
                    setProducts(data);
                    setQuantities(data.reduce((a: any, p: any) => ({ ...a, [p.id]: Number(p.category?.min_qty) || 1 }), {}));
                } else {
                    setFetchError('empty');
                }
            } catch (e: any) {
                if (mounted) setFetchError(e.message || 'error');
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // ── Cart handlers ──────────────────────────────────────────────────────
    const handleIncrement = (id: number) => {
        const prod = products.find(p => p.id === id);
        const min = Number(prod?.category?.min_qty) || 1;
        setQuantities(p => ({ ...p, [id]: (p[id] || min) + 1 }));
    };
    const handleDecrement = (id: number) => {
        const prod = products.find(p => p.id === id);
        const min = Number(prod?.category?.min_qty) || 1;
        setQuantities(p => ({ ...p, [id]: Math.max(min, (p[id] || min) - 1) }));
    };
    const handleQuantityChange = (id: number, val: string) => {
        const prod = products.find(p => p.id === id);
        const min = Number(prod?.category?.min_qty) || 1;
        if (val === '') {
            setQuantities(p => ({ ...p, [id]: '' as any }));
            return;
        }
        const num = parseInt(val);
        if (!isNaN(num) && num < min) return; // Ignore if below min while typing
        setQuantities(p => ({ ...p, [id]: isNaN(num) ? min : num }));
    };
    const handleAddToCart = (product: any) => {
        let q = Number(quantities[product.id]);
        const min = Number(product.category?.min_qty) || 1;
        if (isNaN(q) || q < min) q = min;
        addToCart(product, q);
        setAddedIds(p => [...p, product.id]);
        setTimeout(() => setAddedIds(p => p.filter(i => i !== product.id)), 2000);
    };

    // ── Category groups (Sorted by highest product count descending) ───────
    const categoryGroups = useMemo(() => {
        const map: Record<string, { labelEn: string; items: any[] }> = {};
        products.forEach(p => {
            const key = p.category?.name || 'Other';
            if (!map[key]) map[key] = { labelEn: p.category?.name_en || key, items: [] };
            map[key].items.push(p);
        });
        return Object.entries(map)
            .sort(([keyA, a], [keyB, b]) => (b.items.length - a.items.length) || keyA.localeCompare(keyB))
            .map(([key, { labelEn, items }]) => ({
                key,
                label: locale === 'en' ? labelEn : key,
                count: items.length,
                products: items.sort((a, b) => a.name.localeCompare(b.name)),
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

    // ── Search results ─────────────────────────────────────────────────────
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return products
            .filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.category?.name || '').toLowerCase().includes(q) ||
                (p.category?.name_en || '').toLowerCase().includes(q)
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    // ── Promotions: 6 lowest-priced products ──────────────────────────────
    const promotions = useMemo(() => {
        if (!products.length) return [];
        return [...products]
            .sort((a, b) =>
                parseFloat(String(a.price).replace(',', '.')) -
                parseFloat(String(b.price).replace(',', '.'))
            )
            .slice(0, 6);
    }, [products]);

    const catPills = categoryGroups.map(g => ({ key: g.key, label: g.label, count: g.products.length }));

    // "View All" label with category name
    const viewAllLabel = locale === 'en' ? 'View All' : 'Ver todos';

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#fdfcfb 0%,#f9f6f0 100%)' }}>
            {/* Login modal — visible when requested */}
            {showLoginModal && (
                <LoginModal 
                    onSuccess={() => setShowLoginModal(false)} 
                    onClose={() => setShowLoginModal(false)}
                />
            )}

            <Navbar />

            <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-14 py-10">

                {/* ── Wholesale Welcome Hero Banner ─── */}
                <div className="mb-12 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-12 border border-border/60 shadow-sm relative overflow-hidden">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-4">
                            <Sparkles size={14} /> {locale === 'en' ? 'Artisanal Wholesale Bakery' : 'Distribución Mayorista Artesanal'}
                        </div>
                        <h1 className="text-3xl sm:text-5xl font-black font-serif text-foreground tracking-tight mb-4 leading-tight">
                            {locale === 'en' ? 'Fresh Daily B2B Distribution' : 'Catálogo Mayorista de Panadería y Pastelería'}
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed mb-8">
                            {locale === 'en' 
                                ? 'Orders placed before 12:00 PM are prepared fresh for next-cycle delivery. Transparent wholesale pricing, automated delivery fees, and flexible payment terms for restaurants, cafes, and supermarkets.'
                                : 'Pedidos recibidos antes de las 12:00 p. m. preparados frescos para entrega en el siguiente ciclo. Precios mayoristas transparentes, cálculo logístico de delivery y facilidades de pago para cafeterías y restaurantes.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                            <a href="#catalogo" className="px-6 py-3 rounded-full bg-primary text-white text-xs font-black uppercase tracking-widest shadow-md hover:bg-black transition-all">
                                {locale === 'en' ? 'Browse Catalog' : 'Ver Productos'}
                            </a>
                            <Link href="/terms" className="px-6 py-3 rounded-full bg-white border border-border text-foreground text-xs font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm">
                                {locale === 'en' ? 'Commercial Policies' : 'Términos y Horarios'}
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Category Navigation Rail + Search Bar ─── */}
                <div id="catalogo" className="mb-10 flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white/70 backdrop-blur-md p-3 sm:p-3.5 rounded-[2rem] border border-border/60 shadow-xs">
                    
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
                            {/* "All" pill — always first */}
                            <a
                                href="#catalogo"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setSearchQuery('');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider shadow-xs transition-all ${!searchQuery ? 'bg-primary text-white shadow-sm' : 'bg-white border border-border/60 text-foreground/70 hover:bg-primary/5 hover:text-primary'}`}
                            >
                                <span>{locale === 'en' ? 'All' : 'Todos'}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${!searchQuery ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                                    {products.length}
                                </span>
                            </a>

                            {/* Category pills ordered by highest product count */}
                            {!isLoading && catPills.map(({ key, label, count }) => (
                                <Link
                                    key={key}
                                    href={`/catalog/category/${encodeURIComponent(key)}`}
                                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-border/60 text-[11px] font-black uppercase tracking-wider text-foreground/75 hover:bg-primary hover:text-white hover:border-primary shadow-xs transition-all group"
                                >
                                    <span>{label}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-muted group-hover:bg-white/20 text-muted-foreground group-hover:text-white transition-colors">
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

                {/* ── Loading ─────────────────────────────────────────── */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-40 gap-5">
                        <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                            {t.catalog.loading}
                        </p>
                    </div>
                )}

                {/* ── Error ───────────────────────────────────────────── */}
                {!isLoading && fetchError && (
                    <div className="rounded-3xl bg-red-50 border border-red-100 p-10 text-center">
                        <p className="text-red-600 font-bold mb-1">
                            {locale === 'en' ? 'Could not load products' : 'No se pudieron cargar los productos'}
                        </p>
                        <p className="text-red-400 text-sm mb-4">
                            {fetchError === 'empty'
                                ? (locale === 'en' ? 'The catalog is empty.' : 'El catálogo está vacío.')
                                : fetchError}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-primary/90"
                        >
                            {locale === 'en' ? 'Retry' : 'Reintentar'}
                        </button>
                    </div>
                )}

                {/* ── Search results ──────────────────────────────────── */}
                {!isLoading && !fetchError && isSearching && (
                    <section className="mb-14">
                        <p className="text-xl font-black mb-1">
                            {t.catalog.searchResults}:{' '}
                            <span className="text-primary">"{searchQuery}"</span>
                        </p>
                        <p className="text-sm text-muted-foreground mb-5">
                            {searchResults.length} {locale === 'en' ? 'results' : 'resultados'}
                        </p>
                        {searchResults.length === 0 ? (
                            <div className="py-16 text-center bg-white rounded-3xl border border-border/40">
                                <p className="text-muted-foreground font-medium">{t.catalog.noProducts}</p>
                            </div>
                        ) : (
                            <div className="grid gap-4"
                                 style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,220px),1fr))' }}>
                                {searchResults.map(p => (
                                    <ProductCard
                                        key={p.id}
                                        product={p}
                                        quantity={quantities[p.id] || 1}
                                        isInCart={cart.find(i => i.id === p.id)?.quantity}
                                        isJustAdded={addedIds.includes(p.id)}
                                        onIncrement={handleIncrement}
                                        onDecrement={handleDecrement}
                                        onQuantityChange={handleQuantityChange}
                                        onAddToCart={handleAddToCart}
                                        profile={profile}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* ── Category carousels ──────────────────────────────── */}
                {!isLoading && !fetchError && !isSearching && categoryGroups.map((group, gIdx) => (
                    <section
                        key={group.key}
                        id={`cat-${group.key}`}
                        className="mb-14 scroll-mt-24"
                    >
                        <CategoryCarousel
                            group={group}
                            quantities={quantities}
                            addedIds={addedIds}
                            cart={cart}
                            onIncrement={handleIncrement}
                            onDecrement={handleDecrement}
                            onQuantityChange={handleQuantityChange}
                            onAddToCart={handleAddToCart}
                            locale={locale}
                            viewAllLabel={viewAllLabel}
                            profile={profile}
                        />

                        {/* Divider */}
                        {gIdx < categoryGroups.length - 1 && (
                            <div className="mt-12 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                        )}
                    </section>
                ))}

                {/* ── Promotions ──────────────────────────────────────── */}
                {!isLoading && !fetchError && !isSearching && promotions.length > 0 && (
                    <section className="mt-4 mb-16">
                        {/* Banner — dark background */}
                        <div
                            className="relative overflow-hidden rounded-[2rem] mb-6 p-7 sm:p-10"
                            style={{ background: 'linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 60%,#2a2a2a 100%)' }}
                        >
                            <div className="absolute inset-0 opacity-[0.07]"
                                 style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")` }} />
                            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={13} className="text-amber-300" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">
                                            {locale === 'en' ? 'Special Offers' : 'Ofertas Especiales'}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                        {t.catalog.promotions}
                                    </h2>
                                    <p className="text-white/60 mt-1 text-sm">{t.catalog.promotionsSubtitle}</p>
                                </div>
                                <div className="px-5 py-2.5 bg-white/10 rounded-2xl border border-white/20 flex items-center gap-2 shrink-0">
                                    <Tag size={15} className="text-amber-300" />
                                    <span className="font-black text-sm uppercase tracking-widest text-white">
                                        {locale === 'en' ? 'Best Prices' : 'Mejores Precios'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Promo products — same carousel style */}
                        <div className="relative group/row">
                            <div
                                className="flex gap-4 overflow-x-auto scroll-smooth pb-1"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {promotions.map(product => (
                                    <div key={`promo-${product.id}`} className="relative shrink-0" style={{ width: '220px', minWidth: '220px' }}>
                                        <div className="absolute top-2 left-2 z-20 bg-amber-400 text-white text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                                            <Sparkles size={8} />
                                            {locale === 'en' ? 'Deal' : 'Oferta'}
                                        </div>
                                        <ProductCard
                                            product={product}
                                            quantity={quantities[product.id] || 1}
                                            isInCart={cart.find(i => i.id === product.id)?.quantity}
                                            isJustAdded={addedIds.includes(product.id)}
                                            onIncrement={handleIncrement}
                                            onDecrement={handleDecrement}
                                            onQuantityChange={handleQuantityChange}
                                            onAddToCart={handleAddToCart}
                                            profile={profile}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

            </main>
        </div>
    );
}
