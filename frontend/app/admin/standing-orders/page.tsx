'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { 
    Calendar, 
    RefreshCw, 
    Zap, 
    Clock, 
    Package, 
    Store, 
    Truck, 
    CreditCard, 
    CheckCircle2, 
    AlertCircle, 
    Pause, 
    Play, 
    Trash2, 
    Loader2, 
    CalendarDays, 
    Users,
    ChevronRight,
    TrendingUp
} from 'lucide-react';
import { api } from '@/lib/api';

const DAY_CODES: Record<string, string> = {
    mon: 'Lunes',
    tue: 'Martes',
    wed: 'Miércoles',
    thu: 'Jueves',
    fri: 'Viernes',
    sat: 'Sábado',
    sun: 'Domingo',
};

export default function AdminStandingOrdersPage() {
    const [activeTab, setActiveTab] = useState<'calendar' | 'subscriptions'>('calendar');
    const [projections, setProjections] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunningCron, setIsRunningCron] = useState(false);
    const [cronResult, setCronResult] = useState<any | null>(null);
    const [actionMsg, setActionMsg] = useState<{ type: string; text: string } | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [projData, subsData] = await Promise.all([
                api.get('/orders/scheduled/projections?days=7') as Promise<any[]>,
                api.get('/orders/scheduled') as Promise<any[]>,
            ]);
            setProjections(Array.isArray(projData) ? projData : []);
            setSubscriptions(Array.isArray(subsData) ? subsData : []);
        } catch (err) {
            console.error('Error loading standing orders data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRunCron = async () => {
        setIsRunningCron(true);
        setCronResult(null);
        try {
            const res = await api.post('/orders/scheduled/run-now', {}) as any;
            setCronResult(res);
            setActionMsg({
                type: 'success',
                text: `Cron ejecutado: ${res.processed} pedidos generados automáticamente.`
            });
            await loadData();
            setTimeout(() => setActionMsg(null), 6000);
        } catch (err: any) {
            setActionMsg({
                type: 'error',
                text: err.message || 'Error al ejecutar cron'
            });
        } finally {
            setIsRunningCron(false);
        }
    };

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        try {
            await api.patch(`/orders/scheduled/${id}`, { active: !currentActive });
            setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active: !currentActive } : s));
            await loadData();
        } catch (err: any) {
            alert(err.message || 'Error toggling subscription');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta suscripción de la base de datos?')) return;
        try {
            await api.delete(`/orders/scheduled/${id}`);
            setSubscriptions(prev => prev.filter(s => s.id !== id));
            await loadData();
        } catch (err: any) {
            alert(err.message || 'Error deleting subscription');
        }
    };

    const totalActive = subscriptions.filter(s => s.active).length;
    const weeklyRevenueForecast = projections.reduce((sum, p) => sum + (Number(p.estimatedRevenue) || 0), 0);

    return (
        <div className="flex min-h-screen bg-muted/30 font-sans">
            <AdminSidebar />

            <main className="flex-1 p-8 overflow-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <CalendarDays className="text-amber-600" size={32} />
                            Proyección de Horneados y Standing Orders
                        </h1>
                        <p className="text-muted-foreground font-medium mt-1">
                            Planificación de producción mayorista recurrente y despacho automático B2B
                        </p>
                    </div>

                    <button
                        onClick={handleRunCron}
                        disabled={isRunningCron}
                        className="px-5 py-3.5 bg-slate-900 hover:bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                    >
                        {isRunningCron ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="text-amber-400 fill-amber-400" />}
                        <span>{isRunningCron ? 'Ejecutando Cron...' : '⚡ Forzar Despacho Cron Hoy'}</span>
                    </button>
                </header>

                {/* Notifications & Result */}
                {actionMsg && (
                    <div className={`p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
                        actionMsg.type === 'success' 
                            ? 'bg-green-50 text-green-700 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{actionMsg.text}</span>
                    </div>
                )}

                {cronResult && (
                    <div 
                        data-testid="cron-execution-report"
                        className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm mb-8 space-y-4 animate-in fade-in duration-300"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                                    <Zap size={18} className="text-amber-400 fill-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                        Reporte de Ejecución de Cron Nocturno (Aislamiento de Lote)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Procesamiento batch con resiliencia ante fallos financieros y control de catálogo
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-black">
                                    {cronResult.processed || 0} Exitosos
                                </span>
                                {cronResult.errors && cronResult.errors.length > 0 && (
                                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-black">
                                        {cronResult.errors.length} Aislados / Fallidos
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Successful list */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    Órdenes Generadas ({cronResult.generatedOrders?.length || 0})
                                </p>
                                {cronResult.generatedOrders && cronResult.generatedOrders.length > 0 ? (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                        {cronResult.generatedOrders.map((o: any) => (
                                            <div key={o.orderId} className="flex justify-between items-center text-xs p-2 bg-white rounded-xl border border-slate-100">
                                                <span className="font-bold text-slate-700">#{o.orderId.slice(0, 8)} • {o.userEmail}</span>
                                                <span className="font-mono font-black text-green-600">${Number(o.total).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No hubo pedidos exitosos en este ciclo.</p>
                                )}
                            </div>

                            {/* Isolated errors / declines */}
                            <div className="bg-red-50/50 p-4 rounded-2xl border border-red-200/60 space-y-2">
                                <p className="text-[10px] font-black uppercase text-red-600 tracking-wider flex items-center gap-1">
                                    <AlertCircle size={12} /> Excepciones Aisladas ({cronResult.errors?.length || 0})
                                </p>
                                {cronResult.errors && cronResult.errors.length > 0 ? (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                        {cronResult.errors.map((err: any, i: number) => (
                                            <div key={i} className="text-xs p-2.5 bg-white rounded-xl border border-red-200 space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-red-700">Suscripción: {err.scheduledId.slice(0, 10)}...</span>
                                                    {err.payment_status && (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md font-mono text-[10px] font-black">
                                                            {err.payment_status}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-600">{err.error}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">Cero errores. Todos los cobros se ejecutaron limpios.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                            <RefreshCw size={26} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Suscripciones Activas</p>
                            <p className="text-2xl font-black text-slate-900">{totalActive} <span className="text-xs font-semibold text-slate-400">/ {subscriptions.length} totales</span></p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center shrink-0">
                            <TrendingUp size={26} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Facturación Semanal Proyectada</p>
                            <p className="text-2xl font-black text-slate-900">${weeklyRevenueForecast.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                            <Package size={26} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Ventana de Horneado</p>
                            <p className="text-2xl font-black text-slate-900">05:00 AM <span className="text-xs font-semibold text-emerald-600">Diario</span></p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-border pb-4">
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'calendar'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-border'
                        }`}
                    >
                        <Calendar size={14} />
                        <span>Calendario de Proyección (7 Días)</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('subscriptions')}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'subscriptions'
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-border'
                        }`}
                    >
                        <Users size={14} />
                        <span>Lista Global de Suscripciones ({subscriptions.length})</span>
                    </button>
                </div>

                {/* TAB 1: CALENDAR PROJECTIONS */}
                {activeTab === 'calendar' && (
                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                                <Loader2 size={40} className="animate-spin text-slate-300 mb-3" />
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando proyecciones de horneado...</p>
                            </div>
                        ) : projections.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {projections.map((proj, idx) => {
                                    const isToday = idx === 0;
                                    return (
                                        <div 
                                            key={proj.date}
                                            className={`bg-white rounded-3xl border-2 p-6 flex flex-col justify-between shadow-sm transition-all ${
                                                isToday ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-border hover:border-slate-300'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                            {proj.date}
                                                        </span>
                                                        <h3 className="text-lg font-black text-slate-900">
                                                            {proj.dayName}
                                                        </h3>
                                                    </div>
                                                    {isToday && (
                                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                            Hoy
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Stats */}
                                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl mb-4 text-xs">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Pedidos</span>
                                                        <p className="font-black text-slate-900">{proj.orderCount}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Proyectado</span>
                                                        <p className="font-black text-slate-900">${proj.estimatedRevenue.toFixed(2)}</p>
                                                    </div>
                                                </div>

                                                {/* Production List */}
                                                <div className="space-y-2 mb-4">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                        <Package size={12} />
                                                        Horneado Necesario:
                                                    </p>
                                                    {proj.productionList.length > 0 ? (
                                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                            {proj.productionList.map((prod: any) => (
                                                                <div key={prod.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                                                                    <span className="font-semibold text-slate-700 truncate pr-2">{prod.name}</span>
                                                                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded-lg font-mono font-black text-[11px] shrink-0">
                                                                        {prod.quantity} u
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-slate-400 italic py-2">Sin pedidos recurrentes programados para este día.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Subscriptions list footer */}
                                            {proj.standingOrders.length > 0 && (
                                                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                                                    <span className="font-bold text-slate-700">Clientes ({proj.standingOrders.length}): </span>
                                                    <span className="truncate block mt-0.5">
                                                        {proj.standingOrders.map((s: any) => s.clientName).join(', ')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-slate-400 py-12">No hay proyecciones de horneado disponibles.</p>
                        )}
                    </div>
                )}

                {/* TAB 2: GLOBAL SUBSCRIPTIONS LIST */}
                {activeTab === 'subscriptions' && (
                    <div className="bg-white rounded-3xl border border-border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-border text-slate-500 font-black uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="py-4 px-6">Cliente / Título</th>
                                        <th className="py-4 px-6">Días de Entrega</th>
                                        <th className="py-4 px-6">Hora & Tipo</th>
                                        <th className="py-4 px-6">Cobro</th>
                                        <th className="py-4 px-6">Total / Despacho</th>
                                        <th className="py-4 px-6">Estado</th>
                                        <th className="py-4 px-6 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {subscriptions.map((sub) => {
                                        let days: string[] = [];
                                        try { days = JSON.parse(sub.delivery_days_json); } catch (_) { days = []; }

                                        return (
                                            <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-slate-900 text-sm">{sub.title}</div>
                                                    <div className="text-[11px] text-muted-foreground">{sub.user?.email || sub.user_id}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-wrap gap-1">
                                                        {days.map(d => (
                                                            <span key={d} className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-700">
                                                                {DAY_CODES[d.toLowerCase()] || d}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-slate-600">
                                                    <div className="flex items-center gap-1 font-semibold">
                                                        <Clock size={13} className="text-slate-400" />
                                                        <span>{sub.delivery_time}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">
                                                        {sub.delivery_type === 'pickup' ? 'Pick Up' : 'Entrega'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        sub.payment_method === 'credit'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        {sub.payment_method === 'credit' ? 'Crédito B2B' : '1-Click Stripe'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 font-black text-slate-900 text-sm">
                                                    ${(Number(sub.total) || 0).toFixed(2)}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        sub.active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {sub.active ? 'Activa' : 'Pausada'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleToggleActive(sub.id, sub.active)}
                                                            className={`p-2 rounded-xl transition-colors ${
                                                                sub.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                            title={sub.active ? 'Pausar' : 'Reanudar'}
                                                        >
                                                            {sub.active ? <Pause size={16} /> : <Play size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(sub.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
