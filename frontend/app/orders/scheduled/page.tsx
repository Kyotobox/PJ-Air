'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Link from 'next/link';
import { 
    Calendar, 
    Clock, 
    Plus, 
    Trash2, 
    Play, 
    Pause, 
    RefreshCw, 
    Check, 
    Package, 
    Store, 
    Truck, 
    AlertCircle, 
    CreditCard, 
    ArrowLeft,
    Loader2,
    CheckCircle2,
    X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';

const DAY_OPTIONS = [
    { code: 'mon', labelEs: 'Lun', labelEn: 'Mon', fullEs: 'Lunes', fullEn: 'Monday' },
    { code: 'tue', labelEs: 'Mar', labelEn: 'Tue', fullEs: 'Martes', fullEn: 'Tuesday' },
    { code: 'wed', labelEs: 'Mié', labelEn: 'Wed', fullEs: 'Miércoles', fullEn: 'Wednesday' },
    { code: 'thu', labelEs: 'Jue', labelEn: 'Thu', fullEs: 'Jueves', fullEn: 'Thursday' },
    { code: 'fri', labelEs: 'Vie', labelEn: 'Fri', fullEs: 'Viernes', fullEn: 'Friday' },
    { code: 'sat', labelEs: 'Sáb', labelEn: 'Sat', fullEs: 'Sábado', fullEn: 'Saturday' },
    { code: 'sun', labelEs: 'Dom', labelEn: 'Sun', fullEs: 'Domingo', fullEn: 'Sunday' },
];

export default function ScheduledOrdersPage() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const { locale } = useLanguage();
    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionMessage, setActionMessage] = useState<{ type: string; text: string } | null>(null);

    // New subscription form state
    const [title, setTitle] = useState('');
    const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'wed', 'fri']);
    const [deliveryTime, setDeliveryTime] = useState('08:00');
    const [deliveryType, setDeliveryType] = useState('saved');
    const [addressId, setAddressId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('credit');
    const [selectedItems, setSelectedItems] = useState<{ productId: string; productName: string; quantity: number; price: number }[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedProductQty, setSelectedProductQty] = useState(5);

    const fetchAllData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [subsData, prodsData, addrsData] = await Promise.all([
                api.get('/orders/scheduled') as Promise<any[]>,
                api.get('/products') as Promise<any[]>,
                api.get(`/addresses/user/${user.id}`).catch(() => []) as Promise<any[]>,
            ]);

            setSubscriptions(Array.isArray(subsData) ? subsData : []);
            setProducts(Array.isArray(prodsData) ? prodsData : []);
            setAddresses(Array.isArray(addrsData) ? addrsData : []);
            if (addrsData && addrsData.length > 0) setAddressId(addrsData[0].id);
        } catch (err) {
            console.error('Error fetching subscription data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthLoading) return;
        if (!user) {
            router.push('/auth/login');
            return;
        }
        fetchAllData();
    }, [user, isAuthLoading]);

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            await api.patch(`/orders/scheduled/${id}`, { active: !currentActive });
            setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
            setActionMessage({
                type: 'success',
                text: !currentActive
                    ? lbl('Suscripción activada con éxito.', 'Subscription resumed successfully.')
                    : lbl('Suscripción pausada temporalmente.', 'Subscription paused temporarily.')
            });
            setTimeout(() => setActionMessage(null), 4000);
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.message || 'Error updating status' });
            setTimeout(() => setActionMessage(null), 4000);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(lbl('¿Estás seguro de eliminar este pedido recurrente?', 'Are you sure you want to delete this standing order?'))) return;
        try {
            await api.delete(`/orders/scheduled/${id}`);
            setSubscriptions(prev => prev.filter(s => s.id !== id));
            setActionMessage({
                type: 'success',
                text: lbl('Pedido recurrente eliminado.', 'Standing order deleted.')
            });
            setTimeout(() => setActionMessage(null), 4000);
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.message || 'Error deleting subscription' });
            setTimeout(() => setActionMessage(null), 4000);
        }
    };

    const handleAddItem = () => {
        if (!selectedProductId) return;
        const prod = products.find(p => p.id === selectedProductId);
        if (!prod) return;

        const existingIndex = selectedItems.findIndex(i => i.productId === selectedProductId);
        if (existingIndex >= 0) {
            const updated = [...selectedItems];
            updated[existingIndex].quantity += selectedProductQty;
            setSelectedItems(updated);
        } else {
            setSelectedItems(prev => [
                ...prev,
                {
                    productId: prod.id,
                    productName: prod.name,
                    quantity: selectedProductQty,
                    price: Number(prod.price) || 0,
                }
            ]);
        }
        setSelectedProductId('');
        setSelectedProductQty(5);
    };

    const handleRemoveItem = (prodId: string) => {
        setSelectedItems(prev => prev.filter(i => i.productId !== prodId));
    };

    const toggleDay = (code: string) => {
        if (selectedDays.includes(code)) {
            if (selectedDays.length === 1) return; // Keep at least one day
            setSelectedDays(selectedDays.filter(d => d !== code));
        } else {
            setSelectedDays([...selectedDays, code]);
        }
    };

    const calculatedModalTotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleCreateSubscription = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0) {
            alert(lbl('Debes agregar al menos un producto a la suscripción.', 'You must add at least one item to the subscription.'));
            return;
        }

        setIsSubmitting(true);
        try {
            const newSub = await api.post('/orders/scheduled', {
                title: title || lbl('Suministro Semanal de Panadería', 'Weekly Bakery Supply'),
                items_json: JSON.stringify(selectedItems),
                delivery_days_json: JSON.stringify(selectedDays),
                delivery_time: deliveryTime,
                delivery_type: deliveryType,
                address_id: deliveryType === 'saved' ? addressId : null,
                payment_method: paymentMethod,
                total: calculatedModalTotal,
                active: true,
            }) as any;

            setSubscriptions(prev => [newSub, ...prev]);
            setIsCreatingModalOpen(false);
            // Reset form
            setTitle('');
            setSelectedItems([]);
            setActionMessage({
                type: 'success',
                text: lbl('¡Pedido recurrente programado con éxito!', 'Standing order scheduled successfully!')
            });
            setTimeout(() => setActionMessage(null), 4000);
        } catch (err: any) {
            setActionMessage({ type: 'error', text: err.message || 'Error creating standing order' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa]">
            <Navbar />

            <main className="max-w-6xl mx-auto px-4 py-12">
                {/* Back button & Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <Link 
                            href="/orders" 
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary mb-3 transition-colors"
                        >
                            <ArrowLeft size={14} />
                            {lbl('Volver a Pedidos', 'Back to Orders')}
                        </Link>
                        <h1 className="text-3xl sm:text-4xl font-black font-serif text-slate-900 flex items-center gap-3">
                            <RefreshCw className="text-amber-600" size={32} />
                            {lbl('Pedidos Recurrentes y Suscripciones B2B', 'Standing Orders & B2B Subscriptions')}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
                            {lbl(
                                'Abastecimiento mayorista automatizado para restaurantes, cafeterías y hoteles. Hornea y recibe pan fresco automáticamente los días que elijas.',
                                'Automated wholesale bakery replenishment for restaurants, cafes, and hotels. Baked fresh and delivered on your chosen schedule.'
                            )}
                        </p>
                    </div>

                    <button
                        onClick={() => setIsCreatingModalOpen(true)}
                        className="px-6 py-3.5 bg-slate-950 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                        <Plus size={16} />
                        {lbl('Nuevo Pedido Recurrente', 'New Standing Order')}
                    </button>
                </div>

                {/* Feedback Alert */}
                {actionMessage && (
                    <div className={`p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
                        actionMessage.type === 'success' 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{actionMessage.text}</span>
                    </div>
                )}

                {/* Subscriptions List */}
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center animate-pulse">
                        <Loader2 size={40} className="animate-spin text-slate-300 mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            {lbl('Cargando pedidos recurrentes...', 'Loading standing orders...')}
                        </p>
                    </div>
                ) : subscriptions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {subscriptions.map((sub) => {
                            let days: string[] = [];
                            try { days = JSON.parse(sub.delivery_days_json); } catch (_) { days = []; }
                            let items: any[] = [];
                            try { items = JSON.parse(sub.items_json); } catch (_) { items = []; }

                            return (
                                <div 
                                    key={sub.id} 
                                    className={`bg-white rounded-[28px] border-2 p-6 sm:p-8 shadow-sm transition-all flex flex-col justify-between ${
                                        sub.active ? 'border-slate-200 hover:border-slate-400 hover:shadow-md' : 'border-slate-100 opacity-75 bg-slate-50/50'
                                    }`}
                                >
                                    <div>
                                        {/* Status & Title */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                                                    ID: #{sub.id.slice(0, 12)}
                                                </span>
                                                <h3 className="text-xl font-black text-slate-900 leading-snug">
                                                    {sub.title}
                                                </h3>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0 ${
                                                sub.active 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>
                                                {sub.active ? lbl('Activo', 'Active') : lbl('Pausado', 'Paused')}
                                            </span>
                                        </div>

                                        {/* Days pills */}
                                        <div className="mb-4">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {lbl('Días de Entrega Programada:', 'Scheduled Delivery Days:')}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {DAY_OPTIONS.map((day) => {
                                                    const isSelected = days.some(d => d.toLowerCase().startsWith(day.code));
                                                    return (
                                                        <span
                                                            key={day.code}
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                                                                isSelected
                                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-400'
                                                            }`}
                                                        >
                                                            {locale === 'en' ? day.labelEn : day.labelEs}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl text-xs text-slate-600 mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-slate-400 shrink-0" />
                                                <span>{sub.delivery_time || '08:00 AM'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {sub.delivery_type === 'pickup' ? (
                                                    <>
                                                        <Store size={14} className="text-slate-400 shrink-0" />
                                                        <span>{lbl('Pick Up en Panadería', 'Store Pick Up')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Truck size={14} className="text-slate-400 shrink-0" />
                                                        <span>{lbl('Entrega en Dirección', 'Direct Delivery')}</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <CreditCard size={14} className="text-slate-400 shrink-0" />
                                                <span className="capitalize">{sub.payment_method === 'credit' ? lbl('Línea de Crédito', 'Credit Line') : 'Stripe 1-Click'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <RefreshCw size={14} className="text-slate-400 shrink-0" />
                                                <span>{sub.last_run ? `${lbl('Última', 'Last')}: ${new Date(sub.last_run).toLocaleDateString()}` : lbl('Sin despachos aún', 'Pending first run')}</span>
                                            </div>
                                        </div>

                                        {/* Items list preview */}
                                        <div className="mb-4">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                                                <Package size={12} />
                                                {lbl('Productos en cada despacho:', 'Items per delivery:')}
                                            </p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                {items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                                                        <span className="font-semibold text-slate-700">
                                                            {item.quantity}x {item.productName || item.name || `Producto #${idx+1}`}
                                                        </span>
                                                        <span className="font-mono text-slate-500 font-bold">
                                                            ${((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer / Total & Actions */}
                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                                {lbl('Total Estimado / Entrega', 'Est. Total / Delivery')}
                                            </span>
                                            <p className="text-2xl font-black text-slate-900">
                                                ${(Number(sub.total) || 0).toFixed(2)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(sub.id, sub.active)}
                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                    sub.active
                                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                }`}
                                            >
                                                {sub.active ? <Pause size={14} /> : <Play size={14} />}
                                                <span>{sub.active ? lbl('Pausar', 'Pause') : lbl('Reanudar', 'Resume')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(sub.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                title={lbl('Eliminar pedido recurrente', 'Delete standing order')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-8 max-w-xl mx-auto space-y-4">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-700 rounded-3xl flex items-center justify-center mx-auto">
                            <RefreshCw size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">
                            {lbl('No tienes pedidos recurrentes activos', 'No active standing orders')}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                            {lbl(
                                'Programa los pedidos de tu negocio una sola vez y recíbelos frescos los días que necesites sin tener que hacer checkout cada vez.',
                                'Schedule your wholesale orders once and receive fresh deliveries automatically on the days your business requires.'
                            )}
                        </p>
                        <button
                            onClick={() => setIsCreatingModalOpen(true)}
                            className="px-6 py-3.5 bg-slate-950 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg transition-all"
                        >
                            {lbl('Crear mi Primer Pedido Recurrente', 'Create My First Standing Order')}
                        </button>
                    </div>
                )}
            </main>

            {/* CREATE STANDING ORDER MODAL */}
            {isCreatingModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCreatingModalOpen(false)} />
                    <div className="relative bg-white rounded-[32px] p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 space-y-6">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <RefreshCw size={20} className="text-amber-600" />
                                    {lbl('Configurar Pedido Recurrente Mayorista', 'Set Up Wholesale Standing Order')}
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {lbl('Abastecimiento periódico automático', 'Automated recurring wholesale supply')}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsCreatingModalOpen(false)}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubscription} className="space-y-6">
                            {/* Title */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    {lbl('Nombre o Identificador del Pedido', 'Order Name / Identifier')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={lbl('ej. Surtido Semanal Restaurante', 'e.g. Weekly Restaurant Supply')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                                />
                            </div>

                            {/* Delivery Days Selector */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    {lbl('Días de Despacho Semanal:', 'Weekly Dispatch Days:')}
                                </label>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {DAY_OPTIONS.map((day) => {
                                        const isSelected = selectedDays.includes(day.code);
                                        return (
                                            <button
                                                key={day.code}
                                                type="button"
                                                onClick={() => toggleDay(day.code)}
                                                className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 ${
                                                    isSelected
                                                        ? 'bg-slate-950 text-white shadow-md'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                <span>{locale === 'en' ? day.labelEn : day.labelEs}</span>
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Delivery details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        {lbl('Hora de Entrega', 'Delivery Time')}
                                    </label>
                                    <select
                                        value={deliveryTime}
                                        onChange={(e) => setDeliveryTime(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-semibold text-xs bg-white"
                                    >
                                        <option value="06:00">06:00 AM (Apertura)</option>
                                        <option value="07:00">07:00 AM</option>
                                        <option value="08:00">08:00 AM</option>
                                        <option value="10:00">10:00 AM</option>
                                        <option value="14:00">02:00 PM</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        {lbl('Tipo de Entrega', 'Delivery Type')}
                                    </label>
                                    <select
                                        value={deliveryType}
                                        onChange={(e) => setDeliveryType(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-semibold text-xs bg-white"
                                    >
                                        <option value="saved">{lbl('Dirección Guardada', 'Saved Address')}</option>
                                        <option value="pickup">{lbl('Pick Up en Panadería', 'Store Pick Up')}</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        {lbl('Método de Cobro', 'Billing Method')}
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 font-semibold text-xs bg-white"
                                    >
                                        <option value="credit">{lbl('Línea de Crédito B2B', 'B2B Credit Line')}</option>
                                        <option value="stripe">{lbl('Stripe 1-Click / Tarjeta', 'Stripe 1-Click / Card')}</option>
                                        <option value="ach">{lbl('ACH Direct Debit', 'ACH Direct Debit')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Add Products to recurring order */}
                            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                                    {lbl('Agregar Productos al Pedido Recurrente:', 'Add Products to Standing Order:')}
                                </label>
                                
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        className="flex-[3] px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                                    >
                                        <option value="">{lbl('Selecciona un producto...', 'Select a product...')}</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} — ${(Number(p.price) || 0).toFixed(2)}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min="1"
                                        value={selectedProductQty}
                                        onChange={(e) => setSelectedProductQty(parseInt(e.target.value, 10) || 1)}
                                        className="w-20 px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-center bg-white"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        disabled={!selectedProductId}
                                        className="px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-600 transition-colors disabled:opacity-50"
                                    >
                                        {lbl('Agregar', 'Add')}
                                    </button>
                                </div>

                                {/* Items list */}
                                {selectedItems.length > 0 ? (
                                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/80">
                                        {selectedItems.map((item) => (
                                            <div key={item.productId} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
                                                <div>
                                                    <span className="font-bold text-slate-900">{item.quantity}x {item.productName}</span>
                                                    <span className="text-slate-400 ml-2">(${(item.price * item.quantity).toFixed(2)})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.productId)}
                                                    className="text-slate-400 hover:text-red-600 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-400 text-center py-2 italic">
                                        {lbl('Agrega los productos que se hornearán en cada entrega recurrente.', 'Add items to be baked on each recurring delivery.')}
                                    </p>
                                )}
                            </div>

                            {/* Total preview and submit */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        {lbl('Total por cada despacho:', 'Total per dispatch:')}
                                    </p>
                                    <p className="text-2xl font-black text-slate-900">
                                        ${calculatedModalTotal.toFixed(2)}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreatingModalOpen(false)}
                                        className="px-5 py-3 text-xs font-black uppercase rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        {lbl('Cancelar', 'Cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || selectedItems.length === 0}
                                        className="px-6 py-3 bg-slate-950 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        {lbl('Guardar Pedido Recurrente', 'Save Standing Order')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
