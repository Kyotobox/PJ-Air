'use client';

import React, { useState, useEffect, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import { CheckCircle2, Package, Calendar, Clock, MapPin, ChevronRight, ShoppingBag, Receipt, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = use(params);
    const { t, locale } = useLanguage();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrderDetails = async () => {
            setIsLoading(true);
            try {
                const orderData = await api.get(`/orders/${orderId}`) as any;
                setOrder(orderData);
                setItems(orderData.items || []);
            } catch (err) {
                console.error('Error fetching order:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrderDetails();
    }, [orderId]);

    const steps = [
        { key: 'Pedido Enviado', ...t.orders.steps.pending },
        { key: 'En Producción', ...t.orders.steps.processing },
        { key: 'En Delivery', ...t.orders.steps.delivering },
        { key: 'Entregado', ...t.orders.steps.delivered }
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#fafafa]">
                <Navbar />
                <div className="flex flex-col items-center justify-center py-40 animate-pulse">
                    <Loader2 size={48} className="animate-spin text-primary/20 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.common.loading}</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#fafafa]">
                <Navbar />
                <div className="max-w-md mx-auto py-40 text-center">
                    <h1 className="text-2xl font-bold mb-4">{locale === 'en' ? 'Order not found' : 'Pedido no encontrado'}</h1>
                    <Link href="/orders" className="text-primary font-bold underline">{locale === 'en' ? 'Back to my orders' : 'Volver a mis pedidos'}</Link>
                </div>
            </div>
        );
    }

    const currentStepIndex = steps.findIndex(s => s.key === order.status);
    const displayIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

    return (
        <div className="min-h-screen bg-[#fafafa]">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
                <div className="text-center mb-16">
                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-100/50">
                        <CheckCircle2 size={56} />
                    </div>
                    <h1 className="text-4xl font-bold font-serif text-foreground mb-4">{t.orders.confirmed}</h1>
                    <p className="text-lg text-muted-foreground font-medium">{t.orders.thanks}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Tracking & Info */}
                    <div className="lg:col-span-7 space-y-6">
                        <section className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <h2 className="text-xl font-bold mb-8 flex items-center gap-2 font-serif"><Clock className="text-primary" /> {t.orders.tracking}</h2>

                            <div className="relative space-y-12 pl-8 border-l-2 border-border ml-2">
                                {steps.slice(0, 3).map((step, idx) => {
                                    const isActive = displayIndex >= idx;
                                    return (
                                        <div key={step.key} className={`relative ${isActive ? '' : 'opacity-30 grayscale'}`}>
                                            <div className={`absolute -left-[41px] top-1 w-5 h-5 rounded-full ${isActive ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground'}`}></div>
                                            <div>
                                                <p className={`font-black text-sm uppercase tracking-widest ${isActive ? 'text-primary' : ''}`}>{step.label}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="bg-primary/5 rounded-[32px] border border-primary/10 p-8 flex items-center gap-6">
                            <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg">
                                <Calendar size={32} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest mb-1">{t.orders.deliveryDate}</h3>
                                <p className="text-2xl font-bold text-foreground font-serif">{order.delivery_date}</p>
                            </div>
                        </section>
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-5">
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-xl sticky top-28">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold flex items-center gap-2 font-serif"><ShoppingBag size={20} className="text-primary" /> {t.orders.yourPurchase}</h3>
                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded uppercase tracking-widest">#{order.id.toString().slice(0, 8)}</span>
                            </div>

                            <div className="space-y-4 mb-8">
                                {items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-start py-2">
                                        <div>
                                            <p className="font-bold text-sm">{item.quantity}x {item.product?.name || 'Producto'}</p>
                                            <p className="text-xs text-muted-foreground">Especialidad Artesanal</p>
                                        </div>
                                        <p className="font-black text-sm">${((item.price_at_time || item.product?.price || 0) * item.quantity).toFixed(2)}</p>
                                    </div>
                                ))}

                                <div className="pt-6 border-t border-border space-y-3">
                                    <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                                        <span>Total</span>
                                        <span className="text-lg font-black text-primary">${(Number(order.total) || 0).toFixed(2)}</span>
                                    </div>

                                    {/* Commercial Financial Status Badge */}
                                    {order.payment_status === 'paid' ? (
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">✅</span>
                                            <span>{locale === 'en' ? 'Paid via Card (Stripe)' : 'Pagado con Tarjeta (Stripe)'}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">⏳</span>
                                            <span>
                                                {locale === 'en'
                                                    ? `B2B Credit Purchase • Due: ${order.payment_due_date || 'Pending'}`
                                                    : `Compra a Crédito B2B • Fecha Límite de Pago: ${order.payment_due_date || 'Pendiente'}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-2xl p-4 flex items-start gap-3 mb-8">
                                <MapPin className="text-primary shrink-0" size={18} />
                                <div className="text-xs font-medium text-muted-foreground leading-relaxed">
                                    <p className="font-bold text-foreground mb-1">{t.orders.shippingAddress}:</p>
                                    {order.address ? (
                                        <p>{order.address.alias}: {order.address.address}. {order.address.city && `${order.address.city}.`} Zona {order.address.zone}</p>
                                    ) : (
                                        <p>{locale === 'en' ? 'Address not available' : 'Dirección no disponible'} (ID: {order.address_id})</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Link href="/" className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-black transition-all group">
                                    {t.orders.continueShopping} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link href="/orders" className="w-full flex items-center justify-center gap-2 py-4 bg-secondary text-primary hover:bg-primary/10 transition-all rounded-2xl font-bold text-sm">
                                    <Receipt size={18} /> {t.orders.viewMyOrders}
                                </Link>
                            </div>
                        </div>

                        {/* Promotions Section */}
                        <div className="mt-8 bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 font-serif"><CheckCircle2 className="text-green-500" size={18} /> {t.orders.promotions}</h3>
                            <div className="space-y-3">
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                    <p className="text-sm font-bold text-primary">2x1 en Cookies Artesanales</p>
                                    <p className="text-xs text-muted-foreground">Válido los días martes y jueves.</p>
                                </div>
                                <div className="p-4 bg-muted/50 rounded-2xl border border-border">
                                    <p className="text-sm font-bold text-foreground">Envío Gratis en tu primera compra</p>
                                    <p className="text-xs text-muted-foreground">Usa el código: BIEVENIDO_JHOANES</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
