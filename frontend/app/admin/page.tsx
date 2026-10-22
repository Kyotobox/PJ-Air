'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    ShoppingBag, Layers, Users, TrendingUp, ArrowRight, Loader2, 
    FileText, Calendar, ChevronRight, DollarSign, CreditCard, 
    Clock, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { API_URL } from '@/lib/config';

export default function AdminDashboardPage() {
    const { t, locale } = useLanguage();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [cutoffHour, setCutoffHour] = useState<number>(12);
    const [nyTime, setNyTime] = useState<string>('');
    const [isPastCutoff, setIsPastCutoff] = useState<boolean>(false);

    // Data states
    const [products, setProducts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [historyOrders, setHistoryOrders] = useState<any[]>([]);

    useEffect(() => {
        // NY Time and Cutoff check
        const updateNyClock = () => {
            const now = new Date();
            const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const hours = nyDate.getHours();
            const minutes = String(nyDate.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            setNyTime(`${displayHours}:${minutes} ${ampm} (EST)`);
            setIsPastCutoff(hours >= cutoffHour);
        };

        updateNyClock();
        const interval = setInterval(updateNyClock, 30000);
        return () => clearInterval(interval);
    }, [cutoffHour]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                // Fetch cutoff config
                api.get('/configs/cutoff_hour')
                    .then((res: any) => {
                        if (res && res.value) setCutoffHour(Number(res.value) || 12);
                    })
                    .catch(() => {});

                // Fetch core dashboard data
                const [prods, usrs, ords] = await Promise.all([
                    api.get('/products') as Promise<any[]>,
                    api.get('/users') as Promise<any[]>,
                    api.get('/orders') as Promise<any[]>,
                ]);

                setProducts(Array.isArray(prods) ? prods : []);
                setUsers(Array.isArray(usrs) ? usrs : []);
                setOrders(Array.isArray(ords) ? ords : []);

                // Fetch history for production tower
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 10);
                const endStr = end.toISOString().split('T')[0] + ' 23:59:59';
                const startStr = start.toISOString().split('T')[0] + ' 00:00:00';
                const historyRes = await fetch(`${API_URL}/orders/reports/range?startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(endStr)}`);
                if (historyRes.ok) {
                    const histData = await historyRes.json();
                    setHistoryOrders(Array.isArray(histData) ? histData : []);
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // ── Financial KPIs Calculation ──────────────────────────────────────────
    const financialMetrics = useMemo(() => {
        let totalRevenue = 0;
        let totalPaid = 0;
        let totalPendingCredit = 0;
        let todayRevenue = 0;

        const todayNY = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
            .toISOString().split('T')[0];

        orders.forEach(order => {
            if (order.status === 'cancelled' || order.status === 'Cancelado') return;
            const amount = Number(order.total) || 0;
            totalRevenue += amount;

            if (order.payment_status === 'paid') {
                totalPaid += amount;
            } else {
                totalPendingCredit += amount;
            }

            const orderDate = (order.created_at || '').split('T')[0];
            if (orderDate === todayNY) {
                todayRevenue += amount;
            }
        });

        const creditClients = users.filter(u => u.account_type === 'credit').length;
        const cashClients = users.filter(u => u.account_type !== 'credit').length;

        return {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalPendingCredit: Math.round(totalPendingCredit * 100) / 100,
            todayRevenue: Math.round(todayRevenue * 100) / 100,
            creditClients,
            cashClients,
        };
    }, [orders, users]);

    // ── Production Tower Breakdown ──────────────────────────────────────────
    const productionSummary = useMemo(() => {
        let totalUnitsToBake = 0;
        const categoryCounts: Record<string, number> = {};

        // Active orders that are pending or in production
        const activeOrders = orders.filter(
            o => o.status !== 'cancelled' && o.status !== 'Cancelado' && o.status !== 'Entregado' && o.status !== 'Pedido Recibido'
        );

        activeOrders.forEach(order => {
            (order.items || []).forEach((item: any) => {
                const qty = Number(item.quantity) || 0;
                totalUnitsToBake += qty;
                const catName = item.product?.category?.name || 'Panadería General';
                categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;
            });
        });

        const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

        return {
            activeOrdersCount: activeOrders.length,
            totalUnitsToBake,
            categories: sortedCategories,
        };
    }, [orders]);

    // ── Credit Alerts Feed ──────────────────────────────────────────────────
    const creditAlerts = useMemo(() => {
        const alerts: { user: any; usedCredit: number; creditLimit: number; isOverdraft: boolean }[] = [];

        users.forEach(u => {
            if (u.account_type === 'credit') {
                const unpaid = orders
                    .filter(o => o.user_id === u.id && o.payment_status !== 'paid' && o.status !== 'cancelled')
                    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
                const limit = Number(u.credit_limit || 0);

                if (unpaid > limit) {
                    alerts.push({
                        user: u,
                        usedCredit: unpaid,
                        creditLimit: limit,
                        isOverdraft: true,
                    });
                }
            }
        });

        return alerts;
    }, [users, orders]);

    const lbl = (es: string, en: string) => locale === 'en' ? en : es;

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-auto space-y-8 max-w-7xl">
                
                {/* ── Operational Control Tower Header ────────────────────── */}
                <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-amber-400 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <Sparkles size={12} />
                                    {lbl('Torre Ejecutiva Wholesale', 'Executive Wholesale Tower')}
                                </span>
                                <span className="text-slate-400 text-xs font-semibold">
                                    {nyTime || 'Cargando reloj NY...'}
                                </span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white">
                                {t.admin.dashboardTitle}
                            </h1>
                            <p className="text-slate-300 text-sm font-medium mt-1">
                                {t.admin.dashboardSubtitle}
                            </p>
                        </div>

                        {/* Cutoff Status Badge */}
                        <div className={`p-5 rounded-2xl border flex items-center gap-4 transition-all shadow-lg ${
                            isPastCutoff
                                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                : 'bg-green-500/10 border-green-500/30 text-green-200'
                        }`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                                isPastCutoff ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                            }`}>
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                    {lbl(`Hora Límite de Corte: ${cutoffHour}:00 PM`, `Order Cutoff Time: ${cutoffHour}:00 PM`)}
                                </p>
                                <p className="text-base font-black">
                                    {isPastCutoff
                                        ? lbl('🔴 Corte Alcanzado (+1 Día Lead Time)', '🔴 Cutoff Reached (+1 Day Lead Time)')
                                        : lbl('🟢 Lote Abierto para Recepción', '🟢 Batch Open for Orders')}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── Quadrant 1: Financial KPIs ──────────────────────────── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            {lbl('Cuadrante Financiero y Cartera B2B', 'Financial & B2B Credit Quadrant')}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Ventas Hoy */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                                <DollarSign size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {lbl('Facturación Hoy', 'Today Revenue')}
                            </p>
                            <p className="text-3xl font-black text-slate-900">
                                ${financialMetrics.todayRevenue.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {lbl('Ingresos generados en la fecha actual', 'Revenue generated today')}
                            </p>
                        </div>

                        {/* Cartera de Crédito Pendiente */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
                                <CreditCard size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {lbl('Cartera Crédito B2B', 'Pending B2B Balance')}
                            </p>
                            <p className="text-3xl font-black text-blue-600">
                                ${financialMetrics.totalPendingCredit.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {lbl(`${financialMetrics.creditClients} clientes a crédito activo`, `${financialMetrics.creditClients} active credit clients`)}
                            </p>
                        </div>

                        {/* Cobrado / Liquidado */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-600 flex items-center justify-center mb-4">
                                <CheckCircle2 size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {lbl('Cobrado con Stripe', 'Collected via Stripe')}
                            </p>
                            <p className="text-3xl font-black text-green-600">
                                ${financialMetrics.totalPaid.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {lbl('Pagos liquidados con tarjeta/banco', 'Settled payments via card/bank')}
                            </p>
                        </div>

                        {/* Facturación Acumulada */}
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-4">
                                <TrendingUp size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                {lbl('Ventas Totales', 'Total Sales Volume')}
                            </p>
                            <p className="text-3xl font-black text-slate-900">
                                ${financialMetrics.totalRevenue.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                {lbl(`${orders.length} pedidos históricos registrados`, `${orders.length} recorded orders`)}
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── Quadrant 2 & 3: Production Tower & Credit Alerts ───── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Cuadrante 2: Torre Operativa de Horneo (7 cols) */}
                    <section className="lg:col-span-7 bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <ShoppingBag size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-slate-900">
                                        {lbl('Torre Operativa de Producción', 'Production Operating Tower')}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {lbl('Unidades requeridas para los pedidos en curso', 'Required units for active baking batches')}
                                    </p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/reports" 
                                className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                            >
                                {lbl('Ver Lotes ↗', 'View Batches ↗')}
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    {lbl('Pedidos en Proceso', 'Active Orders')}
                                </p>
                                <p className="text-2xl font-black text-slate-800">
                                    {productionSummary.activeOrdersCount}
                                </p>
                            </div>
                            <div className="p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                                    {lbl('Total Unidades a Hornear', 'Total Baking Units')}
                                </p>
                                <p className="text-2xl font-black text-amber-900">
                                    {productionSummary.totalUnitsToBake.toLocaleString()} <span className="text-xs font-bold">uds</span>
                                </p>
                            </div>
                        </div>

                        {/* Categories breakdown */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {lbl('Distribución por Familia Artesanal', 'Breakdown by Product Family')}
                            </p>
                            <div className="space-y-2">
                                {productionSummary.categories.slice(0, 5).map(([cat, qty]) => {
                                    const percent = productionSummary.totalUnitsToBake > 0 
                                        ? Math.round((qty / productionSummary.totalUnitsToBake) * 100) 
                                        : 0;
                                    return (
                                        <div key={cat} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                                <span>{cat}</span>
                                                <span>{qty.toLocaleString()} uds ({percent}%)</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* Cuadrante 3: Feed de Alertas de Crédito en Vivo (5 cols) */}
                    <section className="lg:col-span-5 bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                                    <ShieldAlert size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-slate-900">
                                        {lbl('Alertas de Sobregiro B2B', 'B2B Overdraft Alerts')}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {lbl('Límites excedidos que requieren revisión', 'Exceeded limits needing review')}
                                    </p>
                                </div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                creditAlerts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                                {creditAlerts.length} {lbl('activas', 'active')}
                            </span>
                        </div>

                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                            {creditAlerts.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <CheckCircle2 size={32} className="mx-auto text-green-500 mb-2" />
                                    <p className="text-xs font-bold text-slate-700">
                                        {lbl('Cartera 100% al día', 'All client credit lines healthy')}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {lbl('Ningún cliente de crédito excede su cupo asignado.', 'No client currently exceeds their authorized limit.')}
                                    </p>
                                </div>
                            ) : (
                                creditAlerts.map(alert => (
                                    <div 
                                        key={alert.user.id} 
                                        className="p-4 bg-red-50/70 border border-red-200 rounded-2xl flex items-center justify-between gap-3"
                                    >
                                        <div>
                                            <p className="text-xs font-black text-slate-900">
                                                {alert.user.profile?.full_name || alert.user.email}
                                            </p>
                                            <p className="text-[11px] text-red-700 font-bold mt-0.5">
                                                {lbl(
                                                    `Sobregirado: $${alert.usedCredit.toFixed(2)} (Límite: $${alert.creditLimit.toFixed(2)})`,
                                                    `Overdraft: $${alert.usedCredit.toFixed(2)} (Limit: $${alert.creditLimit.toFixed(2)})`
                                                )}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => router.push('/admin/clients')}
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                                        >
                                            {lbl('Gestionar', 'Manage')}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* ── Quadrant 4: Quick Access & Operational Links ───────── */}
                <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-900">
                                    {lbl('Accesos Rápidos de Administración', 'Administrative Fast Navigation')}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium">
                                    {lbl('Gestión centralizada de catálogo, clientes y parámetros', 'Central management for catalog, clients and settings')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: lbl('Gestión de Clientes y Crédito', 'Clients & Credit Management'), href: '/admin/clients', icon: Users, color: 'hover:border-blue-400 hover:bg-blue-50/20' },
                            { label: lbl('Torre y Reportes de Producción', 'Production Reports & Batches'), href: '/admin/reports', icon: FileText, color: 'hover:border-amber-400 hover:bg-amber-50/20' },
                            { label: lbl('Catálogo de Productos', 'Wholesale Product Catalog'), href: '/admin/products', icon: ShoppingBag, color: 'hover:border-green-400 hover:bg-green-50/20' },
                            { label: lbl('Configuración y Reglas de Corte', 'Logistics & Cutoff Rules'), href: '/admin/settings', icon: Clock, color: 'hover:border-purple-400 hover:bg-purple-50/20' },
                        ].map(item => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`p-5 rounded-2xl border border-slate-200 transition-all flex items-center justify-between group ${item.color}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:scale-105 transition-transform">
                                            <Icon size={18} />
                                        </div>
                                        <span className="font-black text-xs text-slate-800">{item.label}</span>
                                    </div>
                                    <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </main>
        </div>
    );
}
