'use client';

import React, { useState, useMemo } from 'react';
import { 
    Clock, 
    Calendar as CalendarIcon, 
    AlertTriangle, 
    CheckCircle2, 
    ArrowRight, 
    Loader2, 
    ChevronDown, 
    ChevronUp, 
    Package, 
    Zap, 
    Search,
    Truck,
    MapPin,
    AlertCircle
} from 'lucide-react';
import { api } from '@/lib/api';

interface OrderItem {
    id: string;
    quantity: number;
    price_at_time: number;
    product?: {
        name: string;
        category?: { name: string };
    };
}

interface OrderRecord {
    id: string;
    total: number;
    status: string;
    created_at: string;
    delivery_date?: string;
    delivery_type?: string;
    payment_status?: string;
    delivery_address_text?: string;
    notes?: string;
    user?: {
        id: string;
        email: string;
        profile?: {
            full_name?: string;
            nickname?: string;
            company_name?: string;
        };
    };
    address?: {
        alias?: string;
        address?: string;
    };
    items?: OrderItem[];
}

interface InteractiveBatchManagerProps {
    orders: OrderRecord[];
    onOrderUpdated: (updatedOrder: OrderRecord, newDate: string) => void;
    currentRangeStart?: string;
    currentRangeEnd?: string;
}

export const isCreatedPostCutoff = (createdAtStr: string, cutoffHour = 12): boolean => {
    if (!createdAtStr) return false;
    const d = new Date(createdAtStr);
    if (isNaN(d.getTime())) return false;
    const nyDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return nyDate.getHours() >= cutoffHour;
};

