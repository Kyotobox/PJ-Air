'use client';

import React, { useState, useEffect } from 'react';
import ProduccionSidebar from '@/components/layout/ProduccionSidebar';
import { 
    Package, Search, Clock, CheckCircle2, Eye, 
    Filter, ChevronRight, Loader2, Truck, AlertCircle,
    ShoppingBag, User, MapPin, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface OrderItem {
    id: string;
    quantity: number;
    price_at_time: number;
    product?: { name: string; image?: string; };
}

interface Order {
    id: string;
    total: number;
    status: string;
    created_at: string;
    user?: { email: string; profile?: { full_name?: string; phone?: string; }; };
    delivery_user_id?: string;
    delivery_user?: { profile?: { full_name?: string; }; };
    address?: { address: string; city: string; };
    items?: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
    'Pedido':        'bg-blue-50 text-blue-600 border-blue-100',
    'En Producción': 'bg-violet-50 text-violet-600 border-violet-100',
    'Finalizado':    'bg-teal-50 text-teal-600 border-teal-100',
    'En camino':      'bg-orange-50 text-orange-600 border-orange-100',
    'En Entrega':    'bg-indigo-50 text-indigo-600 border-indigo-100',
    'Entregado':     'bg-green-50 text-green-600 border-green-100',
    'Cancelado':     'bg-red-50 text-red-600 border-red-100',
};

export default function ProduccionPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [deliveryUsers, setDeliveryUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [showAssign, setShowAssign] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchOrders();
        fetchDeliveryUsers();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await api.get('/orders');
            // Show orders relevant to production monitoring (exclude orders pending Zelle verification)
            const filtered = Array.isArray(data) ? data.filter(o => 
                ['pending', 'Pedido', 'En Producción', 'Finalizado', 'En camino', 'En Entrega'].includes(o.status) &&
                o.payment_status !== 'pending_zelle_verification'
            ) : [];
            setOrders(filtered);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryUsers = async () => {
        try {
            const data = await api.get('/users');
            if (Array.isArray(data)) {
                setDeliveryUsers(data.filter(u => u.role === 'delivery'));
            }
        } catch (err) { console.error(err); }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        setUpdating(orderId);
        try {
            const updated = await api.patch(`/orders/${orderId}`, { status: newStatus }) as any;
            setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
            if (selectedOrder?.id === orderId) setSelectedOrder(updated);
            showToast(`✅ Pedido actualizado a: ${newStatus}`);
        } catch (err) {
            showToast('❌ Error al actualizar estado', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleAssignDelivery = async (orderId: string, deliveryId: string) => {
        try {
            await api.patch(`/orders/${orderId}/assign`, { deliveryUserId: deliveryId });
            showToast('✅ Repartidor asignado');
            setShowAssign(null);
            fetchOrders();
        } catch (err) {
            showToast('❌ Error al asignar repartidor', 'error');
        }
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const filtered = orders.filter(o => 
        o.id.includes(search) || 
        o.user?.profile?.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    const getDisplayStatus = (status: string) => {
        if (status === 'pending') return 'Pedido';
        return status;
    };

    return (
        <div className="flex min-h-screen bg-muted/30 font-sans">
            <ProduccionSidebar />
            <main className="flex-1 p-8 overflow-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 mb-1">Centro de Producción</h1>
                        <p className="text-muted-foreground font-medium">Gestión y despacho de preparaciones</p>
                    </div>
                </header>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-[2rem] border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center font-black text-xl">
                            {orders.filter(o => ['pending', 'Pedido'].includes(o.status)).length}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes</p>
                            <p className="font-bold text-slate-700">Por iniciar</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-violet-50 text-violet-500 rounded-2xl flex items-center justify-center font-black text-xl">
                            {orders.filter(o => o.status === 'En Producción').length}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">En Proceso</p>
                            <p className="font-bold text-slate-700">En el horno</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center font-black text-xl">
                            {orders.filter(o => o.status === 'Finalizado').length}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Finalizados</p>
                            <p className="font-bold text-slate-700">Listos para entrega</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-[2rem] border border-border shadow-sm mb-8">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar pedido por ID o cliente..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 size={40} className="animate-spin text-primary opacity-40" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Sincronizando Cocina...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2rem] border border-border shadow-xl shadow-slate-200/50 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-border">
                                <tr>
                                    <th className="px-8 py-5">Orden</th>
                                    <th className="px-8 py-5">Cliente</th>
                                    <th className="px-8 py-5">Estado</th>
                                    <th className="px-8 py-5">Logística</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(order => (
                                    <tr key={order.id} className="hover:bg-primary/[0.01] transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">#{order.id.slice(0, 8)}</span>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-bold">
                                                    <Clock size={10} /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{order.user?.profile?.full_name || 'Anónimo'}</span>
                                                <span className="text-xs text-muted-foreground">{order.items?.length || 0} productos</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                                                {getDisplayStatus(order.status)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="relative">
                                                {order.delivery_user ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 bg-primary text-white text-[10px] font-black rounded-lg flex items-center justify-center">
                                                            {order.delivery_user.profile?.full_name?.charAt(0) || 'D'}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">{order.delivery_user.profile?.full_name}</span>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setShowAssign(showAssign === order.id ? null : order.id)}
                                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase text-primary hover:underline"
                                                    >
                                                        <Truck size={14} /> Asignar Repartidor
                                                    </button>
                                                )}

                                                {showAssign === order.id && (
                                                    <div className="absolute left-0 top-full mt-2 w-56 bg-white shadow-2xl border border-border rounded-2xl z-20 overflow-hidden animate-zoom-in">
                                                        <div className="px-4 py-3 bg-muted text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-border">Repartidores Activos</div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {deliveryUsers.map(d => (
                                                                <button 
                                                                    key={d.id}
                                                                    onClick={() => handleAssignDelivery(order.id, d.id)}
                                                                    className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors border-b border-border last:border-0"
                                                                >
                                                                    {d.profile?.full_name || d.email}
                                                                </button>
                                                            ))}
                                                            {deliveryUsers.length === 0 && <p className="p-4 text-[10px] text-muted-foreground italic">No hay repartidores...</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {['pending', 'Pedido'].includes(order.status) && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(order.id, 'En Producción')}
                                                        disabled={updating === order.id}
                                                        className="px-4 py-2 bg-violet-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all"
                                                    >
                                                        Cocer / Hornear
                                                    </button>
                                                )}
                                                {order.status === 'En Producción' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(order.id, 'Finalizado')}
                                                        disabled={updating === order.id}
                                                        className="px-4 py-2 bg-amber-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
                                                    >
                                                        Finalizar
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-2 bg-slate-100 text-slate-500 hover:bg-primary hover:text-white rounded-xl transition-all"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedOrder(null)} />
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative overflow-hidden animate-zoom-in flex flex-col max-h-[90vh]">
                        <header className="p-8 border-b border-border flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Detalles de Preparación</h2>
                                <p className="text-xs font-mono text-slate-400 font-bold tracking-widest">ORDEN: #{selectedOrder.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="p-3 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all text-slate-400"><X size={24} /></button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-10 space-y-10">
                            {/* Products List */}
                            <section className="space-y-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <ShoppingBag size={14} className="text-primary" /> Receta / Comanda
                                </h3>
                                <div className="space-y-4">
                                    {selectedOrder.items?.map(item => (
                                        <div key={item.id} className="flex items-center gap-6 p-5 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-lg transition-all group">
                                            <div className="relative">
                                                {item.product?.image ? (
                                                    <img src={item.product?.image?.startsWith('http') ? item.product.image : `${API_URL}${item.product?.image}`} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                                                ) : (
                                                    <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400"><Package size={24} /></div>
                                                )}
                                                <span className="absolute -top-2 -right-2 bg-slate-800 text-white w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black shadow-lg">x{item.quantity}</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-tight">{item.product?.name || 'Producto'}</p>
                                                <p className="text-xs text-primary font-bold">Unidades: {item.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Cliente</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-700">{selectedOrder.user?.profile?.full_name || 'Anónimo'}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold">{selectedOrder.user?.email}</p>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Entrega</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center">
                                            <MapPin size={18} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-600 leading-tight italic">{selectedOrder.address?.address || 'Retiro en local'}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-border flex justify-between items-center shrink-0">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Pedido</span>
                                <span className="text-3xl font-black text-slate-800">${Number(selectedOrder.total).toFixed(2)}</span>
                             </div>
                             <div className="flex gap-3">
                                 {['pending', 'Pedido'].includes(selectedOrder.status) && (
                                     <button 
                                        onClick={() => handleUpdateStatus(selectedOrder.id, 'En Producción')}
                                        className="px-8 py-4 bg-violet-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all"
                                     > Iniciar Producción </button>
                                 )}
                                 {selectedOrder.status === 'En Producción' && (
                                     <button 
                                        onClick={() => handleUpdateStatus(selectedOrder.id, 'Finalizado')}
                                        className="px-8 py-4 bg-amber-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all"
                                     > Finalizar Preparación </button>
                                 )}
                             </div>
                        </footer>
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
