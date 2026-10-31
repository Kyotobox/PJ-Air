'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';
import {
    Package, Truck, CheckCircle2, AlertCircle, Clock, Eye, Loader2,
    ShoppingBag, ChevronDown, CreditCard, Wallet, TrendingUp, Calendar,
    CheckSquare, Square, ShoppingCart, MessageSquare, ArrowRight,
    RefreshCw, X, ShieldAlert, Sparkles, Check, ChevronLeft, ChevronRight,
    Building2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import FinancialStatusBadge from '@/components/orders/FinancialStatusBadge';

const getClientStatusOptions = (t: any) => [
    { value: 'Pedido Enviado',  label: t.orders.orderShipped },
    { value: 'Pedido Recibido', label: t.orders.markAsReceived },
];

export default function ClientOrdersPage() {
    const { user, profile } = useAuth();
    const { addToCart } = useCart();
    const router = useRouter();
    const { t, locale } = useLanguage();

    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Credit Health State (TASK-48-01)
    const [creditSummary, setCreditSummary] = useState<{
        credit_limit: number;
        used_credit: number;
        available_credit: number;
        credit_blocked?: boolean;
        credit_override?: boolean;
    } | null>(null);
    const [isRefreshingCredit, setIsRefreshingCredit] = useState(false);

    // Multi-Order Settlement State (TASK-48-03 & TASK-48-04)
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [settlementMethod, setSettlementMethod] = useState<'card' | 'ach' | 'zelle' | 'check'>('card');
    const [settlementReference, setSettlementReference] = useState('');
    const [isSettling, setIsSettling] = useState(false);
    const [settlementSuccess, setSettlementSuccess] = useState<string | null>(null);

    // Frequent Products Carousel State (TASK-48-05)
    const [frequentProducts, setFrequentProducts] = useState<any[]>([]);
    const [addedSku, setAddedSku] = useState<number | null>(null);

    // Feedback Suggestion Box State (TASK-48-06)
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackCategory, setFeedbackCategory] = useState('sugerencia');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    const CLIENT_STATUS_OPTIONS = getClientStatusOptions(t);

    const fetchCreditStatus = async () => {
        setIsRefreshingCredit(true);
        try {
            const data = await api.get('/credit/status') as any;
            if (data && typeof data.credit_limit !== 'undefined') {
                setCreditSummary(data);
            }
        } catch (err) {
            console.error('Error fetching credit status:', err);
        } finally {
            setIsRefreshingCredit(false);
        }
    };

    const fetchFrequentProducts = async () => {
        try {
            const data = await api.get('/orders/frequent-products') as any[];
            setFrequentProducts(data || []);
        } catch (err) {
            console.error('Error fetching frequent products:', err);
        }
    };

    const fetchOrders = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await api.get(`/orders/user/${user.id}`) as any[];
            setOrders(data || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchOrders();
            fetchCreditStatus();
            fetchFrequentProducts();
        }
    }, [user]);

    // Metrics Calculations (TASK-48-02)
    const metrics = useMemo(() => {
        if (!orders || orders.length === 0) {
            return {
                lastOrder: null,
                currentMonthSpend: 0,
                inTransitCount: 0,
            };
        }

        const validOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'Cancelado');

        // 1. Última Compra
        const sorted = [...validOrders].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastOrder = sorted[0] || null;

        // 2. Consumo del Mes Actual
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const currentMonthOrders = validOrders.filter(o => {
            const d = new Date(o.created_at);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
        const currentMonthSpend = currentMonthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // 3. Órdenes en Tránsito
        const inTransitOrders = validOrders.filter(o => {
            const s = (o.status || '').toLowerCase();
            return (
                s.includes('enviado') ||
                s.includes('delivery') ||
                s.includes('camino') ||
                s.includes('shipped') ||
                s.includes('tránsito')
            );
        });

        return {
            lastOrder,
            currentMonthSpend: Math.round((currentMonthSpend + Number.EPSILON) * 100) / 100,
            inTransitCount: inTransitOrders.length,
        };
    }, [orders]);

    // Unpaid Credit Orders for Multi-Settlement (TASK-48-03)
    const unpaidCreditOrders = useMemo(() => {
        return orders.filter(
            o =>
                o.payment_method === 'credit' &&
                o.payment_status !== 'paid' &&
                o.status !== 'cancelled' &&
                o.status !== 'Cancelado'
        );
    }, [orders]);

    // Multi-Order live calculation
    const settlementTotals = useMemo(() => {
        const selected = unpaidCreditOrders.filter(o => selectedOrderIds.includes(o.id));
        const subtotal = selected.reduce((sum, o) => {
            const net = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
            return sum + net;
        }, 0);

        let feeAmount = 0;
        let feePercentage = 0;
        if (settlementMethod === 'card') {
            feePercentage = 3.5;
            feeAmount = Math.round((subtotal * 0.035 + Number.EPSILON) * 100) / 100;
        } else if (settlementMethod === 'ach') {
            feePercentage = 0.8;
            feeAmount = Math.min(5.00, Math.round((subtotal * 0.008 + Number.EPSILON) * 100) / 100);
        } else {
            feePercentage = 0.0;
            feeAmount = 0.0;
        }

        const totalWithFee = Math.round((subtotal + feeAmount + Number.EPSILON) * 100) / 100;

        return {
            count: selected.length,
            subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
            feeAmount,
            feePercentage,
            totalWithFee,
        };
    }, [unpaidCreditOrders, selectedOrderIds, settlementMethod]);

    const handleToggleOrderSelection = (id: string) => {
        setSelectedOrderIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedOrderIds.length === unpaidCreditOrders.length) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(unpaidCreditOrders.map(o => o.id));
        }
    };

    const handleBatchSettlement = async () => {
        if (selectedOrderIds.length === 0) return;
        setIsSettling(true);
        setSettlementSuccess(null);
        try {
            const payload = {
                order_ids: selectedOrderIds,
                payment_method: settlementMethod,
                payment_reference: settlementReference.trim() || undefined,
            };
            const res = await api.post('/orders/settle-batch', payload) as any;
            setSettlementSuccess(
                locale === 'en'
                    ? `Successfully settled ${res.settled_count} invoice(s). Cupo restored: $${(res.available_credit || 0).toFixed(2)}.`
                    : `¡Se liquidaron exitosamente ${res.settled_count} factura(s)! Cupo disponible actualizado: $${(res.available_credit || 0).toFixed(2)}.`
            );
            setSelectedOrderIds([]);
            setSettlementReference('');
            await fetchOrders();
            await fetchCreditStatus();
        } catch (err: any) {
            console.error('Error during batch settlement:', err);
            alert(err?.message || 'Error al procesar la liquidación por lotes');
        } finally {
            setIsSettling(false);
        }
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar el estado');
        }
    };

    const handleAddFrequentToCart = (product: any) => {
        addToCart(product, 1);
        setAddedSku(product.id);
        setTimeout(() => setAddedSku(null), 1800);
    };

    const handleSendFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackMessage.trim()) return;
        setIsSubmittingFeedback(true);
        try {
            await api.post('/feedback', {
                category: feedbackCategory,
                message: feedbackMessage.trim(),
            });
            setFeedbackSubmitted(true);
            setTimeout(() => {
                setFeedbackSubmitted(false);
                setIsFeedbackOpen(false);
                setFeedbackMessage('');
            }, 2000);
        } catch (err) {
            console.error('Error submitting feedback:', err);
            alert('Error al enviar mensaje. Por favor intente nuevamente.');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const getStatusIcon = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s.includes('enviado')) return <Clock className="text-blue-500" />;
        if (s.includes('producción') || s.includes('processing')) return <Package className="text-orange-500" />;
        if (s.includes('delivery') || s.includes('camino')) return <Truck className="text-purple-500" />;
        if (s.includes('recibido') || s.includes('entregado')) return <CheckCircle2 className="text-green-500" />;
        return <AlertCircle className="text-muted-foreground" />;
    };

    const isClientEditable = (status: string) => {
        const s = (status || '').toLowerCase();
        return s.includes('enviado') || s.includes('delivery') || s.includes('camino');
    };

    // Fallback credit calculation if API returned null
    const displayCredit = useMemo(() => {
        if (creditSummary) return creditSummary;
        const limit = Number(profile?.credit_limit || user?.credit_limit || 0);
        const used = unpaidCreditOrders.reduce((sum, o) => {
            const net = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
            return sum + net;
        }, 0);
        const available = Math.max(0, limit - used);
        return {
            credit_limit: limit,
            used_credit: Math.round((used + Number.EPSILON) * 100) / 100,
            available_credit: Math.round((available + Number.EPSILON) * 100) / 100,
            credit_blocked: Boolean(user?.credit_blocked),
            credit_override: Boolean(user?.credit_override),
        };
    }, [creditSummary, profile, user, unpaidCreditOrders]);

    const creditUtilizationPct = useMemo(() => {
        if (!displayCredit.credit_limit || displayCredit.credit_limit <= 0) return 0;
        return Math.min(100, Math.round((displayCredit.used_credit / displayCredit.credit_limit) * 100));
    }, [displayCredit]);

    // Determine if the current session corresponds to a B2B Wholesale account
    const isB2BWholesale = useMemo(() => {
        return (
            (displayCredit && displayCredit.credit_limit > 0) ||
            profile?.account_type === 'credit' ||
            Boolean(profile?.company_name) ||
            Boolean(profile?.tax_id)
        );
    }, [displayCredit, profile]);

    return (
        <div className="min-h-screen bg-[#f8f9fa]">
            <Navbar />

            <main className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8 animate-fade-in">
                {/* Header Banner Aligned with Jhoanes Gourmet Design System */}
                <div className="bg-card rounded-[2rem] border border-border/70 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl md:text-4xl font-bold font-serif text-primary tracking-tight">
                                {t.orders.title}
                            </h1>
                            {isB2BWholesale && (
                                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest shadow-sm">
                                    <Building2 size={13} className="text-primary" />
                                    <span>{locale === 'en' ? 'Wholesale B2B' : 'Cuenta Mayorista B2B'}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">
                            {isB2BWholesale
                                ? (locale === 'en'
                                    ? 'Wholesale order tracking, real-time Net-7 credit monitoring, and 1-click reorder.'
                                    : 'Seguimiento de pedidos comerciales, línea de crédito Net-7 y reposición ágil en 1-clic.')
                                : t.orders.subtitleTracking}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => setIsFeedbackOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-primary/5 border border-primary/20 text-primary rounded-2xl text-xs font-bold transition-all shadow-sm hover:shadow cursor-pointer"
                        >
                            <MessageSquare size={16} className="text-primary" />
                            <span>{locale === 'en' ? 'B2B Feedback' : 'Buzón de Sugerencias'}</span>
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* TASK-48-01: HERO CREDIT HEALTH CARDS (Crédito en Vivo)   */}
                {/* ======================================================== */}
                {isB2BWholesale && (
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-primary rounded-[2rem] p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                                    <Wallet size={24} className="text-emerald-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black tracking-wide uppercase font-serif">
                                            {locale === 'en' ? 'Financial Credit Health' : 'Salud Financiera de Crédito'}
                                        </h2>
                                        {displayCredit.credit_blocked && (
                                            <span className="px-2 py-0.5 bg-red-500/80 text-white rounded text-[10px] font-black uppercase">
                                                {locale === 'en' ? 'Blocked' : 'Bloqueado'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        {locale === 'en' ? '7-day net terms authorized limit' : 'Línea de crédito autorizada a 7 días calendario'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={fetchCreditStatus}
                                disabled={isRefreshingCredit}
                                className="self-start md:self-auto flex items-center gap-2 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all text-slate-200"
                            >
                                <RefreshCw size={13} className={isRefreshingCredit ? 'animate-spin' : ''} />
                                {locale === 'en' ? 'Refresh' : 'Actualizar'}
                            </button>
                        </div>

                        {/* 3 Main Credit Metric Cards */}
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                            {/* 1. Límite Total */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                                    {locale === 'en' ? 'Total Credit Limit' : 'Límite Total Autorizado'}
                                </p>
                                <p className="text-3xl font-black text-white">
                                    ${displayCredit.credit_limit.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-2">
                                    {displayCredit.credit_override ? '⭐ Cupo con excepción autorizada' : 'Línea estándar mayorista'}
                                </p>
                            </div>

                            {/* 2. Crédito Usado / Pendiente */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300 mb-1">
                                    {locale === 'en' ? 'Used / Pending Credit' : 'Crédito Utilizado'}
                                </p>
                                <p className="text-3xl font-black text-amber-300">
                                    ${displayCredit.used_credit.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-slate-300 mt-2">
                                    {unpaidCreditOrders.length} {locale === 'en' ? 'invoice(s) awaiting payment' : 'factura(s) pendiente(s)'}
                                </p>
                            </div>

                            {/* 3. Crédito Disponible */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-1">
                                    {locale === 'en' ? 'Available Credit' : 'Cupo Disponible'}
                                </p>
                                <p className="text-3xl font-black text-emerald-400">
                                    ${displayCredit.available_credit.toFixed(2)}
                                </p>
                                <p className="text-[11px] text-slate-300 mt-2">
                                    {displayCredit.available_credit > 0
                                        ? (locale === 'en' ? 'Ready for new orders' : 'Disponible para nuevos pedidos')
                                        : (locale === 'en' ? 'Credit exhausted' : 'Cupo agotado')}
                                </p>
                            </div>
                        </div>

                        {/* Utilization Progress Bar */}
                        <div className="relative z-10 mt-6 pt-4 border-t border-white/10">
                            <div className="flex justify-between items-center text-xs font-bold mb-2">
                                <span className="text-slate-300">
                                    {locale === 'en' ? 'Credit Utilization' : 'Utilización de Cupo'}
                                </span>
                                <span className={creditUtilizationPct > 80 ? 'text-amber-400 font-black' : 'text-slate-200'}>
                                    {creditUtilizationPct}%
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                        creditUtilizationPct > 85 ? 'bg-red-500' : creditUtilizationPct > 65 ? 'bg-amber-400' : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${creditUtilizationPct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* TASK-48-02: ACTIVITY & CONSUMPTION WIDGETS CARDS         */}
                {/* ======================================================== */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Widget 1: Última Compra */}
                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Calendar size={26} />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">
                                {locale === 'en' ? 'Last Purchase' : 'Última Compra'}
                            </p>
                            {metrics.lastOrder ? (
                                <>
                                    <p className="text-xl font-black text-foreground truncate">
                                        ${(Number(metrics.lastOrder.total) || 0).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-medium truncate">
                                        {new Date(metrics.lastOrder.created_at).toLocaleDateString()} · #{metrics.lastOrder.id.slice(0, 8)}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Sin compras registradas</p>
                            )}
                        </div>
                    </div>

                    {/* Widget 2: Consumo del Mes Actual */}
                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                            <TrendingUp size={26} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">
                                {locale === 'en' ? 'Current Month Spend' : 'Consumo del Mes'}
                            </p>
                            <p className="text-xl font-black text-emerald-600">
                                ${metrics.currentMonthSpend.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                                {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    {/* Widget 3: Órdenes en Tránsito */}
                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                        <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
                            <Truck size={26} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">
                                {locale === 'en' ? 'Orders In Transit' : 'Órdenes en Tránsito'}
                            </p>
                            <p className="text-xl font-black text-purple-600">
                                {metrics.inTransitCount} {locale === 'en' ? 'order(s)' : 'pedido(s)'}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                                {metrics.inTransitCount > 0 ? 'En reparto comercial de van' : 'Sin entregas pendientes'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* TASK-48-05: FREQUENT PRODUCTS CAROUSEL (1-Clic Reorder)  */}
                {/* ======================================================== */}
                {frequentProducts && frequentProducts.length > 0 && (
                    <div className="bg-card rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Sparkles size={20} className="text-amber-500" />
                                <div>
                                    <h3 className="text-lg font-black text-foreground">
                                        {locale === 'en' ? 'Your Frequent SKUs (1-Click Reorder)' : 'Tus Productos Frecuentes (Reorden en 1 Clic)'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {locale === 'en' ? 'Most ordered bakery goods ready to add to cart' : 'Los panes y productos más ordenados listos para añadir'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 scrollbar-thin">
                            {frequentProducts.map((prod) => (
                                <div
                                    key={prod.id}
                                    className="min-w-[220px] max-w-[220px] bg-background rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between shrink-0"
                                >
                                    <div>
                                        <div className="w-full h-28 bg-muted rounded-xl relative overflow-hidden mb-3 flex items-center justify-center">
                                            {prod.image ? (
                                                <img
                                                    src={prod.image}
                                                    alt={prod.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ShoppingBag size={32} className="text-muted-foreground/30" />
                                            )}
                                            {prod.total_purchased_units > 0 && (
                                                <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm text-white rounded text-[9px] font-black uppercase">
                                                    {prod.total_purchased_units} uds
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-xs line-clamp-2 text-foreground mb-1" title={prod.name}>
                                            {prod.name}
                                        </h4>
                                        <p className="text-sm font-black text-primary">
                                            ${(Number(prod.price) || 0).toFixed(2)}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleAddFrequentToCart(prod)}
                                        className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                                            addedSku === prod.id
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-primary hover:bg-primary/90 text-white'
                                        }`}
                                    >
                                        {addedSku === prod.id ? (
                                            <>
                                                <Check size={14} /> ¡Añadido!
                                            </>
                                        ) : (
                                            <>
                                                <ShoppingCart size={14} /> Reordenar
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* TASK-48-03 & TASK-48-04: MULTI-ORDER SETTLEMENT SELECTOR */}
                {/* ======================================================== */}
                {unpaidCreditOrders.length > 0 && (
                    <div className="bg-card rounded-3xl border border-primary/20 shadow-md p-6 md:p-8 space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                                        <CreditCard size={20} />
                                    </div>
                                    <h3 className="text-xl font-black text-foreground">
                                        {locale === 'en' ? 'Multi-Order Batch Settlement' : 'Liquidación Consolidada de Facturas a Crédito'}
                                    </h3>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {locale === 'en'
                                        ? 'Select multiple invoices to pay in 1 single transaction and instantly release your credit limit.'
                                        : 'Selecciona varias facturas para saldarlas en una sola transacción y liberar cupo de inmediato.'}
                                </p>
                            </div>

                            <button
                                onClick={handleToggleSelectAll}
                                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border rounded-xl text-xs font-bold text-foreground transition-all self-start md:self-auto"
                            >
                                {selectedOrderIds.length === unpaidCreditOrders.length ? (
                                    <>
                                        <CheckSquare size={16} className="text-primary" /> Deseleccionar Todas
                                    </>
                                ) : (
                                    <>
                                        <Square size={16} /> Seleccionar Todas ({unpaidCreditOrders.length})
                                    </>
                                )}
                            </button>
                        </div>

                        {settlementSuccess && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} />
                                    <span>{settlementSuccess}</span>
                                </div>
                                <button onClick={() => setSettlementSuccess(null)} className="text-emerald-800 hover:text-emerald-950">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Unpaid Orders Checkbox List */}
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {unpaidCreditOrders.map(order => {
                                const isSelected = selectedOrderIds.includes(order.id);
                                const netDebt = Math.max(0, (Number(order.total) || 0) - (Number(order.refunded_amount) || 0));
                                return (
                                    <div
                                        key={order.id}
                                        onClick={() => handleToggleOrderSelection(order.id)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                            isSelected
                                                ? 'bg-primary/5 border-primary shadow-sm'
                                                : 'bg-background border-border hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-primary">
                                                {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-muted-foreground" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">#{order.id.slice(0, 8)}</span>
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                                        Crédito
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Fecha: {new Date(order.created_at).toLocaleDateString()}
                                                    {order.payment_due_date && (
                                                        <span className="text-red-500 font-bold ml-2">
                                                            · Vence: {order.payment_due_date}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0">
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase font-black text-muted-foreground">Monto Pendiente</p>
                                                <p className="text-base font-black text-foreground">${netDebt.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Settlement Calculation & 1-Click Pay Bar */}
                        {selectedOrderIds.length > 0 && (
                            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                                    <div>
                                        <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                                            {locale === 'en' ? 'Payment Method for Settlement' : 'Método de Pago para Liquidación'}
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {[
                                                { id: 'card',  name: 'Tarjeta / Stripe', feeLabel: '+3.5%' },
                                                { id: 'ach',   name: 'ACH Bancario', feeLabel: '+0.8% (tope $5)' },
                                                { id: 'zelle', name: 'Zelle', feeLabel: '0.0%' },
                                                { id: 'check', name: 'Cheque', feeLabel: '0.0%' },
                                            ].map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setSettlementMethod(m.id as any)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                        settlementMethod === m.id
                                                            ? 'bg-primary text-white shadow-md'
                                                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                                    }`}
                                                >
                                                    {m.name} <span className="text-[10px] opacity-75 font-normal">({m.feeLabel})</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {(settlementMethod === 'zelle' || settlementMethod === 'check') && (
                                        <div className="w-full md:w-64">
                                            <label className="text-[10px] font-black uppercase text-slate-400">
                                                Nro. Referencia / Cheque
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: CHK-4091 / Conf. Zelle"
                                                value={settlementReference}
                                                onChange={(e) => setSettlementReference(e.target.value)}
                                                className="w-full px-3 py-1.5 mt-1 bg-white/10 border border-white/20 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-400">
                                            {settlementTotals.count} {locale === 'en' ? 'factura(s) seleccionada(s)' : 'factura(s) seleccionada(s)'}
                                        </p>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-slate-400 text-xs">Subtotal: ${settlementTotals.subtotal.toFixed(2)}</span>
                                            {settlementTotals.feeAmount > 0 && (
                                                <span className="text-amber-400 text-xs font-bold">
                                                    + Fee ({settlementTotals.feePercentage}%): ${settlementTotals.feeAmount.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-2xl font-black text-emerald-400">
                                            Total a Saldar: ${settlementTotals.totalWithFee.toFixed(2)}
                                        </p>
                                    </div>

                                    <button
                                        disabled={isSettling}
                                        onClick={handleBatchSettlement}
                                        className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        {isSettling ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Procesando Liquidación...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} /> Saldar {settlementTotals.count} Factura(s) en 1-Clic
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ======================================================== */}
                {/* HISTORIAL GENERAL DE ÓRDENES                             */}
                {/* ======================================================== */}
                <div className="space-y-4">
                    <h3 className="text-xl font-black text-foreground font-serif">
                        {locale === 'en' ? 'All Orders History' : 'Historial de Pedidos'}
                    </h3>

                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                                <Loader2 size={40} className="animate-spin text-primary/20 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.common.loading}</p>
                            </div>
                        ) : orders.length > 0 ? (
                            orders.map(order => (
                                <div key={order.id} className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex items-center gap-6 w-full md:w-auto">
                                            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center shrink-0">
                                                {getStatusIcon(order.status)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className="text-xl font-bold">{t.orders.orderNumber} #{order.id.slice(0, 8)}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                        (order.status || '').toLowerCase().includes('recibido') || (order.status || '').toLowerCase().includes('entregado')
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        {order.status === 'Pedido Recibido' ? t.orders.delivered : (order.status === 'Pedido Enviado' ? t.orders.shipping : order.status)}
                                                    </span>
                                                    {/* Payment Financial Status Badge */}
                                                    <FinancialStatusBadge order={order} locale={locale} size="normal" />
                                                </div>
                                                <p className="text-sm text-muted-foreground font-medium">{t.orders.orderedOn} {new Date(order.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 md:flex items-center gap-6 md:gap-8 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Total</p>
                                                <p className="text-lg font-black">${(Number(order.total) || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">{locale === 'en' ? 'Payment' : 'Pago'}</p>
                                                <div className="flex flex-col">
                                                    <FinancialStatusBadge order={order} locale={locale} size="sm" />
                                                    {order.payment_due_date && (
                                                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                                            {locale === 'en' ? `Due: ${order.payment_due_date}` : `Vence: ${order.payment_due_date}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">{locale === 'en' ? 'Delivery' : 'Entrega'}</p>
                                                <p className="text-sm font-bold text-foreground">{order.delivery_date || (locale === 'en' ? 'Pending' : 'Pendiente')}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                                            {/* Client status dropdown */}
                                            {isClientEditable(order.status) && (
                                                <div className="relative flex-1 md:flex-none">
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                        className="appearance-none w-full pl-4 pr-8 py-3 bg-primary/5 border border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest text-primary cursor-pointer hover:bg-primary/10 transition-all outline-none"
                                                    >
                                                        {CLIENT_STATUS_OPTIONS.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                                                </div>
                                            )}

                                            {order.payment_status === 'pending' && (
                                                <button
                                                    onClick={() => router.push(`/orders/${order.id}`)}
                                                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                                >
                                                    <CreditCard size={14} />
                                                    {locale === 'en' ? 'Pay' : 'Pagar'}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                                className="flex-1 md:flex-none p-3 bg-muted text-foreground rounded-xl hover:bg-border transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Eye size={18} /> <span className="md:hidden">Ver Detalle</span>
                                            </button>
                                        </div>
                                    </div>

                                    {((order.status || '').toLowerCase().includes('recibido') || (order.status || '').toLowerCase().includes('entregado')) && order.payment_due_date && (
                                        <div className="bg-primary/5 px-8 py-4 border-t border-primary/10 flex justify-between items-center">
                                            <p className="text-xs font-bold text-primary flex items-center gap-2">
                                                <Clock size={14} /> {t.orders.paymentDueNotice} <span className="underline uppercase">{order.payment_due_date}</span>
                                            </p>
                                            <button
                                                onClick={() => router.push(`/orders/${order.id}`)}
                                                className="text-[10px] font-black text-primary border border-primary px-3 py-1 rounded hover:bg-primary hover:text-white transition-all uppercase"
                                            >
                                                {t.orders.viewInvoice}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center bg-muted/20 rounded-3xl border border-dashed border-border flex flex-col items-center">
                                <ShoppingBag className="text-muted-foreground/30 mb-4" size={48} />
                                <p className="text-muted-foreground font-medium mb-6">{t.orders.noOrdersYet}</p>
                                <button onClick={() => router.push('/')} className="premium-button py-3 px-8">{t.orders.startShopping}</button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ======================================================== */}
            {/* TASK-48-06: MODAL BUZÓN DE SUGERENCIAS / FEEDBACK        */}
            {/* ======================================================== */}
            {isFeedbackOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card rounded-3xl max-w-lg w-full p-6 md:p-8 border border-border shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                                    <MessageSquare size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-foreground">
                                        {locale === 'en' ? 'B2B Suggestion & Feedback Box' : 'Buzón de Sugerencias y Feedback'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {locale === 'en' ? 'Help us improve our service and catalog' : 'Tu opinión es prioritaria para Panadería Jhoanes'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsFeedbackOpen(false)}
                                className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {feedbackSubmitted ? (
                            <div className="py-8 text-center space-y-3">
                                <CheckCircle2 size={48} className="mx-auto text-emerald-500 animate-bounce" />
                                <h4 className="text-base font-bold text-foreground">¡Mensaje Enviado con Éxito!</h4>
                                <p className="text-xs text-muted-foreground">
                                    Nuestro equipo administrativo ha recibido su sugerencia y la atenderá a la brevedad.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSendFeedback} className="space-y-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">
                                        Categoría
                                    </label>
                                    <select
                                        value={feedbackCategory}
                                        onChange={(e) => setFeedbackCategory(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="sugerencia">Sugerencia de Mejora / Catálogo</option>
                                        <option value="reclamo">Reclamo u Observación de Entrega</option>
                                        <option value="producto">Comentario sobre Calidad de Producto</option>
                                        <option value="servicio">Atención o Logística Comercial</option>
                                        <option value="otro">Otro Comentario</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1 block">
                                        Mensaje
                                    </label>
                                    <textarea
                                        rows={5}
                                        required
                                        placeholder="Escribe aquí tu sugerencia, solicitud de nuevo producto o comentario detallado..."
                                        value={feedbackMessage}
                                        onChange={(e) => setFeedbackMessage(e.target.value)}
                                        className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsFeedbackOpen(false)}
                                        className="px-5 py-2.5 bg-muted hover:bg-border text-foreground rounded-xl text-xs font-bold transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingFeedback || !feedbackMessage.trim()}
                                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                                    >
                                        {isSubmittingFeedback ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" /> Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={14} /> Enviar al Administrador
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
