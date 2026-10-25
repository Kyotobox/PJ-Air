'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    ArrowLeft, ShoppingBag, Clock, User, MapPin, Phone,
    CheckCircle2, AlertCircle, RefreshCcw, DollarSign, Loader2,
    ShieldCheck, CreditCard, ChevronRight, Truck, FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface OrderItem {
    id: string;
    quantity: number;
    price_at_time: number;
    product?: { name: string; image?: string; category?: any };
}

interface OrderDetail {
    id: string;
    total: number;
    status: string;
    payment_status: string;
    payment_method?: string;
    zelle_reference?: string;
    packaging_fee?: number;
    packaging_discount?: number;
    created_at: string;
    delivery_date?: string;
    payment_due_date?: string;
    notes?: string;
    stripe_payment_id?: string;
    refunded_amount?: number;
    refund_reason?: string;
    user?: {
        id: string;
        email: string;
        profile?: { full_name?: string; phone?: string; nickname?: string };
    };
    address?: { address: string; city?: string; zone?: string };
    delivery_type?: string;
    items?: OrderItem[];
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Refund Modal State
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [refundReason, setRefundReason] = useState<string>('requested_by_customer');
    const [refundCustomNotes, setRefundCustomNotes] = useState<string>('');
    const [isProcessingRefund, setIsProcessingRefund] = useState(false);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const data = await api.get(`/orders/${id}`) as OrderDetail;
            setOrder(data);
        } catch (err: any) {
            setError(err.message || 'No se pudo cargar la orden');
        } finally {
            setLoading(false);
        }
    };

    const maxRefundable = order ? Math.max(0, (Number(order.total) || 0) - (Number(order.refunded_amount) || 0)) : 0;

    const handleOpenRefundModal = () => {
        setRefundType('full');
        setRefundAmount(maxRefundable.toFixed(2));
        setRefundReason('requested_by_customer');
        setRefundCustomNotes('');
        setRefundModalOpen(true);
    };

    const handleSubmitRefund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;

        const amountToRefund = refundType === 'full' ? maxRefundable : parseFloat(refundAmount);

        if (isNaN(amountToRefund) || amountToRefund <= 0) {
            showToast('El monto a reembolsar debe ser mayor a 0', 'error');
            return;
        }

        if (amountToRefund > maxRefundable) {
            showToast(`El monto no puede superar el saldo reembolsable de $${maxRefundable.toFixed(2)}`, 'error');
            return;
        }

        setIsProcessingRefund(true);
        try {
            const reasonText = refundCustomNotes.trim()
                ? `${refundReason}: ${refundCustomNotes.trim()}`
                : refundReason;

            const res = await api.post('/payments/refund', {
                orderId: order.id,
                amount: amountToRefund,
                reason: reasonText,
            }) as any;

            showToast(`✅ Reembolso de $${amountToRefund.toFixed(2)} emitido con éxito`);
            setRefundModalOpen(false);

            // Reactive update
            setOrder(prev => prev ? {
                ...prev,
                payment_status: res.paymentStatus || (amountToRefund >= maxRefundable ? 'refunded' : 'partially_refunded'),
                refunded_amount: res.totalRefunded !== undefined ? res.totalRefunded : ((Number(prev.refunded_amount) || 0) + amountToRefund),
                refund_reason: reasonText,
            } : null);
        } catch (err: any) {
            showToast(err.message || 'Error al procesar el reembolso en Stripe', 'error');
        } finally {
            setIsProcessingRefund(false);
        }
    };

    const handleApproveZelle = async () => {
        if (!order) return;
        try {
            const updated = await api.patch(`/orders/${order.id}/approve-zelle`, {}) as any;
            setOrder(prev => prev ? { ...prev, ...updated, payment_status: 'paid' } : null);
            showToast('✅ Pago Zelle aprobado y habilitado para producción');
        } catch (err: any) {
            showToast(err?.message || 'Error al aprobar pago Zelle', 'error');
        }
    };

    const handleRejectZelle = async () => {
        if (!order) return;
        const reason = window.prompt('Indica el motivo del rechazo de la referencia Zelle:', 'Referencia no encontrada o monto no recibido');
        if (reason === null) return;
        try {
            const updated = await api.patch(`/orders/${order.id}/reject-zelle`, { reason }) as any;
            setOrder(prev => prev ? { ...prev, ...updated, payment_status: 'unpaid', status: 'Cancelado' } : null);
            showToast('⚠️ Referencia Zelle rechazada y pedido cancelado');
        } catch (err: any) {
            showToast(err?.message || 'Error al rechazar pago Zelle', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex bg-[#fcfbf9] min-h-screen">
                <AdminSidebar />
                <div className="flex-1 flex flex-col items-center justify-center">
                    <Loader2 size={40} className="animate-spin text-primary opacity-60 mb-3" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando detalles de orden...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="flex bg-[#fcfbf9] min-h-screen">
                <AdminSidebar />
                <div className="flex-1 p-12 max-w-xl mx-auto flex flex-col items-center justify-center text-center">
                    <AlertCircle size={48} className="text-red-500 mb-4" />
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Orden no encontrada</h2>
                    <p className="text-sm text-slate-500 mb-6">{error || 'La orden solicitada no existe o no tiene permisos para verla.'}</p>
                    <Link href="/admin/orders" className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider">
                        Volver a Órdenes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-[#fcfbf9] min-h-screen">
            <AdminSidebar />

            <main className="flex-1 p-8 lg:p-12 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/60 pb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/orders"
                            className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary/40 shadow-sm transition-all"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight font-serif">
                                    Orden #{order.id.slice(0, 8)}
                                </h1>
                                <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 font-bold">
                                    {order.id}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                <Clock size={12} /> Creado el {new Date(order.created_at).toLocaleString('es-ES')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Refund Action Button */}
                        {['paid', 'partially_refunded', 'pending', 'credit'].includes(order.payment_status) && maxRefundable > 0 && (
                            <button
                                data-testid="issue-refund-btn"
                                onClick={handleOpenRefundModal}
                                className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95"
                            >
                                <RefreshCcw size={16} /> Emitir Reembolso
                            </button>
                        )}
                    </div>
                </div>

                {/* Financial Status Summary Banner */}
                <section className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                                Estado Financiero de Cartera
                            </p>
                            <div className="flex items-center gap-3">
                                {order.payment_status === 'paid' && (
                                    <span data-testid="financial-badge-paid" className="px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                        {order.payment_method === 'zelle'
                                            ? `Pagado vía Zelle (Ref: ${order.zelle_reference || 'Aprobado'})`
                                            : 'Pagado con Tarjeta (Stripe)'}
                                    </span>
                                )}
                                {order.payment_status === 'pending_zelle_verification' && (
                                    <span data-testid="financial-badge-zelle-pending" className="px-4 py-1.5 rounded-full bg-purple-100 text-purple-900 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-purple-300 animate-pulse">
                                        🟣 Zelle en Verificación (Ref: {order.zelle_reference || 'Registrada'})
                                    </span>
                                )}
                                {order.payment_status === 'partially_refunded' && (
                                    <span data-testid="financial-badge-partially-refunded" className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-orange-200">
                                        <RefreshCcw size={14} className="text-orange-600" /> Reembolso Parcial (${Number(order.refunded_amount || 0).toFixed(2)} Devuelto)
                                    </span>
                                )}
                                {order.payment_status === 'refunded' && (
                                    <span data-testid="financial-badge-refunded" className="px-4 py-1.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-rose-200">
                                        <RefreshCcw size={14} className="text-rose-600" /> Reembolsado Totalmente
                                    </span>
                                )}
                                {order.payment_status === 'pending' && (
                                    <span data-testid="financial-badge-pending" className="px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-amber-200">
                                        <Clock size={14} className="text-amber-600" /> Compra a Crédito B2B • Pendiente
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                                Monto Fiscal Total
                            </p>
                            <p className="text-3xl font-black text-slate-900 tracking-tight">
                                ${Number(order.total || 0).toFixed(2)}
                            </p>
                            {Number(order.refunded_amount || 0) > 0 && (
                                <p className="text-xs font-bold text-rose-600 mt-0.5">
                                    -${Number(order.refunded_amount).toFixed(2)} reembolsado
                                </p>
                            )}
                        </div>
                    </div>

                    {order.refund_reason && (
                        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-3">
                            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <p className="font-bold text-amber-900">Motivo del Ajuste / Reembolso:</p>
                                <p className="text-amber-800 mt-0.5 font-medium">{order.refund_reason}</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Zelle Audit & Reconciliation Card */}
                {order.payment_method === 'zelle' && (
                    <section className="bg-purple-50/70 rounded-[2rem] p-6 lg:p-8 border-2 border-purple-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-purple-600/30">
                                    Z
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-purple-950 uppercase tracking-wider">
                                        Auditoría y Conciliación de Transferencia Zelle B2B
                                    </h3>
                                    <p className="text-xs text-purple-700 font-medium">
                                        Referencia Bancaria: <span className="font-mono font-black text-purple-950 px-2.5 py-1 bg-white rounded-lg border border-purple-300">{order.zelle_reference || 'Sin Referencia'}</span>
                                    </p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border shadow-sm ${
                                order.payment_status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : order.payment_status === 'pending_zelle_verification'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                                {order.payment_status === 'paid' ? '✓ Pago Aprobado' : order.payment_status === 'pending_zelle_verification' ? '⚠️ Verificación Pendiente' : 'No Pagado / Cancelado'}
                            </span>
                        </div>

                        {order.payment_status === 'pending_zelle_verification' && (
                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                <button
                                    onClick={handleApproveZelle}
                                    className="w-full sm:flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <CheckCircle2 size={18} /> Aprobar Pago Zelle
                                </button>
                                <button
                                    onClick={handleRejectZelle}
                                    className="w-full sm:flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <AlertCircle size={18} /> Rechazar Referencia
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Customer Info */}
                    <section className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            <User size={16} className="text-primary" /> Información del Cliente
                        </h3>
                        <div className="pt-2">
                            <p className="text-lg font-black text-slate-800 leading-tight">
                                {order.user?.profile?.nickname || order.user?.profile?.full_name || 'Cliente B2B'}
                            </p>
                            <p className="text-xs text-primary font-bold mt-1">{order.user?.email}</p>
                            {order.user?.profile?.phone && (
                                <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                                    <Phone size={12} /> {order.user.profile.phone}
                                </p>
                            )}
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Destino de Entrega</p>
                            <p className="text-xs text-slate-600 font-medium flex items-start gap-1.5">
                                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                {order.address?.address || 'Retiro en Panadería Central'}
                            </p>
                        </div>
                    </section>

                    {/* Delivery & Logistics */}
                    <section className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            <Truck size={16} className="text-primary" /> Despacho y Logística
                        </h3>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fecha de Entrega</p>
                                <p className="text-sm font-black text-slate-800 mt-1">{order.delivery_date || 'No programada'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modalidad</p>
                                <p className="text-sm font-black text-slate-800 mt-1 uppercase">{order.delivery_type || 'Guardada'}</p>
                            </div>
                        </div>
                        {order.payment_due_date && (
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vencimiento de Factura</p>
                                <p className="text-xs font-bold text-amber-700 mt-1">{order.payment_due_date}</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Products Table */}
                <section className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <ShoppingBag size={16} className="text-primary" /> Productos del Pedido
                    </h3>
                    <div className="space-y-3">
                        {(order.items || []).map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center font-black text-xs text-primary shadow-sm">
                                        x{item.quantity}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-slate-800">{item.product?.name || 'Producto'}</p>
                                        <p className="text-[11px] text-slate-400 font-medium">Unitario: ${Number(item.price_at_time).toFixed(2)}</p>
                                    </div>
                                </div>
                                <p className="text-base font-black text-slate-800">
                                    ${(Number(item.price_at_time) * item.quantity).toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* Refund Modal */}
            {refundModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 font-serif">Emitir Reembolso</h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    Orden #{order.id.slice(0, 8)} • Saldo disponible: ${maxRefundable.toFixed(2)}
                                </p>
                            </div>
                            <button
                                onClick={() => setRefundModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-black"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmitRefund} className="space-y-5">
                            {/* Option: Full vs Partial */}
                            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRefundType('full');
                                        setRefundAmount(maxRefundable.toFixed(2));
                                    }}
                                    className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                        refundType === 'full' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Total (${maxRefundable.toFixed(2)})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRefundType('partial')}
                                    className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                        refundType === 'partial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Parcial (Ajuste)
                                </button>
                            </div>

                            {/* Amount input if partial */}
                            {refundType === 'partial' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Monto Exacto a Devolver ($ USD)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            max={maxRefundable}
                                            min="0.01"
                                            value={refundAmount}
                                            onChange={(e) => setRefundAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black text-slate-800 outline-none focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Ideal para compensar mermas o roturas de panadería sin cancelar toda la orden.
                                    </p>
                                </div>
                            )}

                            {/* Reason selector */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Motivo del Ajuste
                                </label>
                                <select
                                    value={refundReason}
                                    onChange={(e) => setRefundReason(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                                >
                                    <option value="requested_by_customer">Solicitud del Cliente (Cancelación)</option>
                                    <option value="merma_panaderia">Merma o Rotura de Panadería en Tránsito</option>
                                    <option value="calidad_producto">Ajuste por Calidad de Horneado</option>
                                    <option value="duplicate">Cobro Duplicado o Error Administrativo</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Observaciones Comerciales
                                </label>
                                <textarea
                                    value={refundCustomNotes}
                                    onChange={(e) => setRefundCustomNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Detalles adicionales para la conciliación contable..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-amber-500 resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRefundModalOpen(false)}
                                    disabled={isProcessingRefund}
                                    className="flex-1 py-3.5 text-xs font-black uppercase tracking-wider rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessingRefund}
                                    className="flex-[2] py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isProcessingRefund ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                    {isProcessingRefund ? 'Procesando...' : 'Confirmar Reembolso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification Toast */}
            {toast && (
                <div className={`fixed bottom-10 right-10 z-[140] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl text-white font-black text-xs animate-in slide-in-from-bottom duration-300 ${
                    toast.type === 'error' ? 'bg-rose-600 shadow-rose-600/30' : 'bg-emerald-600 shadow-emerald-600/30'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
