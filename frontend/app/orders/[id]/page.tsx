'use client';

import React, { useState, useEffect, use } from 'react';
import Navbar from '@/components/layout/Navbar';
import {
    CheckCircle2, Package, Calendar, Clock, MapPin,
    ChevronRight, ShoppingBag, Receipt, Loader2, CreditCard,
    RefreshCcw, AlertCircle, Printer, Building2, X
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import StripePaymentModal from '@/components/checkout/StripePaymentModal';
import { calculateProcessingFee } from '@/lib/fee-calculator';
import { API_URL } from '@/lib/config';

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: orderId } = use(params);
    const { t, locale } = useLanguage();
    const [order, setOrder] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Online settlement payment states
    const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
    const [settlementMethodModalOpen, setSettlementMethodModalOpen] = useState(false);
    const [selectedSettlementMethod, setSelectedSettlementMethod] = useState<'STRIPE_CARD' | 'ACH'>('STRIPE_CARD');
    const [settlementModalOpen, setSettlementModalOpen] = useState(false);
    const [settlementClientSecret, setSettlementClientSecret] = useState<string | null>(null);
    const [settlementAmount, setSettlementAmount] = useState<number>(0);
    const [paymentToast, setPaymentToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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

    const handlePayOnline = () => {
        // Open modal to select payment method (Card 3.5% vs ACH 0.8% cap $5)
        setSettlementMethodModalOpen(true);
    };

    const executeSettlement = async (method: 'STRIPE_CARD' | 'ACH') => {
        setSettlementMethodModalOpen(false);
        setIsInitiatingPayment(true);
        try {
            const res = await api.post('/payments/create-settlement-link', {
                orderId,
                paymentMethod: method,
            }) as any;

            if (res.clientSecret) {
                setSettlementClientSecret(res.clientSecret);
                setSettlementAmount(res.amount || Number(order?.total) || 0);
                setSettlementModalOpen(true);
            } else if (res.url && res.url.startsWith('http') && !res.url.includes(orderId)) {
                window.location.href = res.url;
            }
        } catch (err: any) {
            setPaymentToast({
                msg: err.message || (locale === 'en' ? 'Error connecting to payment gateway' : 'Error al conectar con la pasarela de pagos'),
                type: 'error'
            });
            setTimeout(() => setPaymentToast(null), 4000);
        } finally {
            setIsInitiatingPayment(false);
        }
    };

    const handlePrintInvoice = () => {
        if (!order) return;
        const clientName = order.user?.profile?.full_name || order.user?.name || order.user?.email || 'Cliente Mayorista';
        const clientPhone = order.user?.profile?.phone || '';
        const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const itemsTotal = items.reduce((acc: number, item: any) => {
            const price = Number(item.price_at_time || item.product?.price || 0);
            return acc + (price * Number(item.quantity || 1));
        }, 0);
        const deliveryFee = Number(order.delivery_fee_charged || 0);
        const feeAmount = Number(order.fee_amount || (order.payment_method === 'stripe' ? itemsTotal * 0.035 : 0));
        const feeMethod = order.fee_method || (order.payment_method === 'ach' ? 'ACH' : order.payment_method === 'stripe' ? 'STRIPE_CARD' : order.payment_method?.toUpperCase() || 'EXENTO');
        const grandTotal = Number(order.total) || (itemsTotal + deliveryFee + feeAmount);

        const itemsRows = items.map((item: any) => {
            const price = Number(item.price_at_time || item.product?.price || 0);
            const qty = Number(item.quantity || 1);
            const lineTotal = price * qty;
            return `<tr>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${item.product?.name || 'Producto Artesanal'}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${qty}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${price.toFixed(2)}</td>
                <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">$${lineTotal.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Factura Comercial #${order.id.slice(0, 8).toUpperCase()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
        body { padding: 40px; color: #1e293b; background: #fff; font-size: 12px; line-height: 1.5; }
        @media print {
            body { padding: 20px; }
            @page { margin: 10mm; size: letter; }
        }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
        .brand h1 { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
        .brand p { font-size: 11px; color: #64748b; margin-top: 2px; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { font-size: 16px; font-weight: 800; color: #d97706; text-transform: uppercase; }
        .invoice-meta p { font-size: 11px; color: #475569; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
        .party h3 { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
        .party p { font-size: 12px; font-weight: 600; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; padding: 8px; text-align: left; }
        th:nth-child(2) { text-align: center; }
        th:nth-child(3), th:nth-child(4) { text-align: right; }
        .summary-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .summary-table { width: 320px; border-collapse: collapse; }
        .summary-table td { padding: 6px 8px; font-size: 12px; }
        .summary-table td:last-child { text-align: right; font-family: monospace; font-weight: 700; }
        .summary-table tr.total-row td { border-top: 2px solid #0f172a; font-size: 14px; font-weight: 900; color: #0f172a; padding-top: 10px; }
        .legal-notice { border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 10px; color: #64748b; text-align: center; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">
            <h1>JHOANES BAKERY & WHOLESALE</h1>
            <p>3304 Broadway, Astoria, NY 11106 • Tel: (718) 555-0199</p>
            <p>NYS Certificate of Authority • Wholesale Bakery Division</p>
        </div>
        <div class="invoice-meta">
            <h2>FACTURA COMERCIAL</h2>
            <p><b>No:</b> INV-${order.id.slice(0, 8).toUpperCase()}</p>
            <p><b>Fecha:</b> ${orderDate}</p>
            <p><b>Vencimiento:</b> ${order.payment_due_date || 'Inmediato'}</p>
            <p><b>Estado:</b> <span style="text-transform: uppercase; font-weight: bold;">${order.payment_status === 'paid' ? 'PAGADO / PAID' : 'PENDIENTE / UNPAID'}</span></p>
        </div>
    </div>

    <div class="parties">
        <div class="party">
            <h3>Emisor (Proveedor):</h3>
            <p>Jhoanes Bakery Wholesale LLC</p>
            <p>Astoria, Queens, NY 11106</p>
            <p>accounting@jhoanes.com</p>
        </div>
        <div class="party">
            <h3>Facturado a (Cliente B2B):</h3>
            <p>${clientName}</p>
            ${clientPhone ? `<p>Tel: ${clientPhone}</p>` : ''}
            <p>${order.address ? `${order.address.address}, ${order.address.city || 'NY'}` : (order.delivery_address_text || 'Entrega en tienda (Pick Up)')}</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Descripción del Producto</th>
                <th>Cant</th>
                <th>Precio Unit</th>
                <th>Importe</th>
            </tr>
        </thead>
        <tbody>
            ${itemsRows}
        </tbody>
    </table>

    <div class="summary-box">
        <table class="summary-table">
            <tr>
                <td>Subtotal Mercancía:</td>
                <td>$${itemsTotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Cargo por Flete / Delivery:</td>
                <td>+$${deliveryFee.toFixed(2)}</td>
            </tr>
            <tr style="background: #f1f5f9; border-radius: 6px;">
                <td>
                    <b>Processing Fee:</b><br/>
                    <small style="color: #64748b; font-size: 9px;">${feeMethod} (Comisión de pasarela no absorbida)</small>
                </td>
                <td style="color: #0f172a;">+$${feeAmount.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td>TOTAL FACTURADO:</td>
                <td style="color: #b45309;">$${grandTotal.toFixed(2)}</td>
            </tr>
        </table>
    </div>

    <div class="legal-notice">
        <p><b>Desglose Legal y Contable:</b> De conformidad con la normativa de transparencia comercial del Estado de Nueva York, las comisiones de procesamiento de pagos (3.5% en tarjetas de crédito/débito o 0.8% con tope de $5.00 en transferencias ACH) se desglosan explícitamente y no son absorbidas en ventas comerciales al por mayor.</p>
        <p>Gracias por su preferencia comercial • Jhoanes Bakery & Wholesale</p>
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;
        const w = window.open('', '_blank', 'width=900,height=800');
        if (w) {
            w.document.write(html);
            w.document.close();
        }
    };

    const handlePaymentSuccess = async () => {
        setSettlementModalOpen(false);
        try {
            // Also update order status on server to confirm reconciliation
            await api.patch(`/orders/${orderId}/payment-status`, { payment_status: 'paid' }).catch(() => {});
        } catch (_) {}

        setOrder((prev: any) => prev ? { ...prev, payment_status: 'paid' } : null);
        setPaymentToast({
            msg: locale === 'en'
                ? 'Payment confirmed! Credit balance and availability updated.'
                : '¡Pago confirmado con éxito! Cupo de crédito liberado inmediatamente.',
            type: 'success'
        });
        setTimeout(() => setPaymentToast(null), 5000);
    };

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
                {/* Dynamic Status Header */}
                {order.status === 'Cancelado' ? (
                    <div className="text-center mb-16">
                        <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-100/50">
                            <AlertCircle size={56} />
                        </div>
                        <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
                            {locale === 'en' ? 'Order Cancelled' : 'Orden Cancelada'}
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium">
                            {locale === 'en' ? 'This order was cancelled or payment was not completed.' : 'Esta orden fue cancelada o el pago no fue completado.'}
                        </p>
                    </div>
                ) : order.payment_status === 'pending_zelle_verification' ? (
                    <div className="text-center mb-16">
                        <div className="w-24 h-24 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-100/50">
                            <Clock size={56} />
                        </div>
                        <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
                            {locale === 'en' ? 'Verifying Zelle Payment' : 'Verificando Transferencia Zelle'}
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium">
                            {locale === 'en' 
                                ? `Reference: ${order.zelle_reference || 'Recorded'}. Our admin team is verifying your transfer to authorize production.`
                                : `Referencia: ${order.zelle_reference || 'Registrada'}. El equipo de administración está conciliando tu pago para autorizar la producción.`}
                        </p>
                    </div>
                ) : order.payment_status !== 'paid' && order.payment_terms !== 'credit_net_15' ? (
                    <div className="text-center mb-16">
                        <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-100/50">
                            <Clock size={56} />
                        </div>
                        <h1 className="text-4xl font-bold font-serif text-foreground mb-4">
                            {locale === 'en' ? 'Payment Pending' : 'Pago Pendiente'}
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium">
                            {locale === 'en' ? 'Please complete your wholesale payment to start bakery production.' : 'Por favor completa tu pago mayorista para iniciar la producción panadera.'}
                        </p>
                    </div>
                ) : (
                    <div className="text-center mb-16">
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-100/50">
                            <CheckCircle2 size={56} />
                        </div>
                        <h1 className="text-4xl font-bold font-serif text-foreground mb-4">{t.orders.confirmed}</h1>
                        <p className="text-lg text-muted-foreground font-medium">{t.orders.thanks}</p>
                    </div>
                )}

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
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-foreground font-mono">
                                            ${(items.reduce((acc: number, item: any) => acc + (Number(item.price_at_time || item.product?.price || 0) * Number(item.quantity || 1)), 0)).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>{locale === 'en' ? 'Freight / Delivery Fee' : 'Flete / Delivery'}</span>
                                        <span className="font-bold text-foreground font-mono">+${Number(order.delivery_fee_charged || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <div className="flex flex-col">
                                            <span>Processing Fee</span>
                                            {order.fee_method && (
                                                <span className="text-[9px] text-slate-500 font-medium">({order.fee_method})</span>
                                            )}
                                        </div>
                                        <span className={`font-bold font-mono ${Number(order.fee_amount || 0) > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                                            {Number(order.fee_amount || 0) > 0 ? `+$${Number(order.fee_amount).toFixed(2)}` : '$0.00'}
                                        </span>
                                    </div>
                                    {order.tax_exempt ? (
                                        <div className="flex justify-between items-center text-xs font-bold text-emerald-700 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200">
                                            <span>NY Sales Tax (ST-120 Exento)</span>
                                            <span>$0.00 (0.00%)</span>
                                        </div>
                                    ) : Number(order.tax_amount || 0) > 0 ? (
                                        <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                                            <span>NY Sales Tax ({order.tax_rate || 8.875}%)</span>
                                            <span>${Number(order.tax_amount).toFixed(2)}</span>
                                        </div>
                                    ) : null}

                                    {order.tax_legend && (
                                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-[11px] text-emerald-800 leading-relaxed font-medium">
                                            <span className="font-bold block text-[10px] uppercase text-emerald-900 tracking-wider mb-0.5">NYS DTF Resale Certification:</span>
                                            {order.tax_legend}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-border">
                                        <span>Total</span>
                                        <span className="text-xl font-black text-primary font-mono">${(Number(order.total) || 0).toFixed(2)}</span>
                                    </div>

                                    {/* Zelle Receipt Link */}
                                    {order.zelle_receipt_url && (
                                        <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 text-purple-900 font-bold">
                                                <Receipt size={16} className="text-purple-600" />
                                                <span>{locale === 'en' ? 'Zelle Receipt Attached' : 'Comprobante Zelle Adjunto'}</span>
                                            </div>
                                            <a
                                                href={order.zelle_receipt_url.startsWith('http') ? order.zelle_receipt_url : `${API_URL}${order.zelle_receipt_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] font-bold text-purple-700 underline"
                                            >
                                                {locale === 'en' ? 'View file' : 'Ver archivo'} ↗
                                            </a>
                                        </div>
                                    )}

                                    {/* Pending Balance Payment Section (TASK-50-03) */}
                                    {Number(order.pending_balance) > 0 && (
                                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                                            <div className="flex justify-between items-center text-xs font-bold text-amber-950">
                                                <span>{locale === 'en' ? 'Pending Balance to Settle:' : 'Saldo Pendiente por Ajuste:'}</span>
                                                <span className="font-mono text-sm font-black text-amber-900">${Number(order.pending_balance).toFixed(2)}</span>
                                            </div>
                                            <button
                                                onClick={handlePayOnline}
                                                disabled={isInitiatingPayment}
                                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
                                            >
                                                {isInitiatingPayment ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                                {locale === 'en' ? `Pay Balance ($${Number(order.pending_balance).toFixed(2)})` : `Pagar Diferencia ($${Number(order.pending_balance).toFixed(2)})`}
                                            </button>
                                        </div>
                                    )}

                                    {/* Financial Status Badges & Settlement Action */}
                                    {order.payment_status === 'paid' && (
                                        <div data-testid="order-paid-badge" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">✅</span>
                                            <span>
                                                {order.payment_method === 'zelle'
                                                    ? (locale === 'en' ? `Paid via Zelle (Ref: ${order.zelle_reference || 'Confirmed'})` : `Pagado con Zelle (Ref: ${order.zelle_reference || 'Confirmado'})`)
                                                    : (locale === 'en' ? 'Paid via Card (Stripe)' : 'Pagado con Tarjeta (Stripe)')}
                                            </span>
                                        </div>
                                    )}

                                    {order.payment_status === 'pending_zelle_verification' && (
                                        <div data-testid="order-zelle-pending-badge" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">🟣</span>
                                            <span>
                                                {locale === 'en'
                                                    ? `Zelle Pending Verification • Ref: ${order.zelle_reference || 'Registered'}`
                                                    : `Zelle en Verificación • Ref: ${order.zelle_reference || 'Registrada'}`}
                                            </span>
                                        </div>
                                    )}

                                    {order.payment_status === 'partially_refunded' && (
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-orange-50 text-orange-800 border border-orange-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">↩️</span>
                                            <span>{locale === 'en' ? `Partially Refunded ($${Number(order.refunded_amount || 0).toFixed(2)})` : `Reembolso Parcial ($${Number(order.refunded_amount || 0).toFixed(2)} devuelto)`}</span>
                                        </div>
                                    )}

                                    {order.payment_status === 'refunded' && (
                                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold shadow-sm">
                                            <span className="text-sm">↩️</span>
                                            <span>{locale === 'en' ? 'Fully Refunded' : 'Reembolsado Totalmente'}</span>
                                        </div>
                                    )}

                                    {order.payment_status !== 'paid' && order.payment_status !== 'refunded' && order.payment_status !== 'pending_zelle_verification' && (
                                        <div className="space-y-3 pt-1">
                                            {order.payment_terms === 'credit_net_15' ? (
                                                <div data-testid="order-credit-badge" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-sm">
                                                    <span className="text-sm">⏳</span>
                                                    <span>
                                                        {locale === 'en'
                                                            ? `B2B Credit Purchase • Due: ${order.payment_due_date || 'Pending'}`
                                                            : `Compra a Crédito B2B • Fecha Límite: ${order.payment_due_date || 'Pendiente'}`}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div data-testid="order-unpaid-badge" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-sm">
                                                    <span className="text-sm">⚠️</span>
                                                    <span>
                                                        {locale === 'en'
                                                            ? 'Payment Pending • Wholesale Card/ACH'
                                                            : 'Pago Pendiente • Tarjeta/ACH Mayorista'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Button to Pay Online */}
                                            <button
                                                data-testid="pay-invoice-online-btn"
                                                onClick={handlePayOnline}
                                                disabled={isInitiatingPayment}
                                                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isInitiatingPayment ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                                                {isInitiatingPayment
                                                    ? (locale === 'en' ? 'Preparing Gateway...' : 'Conectando Pasarela...')
                                                    : (order.payment_terms === 'credit_net_15'
                                                        ? (locale === 'en' ? 'Pay Invoice Online' : 'Liquidar Factura en Línea')
                                                        : (locale === 'en' ? 'Complete Payment (Stripe)' : 'Completar Pago (Stripe)'))}
                                            </button>
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

                                <button
                                    data-testid="print-invoice-btn"
                                    onClick={handlePrintInvoice}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
                                >
                                    <Printer size={16} className="text-slate-700" />
                                    {locale === 'en' ? 'Print / Download Official Invoice' : 'Imprimir / Descargar Factura Legal'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Settlement Payment Method Selection Modal (TASK-47-03) */}
            {settlementMethodModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative">
                        <button
                            onClick={() => setSettlementMethodModalOpen(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    {locale === 'en' ? 'Settle Credit Invoice' : 'Liquidar Factura a Crédito'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {locale === 'en' ? 'Select settlement payment method (Processing fees apply)' : 'Selecciona método de pago (Comisiones de pasarela aplicables)'}
                                </p>
                            </div>
                        </div>

                        {/* Balance display */}
                        {(() => {
                            const bal = Math.max(0, (Number(order.total) || 0) - (Number(order.refunded_amount) || 0));
                            const fee = calculateProcessingFee(bal, selectedSettlementMethod);
                            const totalToPay = Math.round((bal + fee) * 100) / 100;

                            return (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Card Option */}
                                        <div
                                            data-testid="settle-method-card"
                                            onClick={() => setSelectedSettlementMethod('STRIPE_CARD')}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                                selectedSettlementMethod === 'STRIPE_CARD'
                                                    ? 'border-primary bg-primary/5 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                    <CreditCard size={14} className="text-primary" />
                                                    {locale === 'en' ? 'Card (Stripe)' : 'Tarjeta de Crédito'}
                                                </span>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">+3.5%</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {locale === 'en' ? 'Instant processing fee: 3.5%' : 'Comisión pasarela: 3.5%'}
                                            </p>
                                        </div>

                                        {/* ACH Option */}
                                        <div
                                            data-testid="settle-method-ach"
                                            onClick={() => setSelectedSettlementMethod('ACH')}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                                selectedSettlementMethod === 'ACH'
                                                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                    <Building2 size={14} className="text-emerald-700" />
                                                    {locale === 'en' ? 'ACH Debit' : 'ACH Bancario'}
                                                </span>
                                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">0.8% máx $5</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {locale === 'en' ? '0.8% rate capped at $5.00' : '0.8% con tope máximo de $5.00'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Breakdown formula */}
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">{locale === 'en' ? 'Invoice Balance:' : 'Saldo de Factura:'}</span>
                                            <span className="font-bold font-mono text-slate-900">${bal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">{locale === 'en' ? 'Processing Fee:' : 'Processing Fee (Comisión):'}</span>
                                            <span className="font-bold font-mono text-amber-700">+${fee.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-slate-200">
                                            <span className="text-slate-900">{locale === 'en' ? 'Total to Pay:' : 'Total a Pagar:'}</span>
                                            <span className="text-base text-primary font-mono">${totalToPay.toFixed(2)}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono text-center pt-1 border-t border-slate-200/60">
                                            Saldo (${bal.toFixed(2)}) + Processing Fee (${fee.toFixed(2)}) = Total (${totalToPay.toFixed(2)})
                                        </div>
                                    </div>

                                    <button
                                        data-testid="confirm-settlement-btn"
                                        onClick={() => executeSettlement(selectedSettlementMethod)}
                                        disabled={isInitiatingPayment}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        {isInitiatingPayment ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                                        {locale === 'en' ? 'Proceed to Payment Gateway' : 'Proceder al Pago con Comisión'}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* In-App Stripe Settlement Modal */}
            {settlementModalOpen && settlementClientSecret && (
                <StripePaymentModal
                    clientSecret={settlementClientSecret}
                    amount={settlementAmount}
                    orderId={order.id}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setSettlementModalOpen(false)}
                    locale={locale}
                />
            )}

            {/* Floating Toast Notification */}
            {paymentToast && (
                <div
                    role="alert"
                    className={`fixed bottom-8 right-8 z-[140] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-black text-xs animate-in slide-in-from-bottom duration-300 ${
                        paymentToast.type === 'error' ? 'bg-rose-600 shadow-rose-600/30' : 'bg-emerald-600 shadow-emerald-600/30'
                    }`}
                >
                    {paymentToast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {paymentToast.msg}
                </div>
            )}
        </div>
    );
}
