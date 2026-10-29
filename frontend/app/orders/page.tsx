'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';
import { Package, Truck, CheckCircle2, AlertCircle, Clock, Eye, Loader2, ShoppingBag, ChevronDown, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

const getClientStatusOptions = (t: any) => [
    { value: 'Pedido Enviado',  label: t.orders.orderShipped },
    { value: 'Pedido Recibido', label: t.orders.markAsReceived },
];

export default function ClientOrdersPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t, locale } = useLanguage();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const CLIENT_STATUS_OPTIONS = getClientStatusOptions(t);

    useEffect(() => {
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
        fetchOrders();
    }, [user]);

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar el estado');
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

    return (
        <div className="min-h-screen bg-[#f8f9fa]">
            <Navbar />

            <main className="max-w-5xl mx-auto px-4 py-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                    <div>
                        <h1 className="text-4xl font-bold font-serif text-primary mb-2">{t.orders.title}</h1>
                        <p className="text-muted-foreground">{t.orders.subtitleTracking}</p>
                    </div>
                </div>

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
                                                {/* Payment Status Badge */}
                                                {order.payment_status === 'paid' ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        <span>✅</span> {locale === 'en' ? 'Paid' : 'Pagado'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                                        <span>⏳</span> {locale === 'en' ? 'Pending' : 'Pendiente'}
                                                        {order.payment_due_date ? ` (${order.payment_due_date})` : ''}
                                                    </span>
                                                )}
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
                                            {order.payment_status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    ✅ {locale === 'en' ? 'Paid' : 'Pagado'}
                                                </span>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                        ⏳ {locale === 'en' ? 'Pending' : 'Pendiente'}
                                                    </span>
                                                    {order.payment_due_date && (
                                                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                                            {locale === 'en' ? `Due: ${order.payment_due_date}` : `Vence: ${order.payment_due_date}`}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">{locale === 'en' ? 'Delivery' : 'Entrega'}</p>
                                            <p className="text-sm font-bold text-foreground">{order.delivery_date || (locale === 'en' ? 'Pending' : 'Pendiente')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                                        {/* Client status dropdown — visible when order can be confirmed */}
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
                                        <button className="text-[10px] font-black text-primary border border-primary px-3 py-1 rounded hover:bg-primary hover:text-white transition-all uppercase">{t.orders.viewInvoice}</button>
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
            </main>
        </div>
    );
}