export const getOrderScheduledDate = (order: OrderRecord): string => {
    if (order.delivery_date) {
        return order.delivery_date.includes('T') ? order.delivery_date.split('T')[0] : order.delivery_date.split(' ')[0];
    }
    if (order.created_at) {
        const d = new Date(order.created_at);
        if (!isNaN(d.getTime())) {
            const nyDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            if (nyDate.getHours() >= 12) {
                nyDate.setDate(nyDate.getDate() + 1);
            }
            const yr = nyDate.getFullYear();
            const mo = String(nyDate.getMonth() + 1).padStart(2, '0');
            const da = String(nyDate.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        }
    }
    return '';
};

export default function InteractiveBatchManager({
    orders,
    onOrderUpdated,
    currentRangeStart,
    currentRangeEnd
}: InteractiveBatchManagerProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [filterMode, setFilterMode] = useState<'all' | 'post-cutoff'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [targetDates, setTargetDates] = useState<Record<string, string>>({});
    const [expandedOrderItems, setExpandedOrderItems] = useState<Record<string, boolean>>({});
    const [actionFeedback, setActionFeedback] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);

    // Count post-cutoff orders
    const postCutoffOrders = useMemo(() => {
        return orders.filter(o => isCreatedPostCutoff(o.created_at));
    }, [orders]);

    const filteredOrders = useMemo(() => {
        let list = orders;
        if (filterMode === 'post-cutoff') {
            list = postCutoffOrders;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(o => {
                const name = o.user?.profile?.nickname || o.user?.profile?.full_name || o.user?.email || '';
                const idMatch = o.id.toLowerCase().includes(q);
                return name.toLowerCase().includes(q) || idMatch;
            });
        }
        return list;
    }, [orders, filterMode, searchQuery, postCutoffOrders]);

    const handleDateChange = (orderId: string, val: string) => {
        setTargetDates(prev => ({ ...prev, [orderId]: val }));
    };

    const handleSaveReassignment = async (order: OrderRecord, customDate?: string, isException = false) => {
        const newDate = customDate || targetDates[order.id] || getOrderScheduledDate(order);
        if (!newDate) return;

        setUpdatingId(order.id);
        setActionFeedback(null);

        try {
            const motivo = isException 
                ? 'Excepción post-corte autorizada por administración' 
                : `Reasignación interactiva de lote a ${newDate}`;

            const res = await api.patch(`/orders/${order.id}`, {
                delivery_date: newDate,
                motivo,
            });

            setActionFeedback({
                id: order.id,
                msg: isException ? `⚡ Excepción aplicada: Lote asignado al ${newDate}` : `Reasignado exitosamente al ${newDate}`,
                type: 'success'
            });

            onOrderUpdated((res as OrderRecord) || order, newDate);
        } catch (err: any) {
            setActionFeedback({
                id: order.id,
                msg: err.message || 'Error al reasignar orden',
                type: 'error'
            });
        } finally {
            setUpdatingId(null);
            setTimeout(() => {
                setActionFeedback(null);
            }, 4000);
        }
    };

    const handleQuickShift = (order: OrderRecord, days: number) => {
        const currentDate = targetDates[order.id] || getOrderScheduledDate(order);
        if (!currentDate) return;
        const d = new Date(currentDate + 'T12:00:00');
        d.setDate(d.getDate() + days);
        const nextDateStr = d.toISOString().split('T')[0];
        handleDateChange(order.id, nextDateStr);
        handleSaveReassignment(order, nextDateStr, false);
    };

    const handleForceTodayException = (order: OrderRecord) => {
        // Today in NY time
        const now = new Date();
        const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const todayStr = nyDate.toISOString().split('T')[0];
        handleDateChange(order.id, todayStr);
        handleSaveReassignment(order, todayStr, true);
    };

    const toggleOrderItems = (id: string) => {
        setExpandedOrderItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (orders.length === 0) {
        return null;
    }

    return (
        <div className="print:hidden bg-card border border-border rounded-[2.5rem] shadow-xl shadow-foreground/5 mb-8 overflow-hidden transition-all">
            {/* Header / Collapse Bar */}
            <div className="p-6 md:p-8 border-b border-border bg-gradient-to-r from-amber-500/5 via-primary/5 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Zap size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black uppercase tracking-tight">Gestor de Lotes & Excepciones</h2>
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full uppercase">
                                {orders.length} pedidos en lote
                            </span>
                            {postCutoffOrders.length > 0 && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-black rounded-full flex items-center gap-1.5 animate-pulse">
                                    <AlertTriangle size={13} />
                                    {postCutoffOrders.length} Post-Corte
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Reasigna fechas de horneado y autoriza excepciones de pedidos ingresados después de las 12:00 PM
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors"
                    >
                        {isExpanded ? (
                            <>
                                <span>Ocultar Gestor</span>
                                <ChevronUp size={16} />
                            </>
                        ) : (
                            <>
                                <span>Abrir Gestor ({orders.length})</span>
                                <ChevronDown size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-6 md:p-8 space-y-6">
                    {/* Controls & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 p-1.5 bg-muted/40 border border-border rounded-2xl">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                    filterMode === 'all'
                                        ? 'bg-black text-white shadow-md'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Todos ({orders.length})
                            </button>
                            <button
                                onClick={() => setFilterMode('post-cutoff')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                    filterMode === 'post-cutoff'
                                        ? 'bg-red-600 text-white shadow-md'
                                        : 'text-muted-foreground hover:text-red-600'
                                }`}
                            >
                                <AlertTriangle size={13} />
                                Post-Corte ({postCutoffOrders.length})
                            </button>
                        </div>

                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por cliente o ID..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-muted/20 border border-border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Table of Orders */}
                    <div className="overflow-x-auto border border-border rounded-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/40 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    <th className="py-3 px-4">Pedido / Cliente</th>
                                    <th className="py-3 px-4">Ingreso / Corte</th>
                                    <th className="py-3 px-4">Uds / Total</th>
                                    <th className="py-3 px-4">Fecha Programada</th>
                                    <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-xs">
                                {filteredOrders.map(order => {
                                    const postCutoff = isCreatedPostCutoff(order.created_at);
                                    const scheduledDate = getOrderScheduledDate(order);
                                    const selectedDate = targetDates[order.id] || scheduledDate;
                                    const totalUnits = (order.items || []).reduce((acc, it) => acc + Number(it.quantity || 0), 0);
                                    const isUpdating = updatingId === order.id;
                                    const clientName = order.user?.profile?.nickname || order.user?.profile?.full_name || order.user?.email || 'Desconocido';
                                    const isItemsExpanded = expandedOrderItems[order.id];

                                    return (
                                        <React.Fragment key={order.id}>
                                            <tr className={`hover:bg-muted/10 transition-colors ${postCutoff ? 'bg-amber-50/20' : ''}`}>
                                                {/* Client / Order Info */}
                                                <td className="py-4 px-4 font-bold">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] text-muted-foreground">
                                                            #{order.id.slice(0, 8)}
                                                        </span>
                                                        <button 
                                                            onClick={() => toggleOrderItems(order.id)}
                                                            className="text-primary hover:underline font-black flex items-center gap-1"
                                                        >
                                                            {clientName}
                                                            {isItemsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                        </button>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                                                        <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${
                                                            order.delivery_type === 'pickup' 
                                                                ? 'bg-blue-100 text-blue-700' 
                                                                : 'bg-green-100 text-green-700'
                                                        }`}>
                                                            {order.delivery_type === 'pickup' ? 'Pickup' : 'Entrega'}
                                                        </span>
                                                        {(order.address?.alias || order.delivery_address_text) && (
                                                            <span className="truncate max-w-[160px]">
                                                                {order.address?.alias || order.delivery_address_text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Cutoff / Timestamp */}
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock size={14} className={postCutoff ? 'text-red-500' : 'text-muted-foreground'} />
                                                        <span className="font-bold text-[11px]">
                                                            {order.created_at ? new Date(order.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </span>
                                                    </div>
                                                    {postCutoff ? (
                                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-black text-[9px] uppercase">
                                                            <AlertTriangle size={10} />
                                                            Post-12:00 PM
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] text-emerald-600 font-bold uppercase block mt-1">
                                                            A tiempo
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Units / Total */}
                                                <td className="py-4 px-4 font-bold">
                                                    <div>
                                                        <span className="font-black text-foreground">{totalUnits}</span>
                                                        <span className="text-muted-foreground text-[10px] ml-1">uds</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground font-mono">
                                                        ${Number(order.total || 0).toFixed(2)}
                                                    </div>
                                                </td>

                                                {/* Scheduled Date Picker */}
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
                                                        <input
                                                            type="date"
                                                            value={selectedDate}
                                                            onChange={e => handleDateChange(order.id, e.target.value)}
                                                            className="h-8 px-2 bg-muted/40 border border-border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                                        />
                                                    </div>
                                                    {selectedDate !== scheduledDate && (
                                                        <span className="text-[9px] text-amber-600 font-bold block mt-1">
                                                            Pendiente guardar ({selectedDate})
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {postCutoff && (
                                                            <button
                                                                onClick={() => handleForceTodayException(order)}
                                                                disabled={isUpdating}
                                                                title="Aceptar como excepción para producción inmediata hoy"
                                                                className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 border border-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
                                                            >
                                                                <Zap size={12} />
                                                                <span>Excepción Hoy</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => handleQuickShift(order, 1)}
                                                            disabled={isUpdating}
                                                            title="Mover al siguiente día (+1)"
                                                            className="px-2 py-1.5 bg-muted/60 hover:bg-muted text-muted-foreground rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50"
                                                        >
                                                            +1 Día
                                                        </button>

                                                        <button
                                                            onClick={() => handleSaveReassignment(order)}
                                                            disabled={isUpdating || selectedDate === scheduledDate}
                                                            className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-30"
                                                        >
                                                            {isUpdating ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 size={12} />
                                                            )}
                                                            <span>Guardar</span>
                                                        </button>
                                                    </div>

                                                    {/* Inline feedback */}
                                                    {actionFeedback?.id === order.id && (
                                                        <div className={`mt-2 text-[10px] font-bold flex items-center justify-end gap-1 ${
                                                            actionFeedback.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                                                        }`}>
                                                            {actionFeedback.type === 'success' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                                            <span>{actionFeedback.msg}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expandable items preview */}
                                            {isItemsExpanded && (
                                                <tr className="bg-muted/15 border-b border-border">
                                                    <td colSpan={5} className="py-3 px-6">
                                                        <div className="p-3 bg-card border border-border rounded-xl">
                                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground mb-2">
                                                                <Package size={13} />
                                                                <span>Productos en este pedido ({order.items?.length || 0}):</span>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                                                {(order.items || []).map((it, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center py-1 px-2.5 bg-muted/30 rounded-lg">
                                                                        <span className="font-bold truncate pr-2">
                                                                            {it.product?.name || 'Producto'}
                                                                        </span>
                                                                        <span className="font-black text-amber-600 shrink-0">
                                                                            {it.quantity} uds
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
