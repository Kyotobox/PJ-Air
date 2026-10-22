'use client';

import React, { useState, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import { Plus, Minus, ShoppingCart, Star, ArrowLeft, Check, ShieldCheck, Clock, Truck, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Product } from '@/lib/products';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { API_URL } from '@/lib/config';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const productId = parseInt(resolvedParams.id);
    const { t, locale } = useLanguage();
    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const { addToCart } = useCart();
    const router = useRouter();
    const [quantity, setQuantity] = useState<number | string>(1);
    const [isAdded, setIsAdded] = useState(false);
    const [showActions, setShowActions] = useState(false);

    React.useEffect(() => {
        const fetchProduct = async () => {
            try {
                const data = await api.get(`/products/${productId}`) as Product;
                setProduct(data);
            } catch (err) {
                console.error('Error fetching product:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProduct();
    }, [productId]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center animate-pulse">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.product.loadingDetails}</p>
            </div>
        );
    }

    if (!product) {
        return <div className="min-h-screen flex items-center justify-center font-bold text-2xl text-foreground">{t.product.productNotFound}</div>;
    }

    const handleAddToCart = () => {
        if (!product) return;
        const qty = Number(quantity) || 1;
        addToCart(product, qty);
        setIsAdded(true);
        setShowActions(true);
        setTimeout(() => setIsAdded(false), 2000);
    };

    const handleIncrement = () => {
        setQuantity(prev => (Number(prev) || 0) + 1);
    };

    const handleDecrement = () => {
        setQuantity(prev => Math.max(1, (Number(prev) || 1) - 1));
    };

    const updateQuantity = (val: string) => {
        if (val === '') {
            setQuantity('');
            return;
        }
        const num = parseInt(val);
        setQuantity(isNaN(num) ? '' : num);
    };

    return (
        <div className="min-h-screen bg-background border-none">
            <Navbar />

            <main className="max-w-7xl mx-auto px-6 py-12 lg:px-12 animate-fade-in">
                <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-12">
                    <ArrowLeft size={14} /> {t.product.backToCatalog}
                </Link>

                <div className="grid lg:grid-cols-2 gap-16 items-start">
                    {/* Image Section */}
                    <div className="relative group">
                        <div className="jhoanes-card p-4 bg-white/50 backdrop-blur-md">
                            <div className="aspect-square rounded-[2rem] overflow-hidden bg-muted/30">
                                <img 
                                    src={product.image?.startsWith('http') ? product.image : `${API_URL}${product.image}`} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=800';
                                    }}
                                />
                            </div>
                        </div>
                        <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 rounded-full blur-[100px]" />
                    </div>

                    {/* Content Section */}
                    <div className="flex flex-col">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-6 w-fit">
                            <Star size={14} fill="currentColor" /> {locale === 'en' ? product.category?.name_en : product.category?.name}
                        </div>
                        
                        <h1 className="text-5xl lg:text-7xl font-black font-serif tracking-tighter text-foreground mb-6 leading-none">
                            {product.name}
                        </h1>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="text-4xl font-semibold text-foreground tracking-tight">${product.price}</div>
                            <div className="h-8 w-[1px] bg-border/40" />
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-tight">
                                {t.product.taxIncluded} <br /> {t.product.freshlyBaked}
                            </div>
                        </div>

                        <p className="text-lg text-muted-foreground font-medium mb-12 leading-relaxed max-w-xl">
                            {product.description}
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch gap-4 mb-12">
                            <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center bg-white border-2 border-neutral-200 rounded-2xl p-1 shadow-sm overflow-hidden focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary/30 transition-all w-full sm:w-48 h-16">
                                <button 
                                    type="button"
                                    onClick={handleDecrement}
                                    className="w-12 h-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-xl"
                                    aria-label="Disminuir cantidad"
                                >
                                    <Minus size={18} strokeWidth={2.5} />
                                </button>
                                <input 
                                    type="number" 
                                    min="1"
                                    value={quantity} 
                                    onChange={(e) => updateQuantity(e.target.value)}
                                    onFocus={(e) => {
                                        if (quantity === 1 || quantity === '1') {
                                            updateQuantity('');
                                        }
                                        e.target.select();
                                    }}
                                    title="Haga clic para editar cantidad"
                                    className="w-full min-w-0 h-full bg-transparent text-center font-bold text-xl outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-pointer focus:bg-primary/5 border-x border-neutral-100" 
                                />
                                <button 
                                    type="button"
                                    onClick={handleIncrement}
                                    className="w-12 h-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-xl"
                                    aria-label="Aumentar cantidad"
                                >
                                    <Plus size={18} strokeWidth={2.5} />
                                </button>
                            </div>

                            <button 
                                onClick={handleAddToCart}
                                className={`flex-1 premium-button h-16 text-xs uppercase tracking-[0.2em] gap-3 transition-all duration-500 ${isAdded ? 'bg-green-500 text-white' : 'jhoanes-gradient text-white'}`}
                            >
                                {isAdded ? (
                                    <><Check size={20} strokeWidth={3} /> {t.product.addedToCart}</>
                                ) : (
                                    <><ShoppingCart size={20} strokeWidth={2.5} /> {t.product.addToOrder}</>
                                )}
                            </button>
                        </div>

                        {/* Post-add CTA buttons */}
                        <div className={`grid grid-cols-2 gap-3 transition-all duration-500 overflow-hidden ${
                            showActions ? 'max-h-20 opacity-100 mb-12' : 'max-h-0 opacity-0'
                        }`}>
                            <button
                                onClick={() => router.push('/')}
                                className="h-14 rounded-2xl border-2 border-black bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
                            >
                                {t.product.continueShopping}
                            </button>
                            <button
                                onClick={() => router.push('/checkout')}
                                className="h-14 rounded-2xl bg-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg"
                            >
                                {t.product.confirmOrder} <ChevronRight size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 p-6 bg-secondary/20 rounded-[2rem] border border-border/40">
                            <div className="flex flex-col items-center text-center gap-2">
                                <Clock size={20} className="text-primary" />
                                <span className="text-[8px] font-black uppercase tracking-widest">{t.product.readyIn}</span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-2 border-x border-border/40">
                                <Truck size={20} className="text-primary" />
                                <span className="text-[8px] font-black uppercase tracking-widest">{t.product.deliveryExpress}</span>
                            </div>
                            <div className="flex flex-col items-center text-center gap-2">
                                <ShieldCheck size={20} className="text-primary" />
                                <span className="text-[8px] font-black uppercase tracking-widest">{t.product.jhoanesGuarantee}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
