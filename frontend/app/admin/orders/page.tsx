'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { 
    ShoppingBag, Search, Filter, Edit, Truck, Clock, 
    CheckCircle2, X, User, ChevronRight, Loader2, Save,
    AlertCircle, MapPin, Phone, MessageSquare, History,
    Plus, Minus, Trash2, CalendarDays, Printer
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface OrderItem {
    id: string;
    quantity: number;
    price_at_time: number;
    product_id?: string;
    product?: { name: string; category?: string; image?: string; };
}

interface Order {
    id: string;
    total: number;
    status: string;
    created_at: string;
    delivery_date?: string;
    notes?: string;
    user?: { email: string; profile?: { full_name?: string; phone?: string; nickname?: string; }; };
    delivery_user_id?: string;
    delivery_user?: { id: string; profile?: { full_name?: string; }; };
    address?: { address: string; city: string; };
    delivery_type?: string;
    items?: OrderItem[];
}

interface DeliveryUser {
    id: string;
    email: string;
    profile?: { full_name?: string; };
}

const STATUS_OPTIONS = [
    'Pedido', 'En Producción', 'Finalizado', 'En camino', 'En Entrega', 'Entregado', 'Cancelado'
];

const STATUS_COLORS: Record<string, string> = {
    'Pedido':        'bg-blue-50 text-blue-600 border-blue-100',
    'En Producción': 'bg-violet-50 text-violet-600 border-violet-100',
    'Finalizado':    'bg-teal-50 text-teal-600 border-teal-100',
    'En camino':      'bg-orange-50 text-orange-600 border-orange-100',
    'En Entrega':    'bg-indigo-50 text-indigo-600 border-indigo-100',
    'Entregado':     'bg-green-50 text-green-600 border-green-100',
    'Cancelado':     'bg-red-50 text-red-600 border-red-100',
    'pending':       'bg-slate-50 text-slate-600 border-slate-100',
};

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [deliveryUsers, setDeliveryUsers] = useState<DeliveryUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Modal state
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchOrders();
        fetchDeliveryUsers();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await api.get('/orders');
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryUsers = async () => {
        try {
            const users = await api.get('/users');
            if (Array.isArray(users)) {
                setDeliveryUsers(users.filter(u => u.role === 'delivery'));
            }
        } catch (err) {
            console.error('Error fetching delivery users:', err);
        }
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openOrderDetail = (order: Order) => {
        setSelectedOrder(order);
        setEditMode(false);
        setEditedItems(order.items || []);
        setMotivo('');
    };

    const toggleEditMode = () => {
        if (!editMode) {
            setEditedItems([...(selectedOrder?.items || [])]);
        }
        setEditMode(!editMode);
    };

    const updateItemQuantity = (id: string, delta: number) => {
        setEditedItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeItem = (id: string) => {
        if (editedItems.length <= 1) {
            showToast('⚠️ Un pedido debe tener al menos un producto', 'error');
            return;
        }
        setEditedItems(prev => prev.filter(item => item.id !== id));
    };

    const calculateNewTotal = () => {
        return editedItems.reduce((acc, item) => acc + (item.quantity * item.price_at_time), 0);
    };

    const handleSaveOrderChanges = async () => {
        if (!selectedOrder) return;
        
        // Validar si hubo cambios en los items
        const originalItemsJSON = JSON.stringify((selectedOrder.items || []).map(i => ({ id: i.id, q: i.quantity })));
        const currentItemsJSON = JSON.stringify(editedItems.map(i => ({ id: i.id, q: i.quantity })));
        const hasChanges = originalItemsJSON !== currentItemsJSON;

        if (hasChanges && !motivo.trim()) {
            showToast('⚠️ Debes ingresar un motivo para la modificación', 'error');
            return;
        }

        try {
            setSaving(true);
            const updates: any = {
                items: editedItems.map(i => ({
                    productId: i.product_id,
                    quantity: i.quantity,
                    price: i.price_at_time
                })),
                total: calculateNewTotal()
            };

            if (hasChanges) {
                updates.motivo = motivo;
            }

            await api.patch(`/orders/${selectedOrder.id}`, updates);
            const updated = await api.get(`/orders/${selectedOrder.id}`) as Order;
            
            // Actualizar lista local
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));
            setSelectedOrder(updated);
            setEditMode(false);
            setMotivo('');
            showToast('✅ Pedido modificado correctamente');
        } catch (err) {
            showToast('❌ Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedOrder) return;
        try {
            setSaving(true);
            const updated = await api.patch(`/orders/${selectedOrder.id}`, { status }) as Order;
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));
            setSelectedOrder(updated);
            showToast(`✅ Estado cambiado a: ${status}`);
        } catch (err) {
            showToast('❌ Error al cambiar estado', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignDelivery = async (deliveryId: string) => {
        if (!selectedOrder) return;
        try {
            setSaving(true);
            // Optimistic update for instant UI feedback
            const optimisticOrder = { ...selectedOrder, delivery_user_id: deliveryId };
            setSelectedOrder(optimisticOrder);

            const updated = await api.patch(`/orders/${selectedOrder.id}/assign`, { deliveryUserId: deliveryId }) as Order;
            
            // Sync with final server state
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updated : o));
            setSelectedOrder(updated);
            showToast('✅ Delivery asignado');
        } catch (err) {
            // Revert on error
            const original = await api.get(`/orders/${selectedOrder.id}`) as Order;
            setSelectedOrder(original);
            showToast('❌ Error al asignar delivery', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredOrders = orders.filter(o => {
        const q = search.toLowerCase();
        const matchesSearch = !q ||
            o.id.toLowerCase().includes(q) ||
            o.user?.email.toLowerCase().includes(q) ||
            o.user?.profile?.full_name?.toLowerCase().includes(q) ||
            o.items?.some(item => item.product?.name?.toLowerCase().includes(q)) ||
            o.items?.some(item => {
                const catObj = item.product?.category;
                const catName = typeof catObj === 'object' && catObj ? (catObj as { name: string }).name : (catObj || '');
                return catName.toLowerCase().includes(q);
            });
        const matchesStatus = statusFilter === 'Todos' || o.status === statusFilter;
        const orderDate = new Date(o.created_at).toISOString().split('T')[0];
        const matchesStart = !startDate || orderDate >= startDate;
        const matchesEnd = !endDate || orderDate <= endDate;
        return matchesSearch && matchesStatus && matchesStart && matchesEnd;
    });

    const isModified = (order: Order) => order.notes && order.notes.includes('modificado');

    const handlePrintOrder = (order: Order) => {
        const items = order.items || [];
        const grouped: Record<string, OrderItem[]> = {};
        items.forEach(item => {
            const catObj = item.product?.category;
            const cat = typeof catObj === 'object' && catObj ? (catObj as { name: string }).name : (catObj || 'Sin categoría');
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        const categoryRows = Object.entries(grouped).map(([cat, catItems], idx) => {
            const rows = catItems.map((item, rowIdx) =>
                `<tr${rowIdx === 0 ? ' class="first-row"' : ''}><td>${item.product?.name || 'Producto'}</td><td>${item.quantity}</td></tr>`
            ).join('');
            return `${idx > 0 ? '<tr style="height:6px"><td colspan="2" style="border:none"></td></tr>' : ''}<tr class="cat"><td colspan="2">${cat}</td></tr>${rows}`;
        }).join('');
        const fecha = new Date(order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const clientName = order.user?.profile?.full_name || 'Anónimo';
        const clientPhone = order.user?.profile?.phone || '';
        const addr = order.address?.address || '';
        
        let deliveryLabel = '';
        let addressInfo = '';
        
        if (order.delivery_type === 'pickup') {
            deliveryLabel = 'Pick up';
        } else if (order.delivery_type === 'other') {
            deliveryLabel = 'Temporal';
            addressInfo = addr;
        } else {
            deliveryLabel = 'Dirección';
            addressInfo = addr;
        }
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${order.id.slice(0,8)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;width:80%;margin:0 auto;font-size:10px}
@media print{@page{size:letter;margin:15mm}body{width:80%;max-width:none;margin:0 auto}}
.hd{text-align:center;border-bottom:2px double #333;padding-bottom:6px;margin-bottom:8px}
.hd h1{font-size:14px;font-weight:900;letter-spacing:1px}
.hd p{font-size:9px;color:#666;margin-top:1px}
.info{font-size:9px;margin-bottom:6px;padding:3px 0;border-bottom:1px dashed #ccc}
.info div{display:flex;justify-content:space-between;padding:1px 0}
.info .lb{font-weight:700;color:#555}
table{width:100%;border-collapse:collapse;margin-bottom:6px}
th{font-size:8px;text-transform:uppercase;color:#999;padding:1px 4px 3px 4px;text-align:left}
th:nth-child(2){text-align:right}
td{padding:2px 4px;font-size:9px;border-top:1px dotted #eee}
tr.first-row td{border-top:none}
td:nth-child(2){text-align:right}
.cat td{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:#555;background:#f0f0f0;border-top:1px solid #333;padding:2px}
.tot{border-top:2px double #333;padding-top:4px;display:flex;justify-content:space-between;font-size:12px;font-weight:900}
.ft{text-align:center;margin-top:6px;padding-top:3px;border-top:1px dashed #ccc;font-size:7px;color:#999}
</style></head><body>
<div class="hd"><h1>JHOANES BAKERY</h1><p>Sistema de Pedidos</p><p>PEDIDO #${order.id.slice(0,8).toUpperCase()}</p><p>${fecha}</p></div>
<div class="info">
<div><span class="lb">Cliente:</span><span>${clientName}</span></div>
${clientPhone ? `<div><span class="lb">Tel:</span><span>${clientPhone}</span></div>` : ''}
<div><span class="lb">Entrega:</span><span>${deliveryLabel}</span></div>
${addressInfo ? `<div><span class="lb">${deliveryLabel}:</span><span>${addressInfo}</span></div>` : ''}
<div><span class="lb">Estado:</span><span>${order.status}</span></div>
</div>
<table><thead><tr><th>Producto</th><th style="text-align:right">Cant</th></tr></thead><tbody>${categoryRows}</tbody></table>
<div style="border-top:1px solid #333; margin-top:7px; padding-top:4px; text-align:right; font-weight:bold; font-size:11px">
    Total productos: ${items.reduce((acc, i) => acc + i.quantity, 0)}
</div>
${order.notes ? `<div class="ft" style="margin-top:4px; padding-top:2px"><b>Notas:</b> ${order.notes.replace(/\n/g, ' | ')}</div>` : ''}
<div class="ft" style="font-size:8px; margin-top:4px; padding-top:2px">Gracias por tu compra</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script>
</body></html>`;
        const w = window.open('', '_blank', 'width=900,height=700');
        if (w) { w.document.write(html); w.document.close(); }
    };

    return (
        <div className="flex min-h-screen bg-muted/30 font-sans">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl font-black mb-1 animate-fade-in text-slate-800">Panel de Pedidos</h1>
                        <p className="text-muted-foreground font-medium">Supervisión y control de ventas en tiempo real</p>
                    </div>
                </header>

                <div className="bg-white p-6 rounded-3xl border border-border shadow-sm mb-8 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar por cliente, email, producto o categoría..." 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Filter size={18} className="text-muted-foreground" />
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="flex-1 md:w-52 px-4 py-2.5 bg-muted/30 border border-border rounded-xl outline-none font-bold text-slate-700 cursor-pointer"
                            >
                                <option>Todos</option>
                                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <CalendarDays size={18} className="text-muted-foreground" />
                        <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Desde</span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-xs font-bold text-slate-700 py-1" />
                        </div>
                        <span className="text-slate-300 font-bold">→</span>
                        <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-3 py-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-xs font-bold text-slate-700 py-1" />
                        </div>
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate(''); }} className="px-3 py-1.5 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1">
                                <X size={12} /> Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                        <Loader2 size={40} className="animate-spin text-primary opacity-60" />
                        <p className="font-bold tracking-tight">Sincronizando órdenes...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2rem] border border-border overflow-hidden shadow-xl shadow-slate-200/50">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 border-b border-border">
                                <tr>
                                    <th className="px-8 py-5">Orden</th>
                                    <th className="px-8 py-5">Cliente</th>
                                    <th className="px-8 py-5">Estado</th>
                                    <th className="px-8 py-5">Repartidor</th>
                                    <th className="px-8 py-5 text-right">Total</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredOrders.map(order => (
                                    <tr 
                                        key={order.id} 
                                        className="hover:bg-primary/[0.02] transition-colors cursor-pointer group"
                                        onClick={() => openOrderDetail(order)}
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(0, 8)}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                                                        <Clock size={10} /> {new Date(order.created_at).toLocaleDateString()}
                                                    </span>
                                                    {isModified(order) && (
                                                        <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-sm uppercase">
                                                            <Edit size={8} /> Modificado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="font-bold text-slate-800 leading-none mb-1 group-hover:text-primary transition-colors">{order.user?.profile?.nickname || order.user?.profile?.full_name || 'Anónimo'}</p>
                                            <p className="text-xs text-muted-foreground font-medium truncate max-w-[180px]">{order.user?.email}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shadow-sm transition-all group-hover:scale-105 inline-block ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            {order.delivery_user ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-primary font-black text-xs ring-4 ring-slate-50">
                                                        {order.delivery_user.profile?.full_name?.charAt(0) || 'D'}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600">{order.delivery_user.profile?.full_name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-300 italic flex items-center gap-1.5">
                                                    <Truck size={12} /> Esperando asignación
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-lg font-black text-primary">${Number(order.total || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => openOrderDetail(order)}
                                                    className="p-2 bg-slate-100 text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                                                    title="Ver detalles"
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                                {!order.delivery_user && (
                                                    <button 
                                                        onClick={() => openOrderDetail(order)}
                                                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-black uppercase hover:bg-primary/20 transition-all"
                                                    >
                                                        Asignar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <tr><td colSpan={5} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <ShoppingBag size={48} />
                                            <p className="text-sm font-black uppercase tracking-widest italic">No hay pedidos disponibles</p>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Order Detail Side Panel */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedOrder(null)} />
                    <div 
                        className="bg-white w-full max-w-2xl h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 relative z-10 cursor-default"
                    >
                        <header className="p-8 border-b border-border flex items-center justify-between shrink-0 bg-slate-50/50">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-black text-slate-800">Expediente del Pedido</h2>
                                    {isModified(selectedOrder) && <span className="text-amber-600 text-[10px] font-black uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100">Modificado</span>}
                                </div>
                                <p className="font-mono text-xs text-slate-400 font-bold tracking-widest">TRANSMISIÓN: #{selectedOrder.id}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => handlePrintOrder(selectedOrder)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2">
                                    <Printer size={14} /> Imprimir
                                </button>
                                <button 
                                    onClick={() => setSelectedOrder(null)} 
                                    className="w-12 h-12 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all text-slate-400 group"
                                >
                                    <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-10 space-y-12">
                            {/* Workflow Status */}
                            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <History size={14} className="text-primary" /> Línea de Tiempo del Pedido
                                    </h3>
                                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-full border shadow-sm ${STATUS_COLORS[selectedOrder.status] || STATUS_COLORS.pending}`}>
                                        {selectedOrder.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {STATUS_OPTIONS.map(status => (
                                        <button 
                                            key={status}
                                            onClick={() => handleUpdateStatus(status)}
                                            disabled={saving}
                                            className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border ${selectedOrder.status === status ? 'bg-primary text-white border-primary shadow-xl scale-105 active:scale-95' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200 hover:text-slate-600'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Customer Insight */}
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                        <User size={16} className="text-primary" /> Información del Cliente
                                    </h3>
                                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-[2rem] p-6 border border-slate-100 space-y-4 shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-primary text-white font-black text-xl rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-primary/30">
                                                {(selectedOrder.user?.profile?.nickname || selectedOrder.user?.profile?.full_name || 'U').charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{selectedOrder.user?.profile?.nickname || selectedOrder.user?.profile?.full_name || 'Cliente de Antigravity'}</p>
                                                <p className="text-xs text-primary font-bold">{selectedOrder.user?.email}</p>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                                            <div className="flex items-start gap-3">
                                                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed italic">{selectedOrder.address?.address || 'Retiro en local'}</p>
                                            </div>
                                            {selectedOrder.user?.profile?.phone && (
                                                <div className="flex items-center gap-3">
                                                    <Phone size={14} className="text-slate-400 shrink-0" />
                                                    <p className="text-xs text-slate-600 font-bold">{selectedOrder.user.profile.phone}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Delivery Logistics */}
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                        <Truck size={16} className="text-primary" /> Logística de Entrega
                                    </h3>
                                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-3 custom-scrollbar">
                                        <button 
                                            onClick={() => handleAssignDelivery('')}
                                            className={`w-full text-left p-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.15em] border transition-all ${!selectedOrder.delivery_user_id ? 'bg-slate-800 text-white border-slate-800 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
                                        >
                                            Anular Asignación
                                        </button>
                                        {deliveryUsers.map(delivery => (
                                            <button 
                                                key={delivery.id}
                                                disabled={saving}
                                                onClick={() => handleAssignDelivery(delivery.id)}
                                                className={`w-full text-left p-4 rounded-[1.5rem] border-2 transition-all flex items-center justify-between group h-20 ${selectedOrder.delivery_user_id === delivery.id ? 'bg-primary border-primary shadow-xl shadow-primary/20' : 'bg-white border-slate-100 hover:border-primary/40'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-[1rem] flex items-center justify-center font-black text-xs ${selectedOrder.delivery_user_id === delivery.id ? 'bg-white text-primary ring-4 ring-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                                        {delivery.profile?.full_name?.charAt(0) || 'D'}
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-black leading-tight ${selectedOrder.delivery_user_id === delivery.id ? 'text-white' : 'text-slate-700'}`}>{delivery.profile?.full_name}</p>
                                                        <p className={`text-[10px] font-bold mt-0.5 ${selectedOrder.delivery_user_id === delivery.id ? 'text-white/90' : 'text-primary'}`}>
                                                            {selectedOrder.delivery_user_id === delivery.id ? '● ASIGNADO' : 'Disponible'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={18} className={selectedOrder.delivery_user_id === delivery.id ? 'text-white' : 'text-slate-300 group-hover:translate-x-1 group-hover:text-primary transition-all'} />
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Cart Management */}
                            <section className="space-y-6">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <ShoppingBag size={16} className="text-primary" /> Líneas de Productos
                                    </h3>
                                    <button 
                                        onClick={toggleEditMode}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm transition-all ${editMode ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'}`}
                                    >
                                        {editMode ? <History size={14} /> : <Edit size={14} />}
                                        {editMode ? 'No Cancelar' : 'Modificar Pedido'}
                                    </button>
                                </div>
                                
                                <div className="space-y-4">
                                    {(editMode ? editedItems : (selectedOrder.items || [])).map(item => (
                                        <div key={item.id} className="flex gap-6 p-5 rounded-[2rem] bg-slate-50 group border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-lg transition-all">
                                            <div className="relative shrink-0">
                                                {item.product?.image ? (
                                                    <img src={item.product.image?.startsWith('http') ? item.product.image : `${API_URL}${item.product.image}`} className="w-20 h-20 rounded-[1.5rem] object-cover shadow-md group-hover:scale-110 transition-transform duration-500" alt={item.product.name} />
                                                ) : (
                                                    <div className="w-20 h-20 bg-slate-200 rounded-[1.5rem] flex items-center justify-center text-slate-400"><ShoppingBag size={32} /></div>
                                                )}
                                                <span className="absolute -top-2 -right-2 bg-slate-800 text-white w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black shadow-lg">x{item.quantity}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <h4 className="font-black text-slate-800 text-lg leading-tight truncate">{item.product?.name || 'Articulo Invitado'}</h4>
                                                <p className="text-xs text-slate-400 font-bold tracking-wider mt-1 underline decoration-primary/30 underline-offset-4">UNITARIO: ${Number(item.price_at_time).toFixed(2)}</p>
                                            </div>

                                            {editMode ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="grid grid-cols-[40px_48px_40px] items-center bg-white rounded-2xl border border-slate-200 p-1 shadow-inner shrink-0">
                                                        <button type="button" onClick={() => updateItemQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-primary rounded-xl transition-all"><Minus size={14} /></button>
                                                        <span className="w-12 h-10 flex items-center justify-center font-black text-slate-800 border-x border-slate-100">{item.quantity}</span>
                                                        <button type="button" onClick={() => updateItemQuantity(item.id, 1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-primary rounded-xl transition-all"><Plus size={14} /></button>
                                                    </div>
                                                    <button onClick={() => removeItem(item.id)} className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"><Trash2 size={18}/></button>
                                                </div>
                                            ) : (
                                                <div className="text-right flex flex-col justify-center items-end">
                                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest text-[9px] mb-1">Subtotal</p>
                                                    <p className="text-2xl font-black text-slate-800">${(Number(item.price_at_time) * item.quantity).toFixed(2)}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {editMode && (
                                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-800">
                                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                            <MessageSquare size={16} /> Justificación Obligatoria
                                        </h4>
                                        <textarea 
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                            rows={4}
                                            placeholder="Indique la razón de este cambio estructural en el pedido... (Ej: Rectificación de cantidad, cambio por producto similar, etc.)"
                                            className="w-full bg-slate-800 border-2 border-slate-700 rounded-3xl p-6 text-white placeholder:text-slate-500 outline-none focus:border-primary/50 transition-all font-medium text-sm resize-none mb-8"
                                        />
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <button 
                                                onClick={handleSaveOrderChanges}
                                                disabled={saving}
                                                className="flex-1 py-5 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/30 hover:bg-white hover:text-primary transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Confirma y Aplicar Audit
                                            </button>
                                            <button 
                                                onClick={toggleEditMode}
                                                className="px-10 py-5 bg-slate-800 text-slate-400 font-black uppercase tracking-widest text-xs rounded-2xl border border-slate-700 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95"
                                            >
                                                Abortar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-8 border-t-4 border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 px-4">
                                    <div className="flex flex-col items-center sm:items-start">
                                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Impacto Fiscal</span>
                                        <span className="text-4xl font-black text-slate-800 tracking-tighter">${(editMode ? calculateNewTotal() : Number(selectedOrder.total || 0)).toFixed(2)}</span>
                                    </div>
                                    {!editMode && (
                                        <button onClick={() => setSelectedOrder(null)} className="w-full sm:w-64 py-5 bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95">Archivar Cierre</button>
                                    )}
                                </div>
                            </section>

                            {/* Audit Logs in Notes */}
                            {selectedOrder.notes && (
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 px-1">
                                        <AlertCircle size={16} className="text-amber-500" /> Bitácora de Modificaciones
                                    </h3>
                                    <div className="bg-amber-50/50 rounded-[2.5rem] p-8 border border-amber-100/50 space-y-4">
                                        {selectedOrder.notes.split('\n').filter(Boolean).map((note, i) => (
                                            <div key={i} className="flex gap-4 items-start bg-white/80 p-5 rounded-3xl border border-amber-100/30">
                                                <div className="w-10 h-10 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                                                    <Edit size={16} />
                                                </div>
                                                <p className="text-xs text-slate-600 font-bold leading-relaxed">{note}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Toast */}
            {toast && (
                <div className={`fixed bottom-10 right-10 z-[100] flex items-center gap-4 px-6 py-5 rounded-[2rem] shadow-2xl text-white font-black tracking-tight text-sm animate-in slide-in-from-bottom duration-300 ${toast.type === 'error' ? 'bg-red-500 shadow-red-500/20' : 'bg-green-500 shadow-green-500/20'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

