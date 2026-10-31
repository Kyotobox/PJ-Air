'use client';

import React, { useState, useEffect } from 'react';
import DeliverySidebar from '@/components/layout/DeliverySidebar';
import { 
    Truck, MapPin, Camera, CheckCircle2, Navigation, 
    Clock, Phone, ChevronRight, Map as MapIcon, Loader2,
    Package, ShoppingBag, X, AlertCircle, Eye, Info, User as UserIcon
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/config';
import StreetViewFacadeCard from '@/components/delivery/StreetViewFacadeCard';

interface OrderItem {
    id: string;
    quantity: number;
    product?: { name: string; image?: string; };
}

interface DeliveryAddress {
    address: string;
    city: string;
    state?: string;
    lat?: number;
    lng?: number;
    refined_lat?: number;
    refined_lng?: number;
    access_code?: string;
    has_key?: boolean;
    key_location?: string;
    fridge_access_required?: boolean;
    delivery_photos_json?: string;
}

interface Order {
    id: string;
    total: number;
    status: string;
    created_at: string;
    notes?: string;
    delivery_user_id?: string;
    user?: { profile?: { full_name?: string; phone?: string; }; };
    address?: DeliveryAddress;
    items?: OrderItem[];
}

export default function DeliveryPage() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDelivery, setActiveDelivery] = useState<Order | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        if (user) fetchAssignedOrders();
    }, [user]);

    const fetchAssignedOrders = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await api.get('/orders');
            // Show orders assigned to me regardless of readiness to give visibility
            const myOrders = Array.isArray(data) ? data.filter(o => 
                o.delivery_user_id === user?.id && 
                ['pending', 'Pedido', 'En Producción', 'Finalizado', 'En camino', 'En Entrega'].includes(o.status)
            ) : [];
            console.log('My Assigned Orders:', myOrders);
            setOrders(myOrders);
            
            // Check if there's an ongoing delivery
            const ongoing = myOrders.find(o => ['En camino', 'En Entrega'].includes(o.status));
            if (ongoing) setActiveDelivery(ongoing);
        } catch (err) {
            console.error('Error fetching delivery orders:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        try {
            const updated = await api.patch(`/orders/${orderId}/status`, { status: newStatus }) as any;
            if (newStatus === 'En camino') {
                setActiveDelivery(updated);
                showToast('🚀 El pedido está ahora En Camino');
            } else if (newStatus === 'Entregado') {
                setActiveDelivery(null);
                showToast('✅ Entrega completada con éxito');
            }
            fetchAssignedOrders(true); // Silent update
        } catch (err) {
            showToast('❌ Error al actualizar estado', 'error');
            console.error(err);
        }
    };

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            confirmDelivery();
        }
    };

    const confirmDelivery = async () => {
        if (!activeDelivery || isCapturing) return;
        setIsCapturing(true);
        try {
            // Simulate processing/uploading
            await new Promise(r => setTimeout(r, 2000));
            await handleUpdateStatus(activeDelivery.id, 'Entregado');
        } finally {
            setIsCapturing(false);
        }
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div className="flex min-h-screen bg-slate-50/50 font-sans">
            <DeliverySidebar />
            <main className="flex-1 p-8 overflow-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mis Entregas</h1>
                        <p className="text-muted-foreground font-medium">Gestiona tu ruta y confirma recepciones</p>
                    </div>
                </header>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 size={40} className="animate-spin text-primary opacity-40" />
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cargando Hoja de Ruta...</p>
                    </div>
                ) : !activeDelivery ? (
                    <div className="max-w-4xl space-y-6">
                        {orders.length === 0 && (
                            <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-20 text-center">
                                <Package size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-xl font-bold text-slate-400">No tienes pedidos asignados por ahora</h3>
                                <p className="text-sm text-slate-400 mt-2">Relájate o revisa con el administrador</p>
                            </div>
                        )}
                        {orders.filter(o => o.status !== 'En Entrega').map(order => (
                            <div key={order.id} className={`bg-white rounded-[2.5rem] border border-border p-8 shadow-sm transition-all group ${['Finalizado'].includes(order.status) ? 'hover:shadow-xl hover:-translate-y-1' : 'opacity-70'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-primary bg-primary/5 px-4 py-1.5 rounded-xl block">#{order.id.slice(0, 8)}</span>
                                        {order.status === 'Finalizado' ? (
                                            <span className="text-[10px] font-black uppercase text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 tracking-widest">Listo para Despacho</span>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 tracking-widest">En Preparación / Horno</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button 
                                            onClick={() => setSelectedOrder(order)}
                                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/20"
                                            title="Ver detalle del pedido"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{order.items?.length || 0} ítems</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 mb-8 group-hover:bg-white transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-slate-100 shrink-0">
                                            <UserIcon size={28} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-lg font-black text-slate-800 truncate">{order.user?.profile?.full_name || 'Cliente sin nombre'}</p>
                                            <div className="flex items-center gap-2 text-slate-500 mt-1">
                                                <MapPin size={14} className="shrink-0" />
                                                <p className="text-sm font-bold truncate">{order.address?.address}, {order.address?.city}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedOrder(order)}
                                            className="px-6 py-3 bg-white text-slate-800 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-all flex items-center gap-2 shadow-sm"
                                        >
                                            <Info size={16} /> Ver Guía
                                        </button>
                                    </div>
                                </div>

                                {order.status === 'Finalizado' ? (
                                    <button
                                        onClick={() => handleUpdateStatus(order.id, 'En camino')}
                                        className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/30 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                                    >
                                        <Truck size={18} className="group-hover:translate-x-1 group-hover:-rotate-6 transition-transform" />
                                        Comenzar Reparto (En camino)
                                    </button>
                                ) : (
                                    <div className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
                                        <Clock size={18} />
                                        Esperando a Producción
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 max-w-2xl mx-auto">
                        <div className="bg-white rounded-[3rem] border border-border shadow-2xl overflow-hidden mb-8">
                            <div className="bg-slate-800 p-10 text-white flex justify-between items-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl" />
                                <div className="relative z-10">
                                    <h2 className="text-3xl font-black tracking-tight mb-1">Pedido en camino</h2>
                                    <p className="text-white/50 font-black uppercase tracking-widest text-[10px]">Orden #{activeDelivery.id.slice(0, 8)}</p>
                                </div>
                                <Truck size={40} className="animate-pulse relative z-10" />
                            </div>

                            <div className="p-10 space-y-10">
                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl text-primary shrink-0 border border-slate-100">
                                            <MapPin size={28} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-2 tracking-widest">Dirección del Cliente</p>
                                            <p className="text-xl font-bold leading-tight text-slate-800">{activeDelivery.address?.address}</p>
                                            <p className="text-xs font-bold text-primary mt-1">{activeDelivery.address?.city}, {activeDelivery.address?.state}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button className="flex items-center justify-center gap-2 py-4 bg-white border border-border rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                                            <MapIcon size={16} /> Abrir Mapa
                                        </button>
                                        <button className="flex items-center justify-center gap-2 py-4 bg-white border border-border rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                                            <Phone size={16} /> Llamar Cliente
                                        </button>
                                    </div>
                                </div>

                                {activeDelivery.address && (
                                    <StreetViewFacadeCard 
                                        address={activeDelivery.address} 
                                        autoLoad={true} 
                                        title="Fachada y Acceso Nocturno (En Camino)" 
                                    />
                                )}

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest mb-6">Protocolo de Entrega</h3>
                                    
                                    <input 
                                        type="file" 
                                        id="delivery-photo" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="hidden" 
                                        onChange={handlePhotoCapture}
                                    />

                                    <label
                                        htmlFor="delivery-photo"
                                        className={`w-full h-48 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-primary/40 hover:text-primary cursor-pointer transition-all group overflow-hidden relative ${isCapturing ? 'pointer-events-none opacity-60' : ''}`}
                                    >
                                        {isCapturing ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 size={48} className="animate-spin text-primary" />
                                                <span className="font-black uppercase text-[10px] tracking-widest text-primary">Subiendo Prueba y GPS...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                    <Camera size={32} />
                                                </div>
                                                <span className="font-black uppercase text-[10px] tracking-widest">Tomar Foto y Confirmar Entrega</span>
                                            </>
                                        )}
                                    </label>
                                </div>

                                <button
                                    onClick={() => setActiveDelivery(null)}
                                    className="w-full py-5 bg-white border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-50 hover:border-red-100 transition-all"
                                >
                                    Reportar Problema / Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Details Modal */}
                {selectedOrder && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <header className="p-8 bg-slate-50 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                                        <ShoppingBag size={24} />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-slate-800">Detalle de la Orden</h2>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">#{selectedOrder.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
                                    <X size={20} />
                                </button>
                            </header>

                            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                                {/* Logistic Info Section */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Guía de Entrega</h3>
                                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm shrink-0 border border-slate-100">
                                                <MapPin size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Destino</p>
                                                <p className="text-base font-bold text-slate-800 leading-tight">{selectedOrder.address?.address}</p>
                                                <p className="text-xs font-bold text-primary mt-1 uppercase">{selectedOrder.address?.city}</p>
                                            </div>
                                            <button 
                                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.address?.address + ', ' + selectedOrder.address?.city)}`, '_blank')}
                                                className="p-3 bg-slate-800 text-white rounded-xl hover:bg-black transition-all shadow-md"
                                                title="Abrir en GPS"
                                            >
                                                <MapIcon size={20} />
                                            </button>
                                        </div>

                                        <div className="h-px bg-slate-200 w-full" />

                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm shrink-0 border border-slate-100">
                                                <UserIcon size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Cliente</p>
                                                <p className="text-base font-bold text-slate-800 truncate">{selectedOrder.user?.profile?.full_name}</p>
                                                <p className="text-xs font-bold text-slate-500">{selectedOrder.user?.profile?.phone || 'Sin teléfono'}</p>
                                            </div>
                                            {selectedOrder.user?.profile?.phone && (
                                                <a 
                                                    href={`tel:${selectedOrder.user.profile.phone}`}
                                                    className="p-3 bg-primary text-white rounded-xl hover:opacity-90 transition-all shadow-md"
                                                    title="Llamar al cliente"
                                                >
                                                    <Phone size={20} />
                                                </a>
                                            )}
                                        </div>

                                        {selectedOrder.address && (
                                            <StreetViewFacadeCard 
                                                address={selectedOrder.address} 
                                                autoLoad={false} 
                                                title="Fachada y Acceso Nocturno (3:00 AM)" 
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Productos del Pedido</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedOrder.items?.map(item => (
                                            <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                {item.product?.image ? (
                                                    <img src={item.product.image?.startsWith('http') ? item.product.image : `${API_URL}${item.product.image}`} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt={item.product.name} />
                                                ) : (
                                                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                                                        <Package size={20} />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <p className="font-bold text-slate-800 text-sm leading-tight">{item.product?.name || 'Producto'}</p>
                                                    <p className="text-[10px] text-muted-foreground font-bold">Cantidad: {item.quantity}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedOrder.notes && (
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Notas del cliente</h3>
                                        <div className="p-5 bg-amber-50 rounded-3xl border border-amber-100/50">
                                            <p className="text-xs font-medium text-amber-900 leading-relaxed italic">"{selectedOrder.notes}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-border">
                                <button 
                                    onClick={() => setSelectedOrder(null)}
                                    className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    Cerrar Detalle
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

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
