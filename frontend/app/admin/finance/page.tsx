'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { api } from '@/lib/api';
import { Tag, CreditCard, Shield, RefreshCw, Search, Calendar, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface StoreCreditIncident {
    id: string;
    order_id: string;
    user_id: string;
    voucher_code: string;
    credit_amount: number;
    status: string;
    notes?: string;
    created_at: string;
    order?: {
        id: string;
        delivery_date?: string;
        user?: {
            id: string;
            email: string;
            profile?: {
                full_name?: string;
                business_name?: string;
            };
        };
    };
}

export default function AdminFinancePage() {
    const [incidents, setIncidents] = useState<StoreCreditIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const fetchFinanceData = async () => {
        try {
            setLoading(true);
            const data = await api.get('/orders/delivery-incidents/all') as any[];
            setIncidents(Array.isArray(data) ? data : []);
        } catch (e: any) {
            console.error('Error fetching store credit ledger:', e);
            // Fallback gracefully if endpoint is empty
            setIncidents([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinanceData();
    }, []);

    const filtered = incidents.filter(i => {
        const query = search.toLowerCase();
        const code = (i.voucher_code || '').toLowerCase();
        const clientName = (i.order?.user?.profile?.business_name || i.order?.user?.profile?.full_name || i.order?.user?.email || '').toLowerCase();
        return code.includes(query) || clientName.includes(query) || (i.status || '').toLowerCase().includes(query);
    });

    const totalIssued = incidents.reduce((sum, i) => sum + (Number(i.credit_amount) || 0), 0);
    const totalApproved = incidents.filter(i => i.status === 'APPROVED').reduce((sum, i) => sum + (Number(i.credit_amount) || 0), 0);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                                <Tag size={22} />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                🏷️ Libro de Store Credit y Conciliación Financiera
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Auditoría contable de incidencias de entrega, saldos a favor (SC-YYYY-XXXX) y compensaciones comerciales.
                        </p>
                    </div>

                    <button
                        onClick={fetchFinanceData}
                        disabled={loading}
                        className="self-start md:self-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualizar Libro
                    </button>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Vouchers Emitidos</span>
                            <FileText size={18} className="text-slate-400" />
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{incidents.length}</p>
                        <p className="text-xs text-slate-500 mt-1">Registros históricos de compensación</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monto Bruto Emitido</span>
                            <CreditCard size={18} className="text-amber-500" />
                        </div>
                        <p className="text-2xl font-black text-amber-600 mt-2">${totalIssued.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-1">Compensaciones no fiscales solicitadas</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Acreditado Efectivo</span>
                            <Shield size={18} className="text-emerald-500" />
                        </div>
                        <p className="text-2xl font-black text-emerald-600 mt-2">${totalApproved.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-1">Acreditado al balance de cuentas B2B</p>
                    </div>
                </div>

                {/* Filter and Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar voucher SC-*, cliente o estado..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Voucher</th>
                                    <th className="px-6 py-4">Cliente B2B</th>
                                    <th className="px-6 py-4">Orden Relacionada</th>
                                    <th className="px-6 py-4 text-right">Monto</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4">Fecha Emisión</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                            Cargando libro contable...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                            No se encontraron vouchers de Store Credit registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map(i => (
                                        <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-black text-amber-600">
                                                {i.voucher_code || 'SC-PENDING'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {i.order?.user?.profile?.business_name || i.order?.user?.profile?.full_name || i.order?.user?.email || 'Cliente B2B'}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-500">
                                                {i.order_id ? `#${i.order_id.slice(-6).toUpperCase()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600">
                                                +${(Number(i.credit_amount) || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    i.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                    i.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {i.status || 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {i.created_at ? new Date(i.created_at).toLocaleDateString() : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
