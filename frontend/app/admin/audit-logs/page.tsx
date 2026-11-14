'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    ShieldCheck, Search, Loader2, AlertCircle, RefreshCw,
    Filter, Eye, X, User, Calendar, FileText, ArrowRight, Activity, Globe
} from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

interface AuditLogItem {
    id: string;
    admin_id: string;
    admin_name: string;
    action: string;
    target_entity: string;
    target_id: string;
    previous_state_json?: string | null;
    new_state_json?: string | null;
    notes?: string | null;
    ip_address?: string | null;
    actor_role?: string;
    created_at: string;
}

interface AuditLogResponse {
    logs: AuditLogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export default function AdminAuditLogsPage() {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(20);

    const [actionFilter, setActionFilter] = useState('');
    const [actorRoleFilter, setActorRoleFilter] = useState('');
    const [targetEntityFilter, setTargetEntityFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', String(limit));
            if (actionFilter) params.set('action', actionFilter);
            if (actorRoleFilter) params.set('actor_role', actorRoleFilter);
            if (targetEntityFilter) params.set('target_entity', targetEntityFilter);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);

            const queryString = params.toString();
            const endpoint = `/api/admin-actions/audit-logs${queryString ? `?${queryString}` : ''}`;
            const res = (await api.get(endpoint)) as AuditLogResponse;

            if (res && Array.isArray(res.logs)) {
                setLogs(res.logs);
                setTotal(res.total || 0);
                setTotalPages(res.totalPages || 1);
            } else {
                setLogs([]);
                setTotal(0);
                setTotalPages(1);
            }
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, actionFilter, actorRoleFilter, targetEntityFilter, startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = logs.filter(log => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            log.admin_name?.toLowerCase().includes(q) ||
            log.action?.toLowerCase().includes(q) ||
            log.target_entity?.toLowerCase().includes(q) ||
            log.target_id?.toLowerCase().includes(q) ||
            log.notes?.toLowerCase().includes(q)
        );
    });

    const getActionBadgeClass = (action: string) => {
        switch (action) {
            case 'FEE_OVERRIDE':
                return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800';
            case 'DISCOUNT_CHANGE':
                return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';
            case 'CLIENT_RATE_UPDATE':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
            case 'ORDER_EDIT':
                return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800';
            case 'PASSWORD_RESET':
                return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
            default:
                return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        }
    };

    const formatJsonPretty = (jsonStr?: string | null) => {
        if (!jsonStr) return isEn ? 'No previous record' : 'Sin registro previo';
        try {
            const parsed = JSON.parse(jsonStr);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return jsonStr;
        }
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            <AdminSidebar />

            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="p-6 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    {isEn ? 'Admin Audit Trail' : 'Bitácora Forense de Auditoría'}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {isEn
                                        ? 'Immutable event ledger for administrative actions, fee overrides, and rate updates'
                                        : 'Registro inmutable de acciones administrativas, modificación de fletes, descuentos y tarifas'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchLogs()}
                                disabled={isLoading}
                                className="px-3.5 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                {isEn ? 'Refresh' : 'Actualizar'}
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                        <div className="p-4 rounded-xl border border-border bg-card">
                            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                                <span>{isEn ? 'Total Events' : 'Total de Eventos'}</span>
                                <Activity className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-2xl font-bold">{total}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-card">
                            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                                <span>{isEn ? 'Active Page' : 'Página Activa'}</span>
                                <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-2xl font-bold">{page} / {totalPages}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-card">
                            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                                <span>{isEn ? 'Records Loaded' : 'Registros Mostrados'}</span>
                                <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="text-2xl font-bold">{filteredLogs.length}</div>
                        </div>
                    </div>
                </header>

                <main className="p-6 space-y-6">
                    {/* Filters Toolbar */}
                    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Filter className="w-4 h-4" />
                            <span>{isEn ? 'Search & Filters' : 'Filtros y Búsqueda'}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder={isEn ? 'Search target, admin, notes...' : 'Buscar registro, admin, notas...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <select
                                    value={actorRoleFilter}
                                    onChange={(e) => {
                                        setActorRoleFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">{isEn ? 'All Actors' : 'Todos los Actores'}</option>
                                    <option value="admin">{isEn ? 'Administrators' : 'Administradores'}</option>
                                    <option value="client">{isEn ? 'Clients' : 'Clientes'}</option>
                                </select>
                            </div>

                            <div>
                                <select
                                    value={actionFilter}
                                    onChange={(e) => {
                                        setActionFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">{isEn ? 'All Actions' : 'Todas las Acciones'}</option>
                                    <option value="ORDER_EDIT">ORDER_EDIT</option>
                                    <option value="FEE_OVERRIDE">FEE_OVERRIDE</option>
                                    <option value="DISCOUNT_CHANGE">DISCOUNT_CHANGE</option>
                                    <option value="CLIENT_RATE_UPDATE">CLIENT_RATE_UPDATE</option>
                                    <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                                </select>
                            </div>

                            <div>
                                <select
                                    value={targetEntityFilter}
                                    onChange={(e) => {
                                        setTargetEntityFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="">{isEn ? 'All Entities' : 'Todas las Entidades'}</option>
                                    <option value="Order">Order</option>
                                    <option value="User">User</option>
                                    <option value="SystemConfig">SystemConfig</option>
                                </select>
                            </div>

                            <div>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        {isLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm">{isEn ? 'Loading audit trail...' : 'Cargando bitácora forense...'}</p>
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                                <p className="text-sm font-medium">
                                    {isEn ? 'No audit records found' : 'No se encontraron registros de auditoría'}
                                </p>
                                <p className="text-xs text-muted-foreground/80">
                                    {isEn
                                        ? 'Administrative actions will appear here once registered'
                                        : 'Las acciones de administradores se registrarán automáticamente aquí'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground tracking-wider font-semibold">
                                        <tr>
                                            <th className="py-3.5 px-4">{isEn ? 'Date / Time' : 'Fecha / Hora'}</th>
                                            <th className="py-3.5 px-4">{isEn ? 'Actor / User' : 'Actor / Usuario'}</th>
                                            <th className="py-3.5 px-4">{isEn ? 'Action' : 'Acción'}</th>
                                            <th className="py-3.5 px-4">{isEn ? 'Target Record' : 'Registro Afectado'}</th>
                                            <th className="py-3.5 px-4">{isEn ? 'Change Details' : 'Detalle de Cambios'}</th>
                                            <th className="py-3.5 px-4">{isEn ? 'Notes & IP' : 'Notas & IP'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border font-mono text-xs">
                                        {filteredLogs.map((log) => {
                                            const formattedDate = new Date(log.created_at).toLocaleString(locale === 'en' ? 'en-US' : 'es-ES', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                            });

                                            const isClientActor = log.actor_role === 'client';

                                            return (
                                                <tr key={log.id} className="hover:bg-muted/30 transition">
                                                    <td className="py-3 px-4 whitespace-nowrap text-muted-foreground font-sans">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                            <span>{formattedDate}</span>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 font-sans">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                isClientActor
                                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                                                    : 'bg-primary/10 text-primary'
                                                            }`}>
                                                                {isClientActor ? 'C' : (log.admin_name ? log.admin_name.charAt(0).toUpperCase() : 'A')}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-foreground text-xs">{log.admin_name || (isClientActor ? 'Cliente' : 'Admin')}</span>
                                                                    <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                                        isClientActor
                                                                            ? 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950 dark:text-purple-300'
                                                                            : 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                                                    }`}>
                                                                        {isClientActor ? 'CLIENTE' : 'ADMIN'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{log.admin_id}</div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getActionBadgeClass(log.action)}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        <div className="font-sans">
                                                            <span className="font-semibold text-primary">{log.target_entity}</span>
                                                            <span className="text-muted-foreground ml-1.5 text-xs font-mono">#{log.target_id?.slice(0, 12)}...</span>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 font-sans">
                                                        <button
                                                            onClick={() => setSelectedLog(log)}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border rounded-md hover:bg-muted transition text-foreground"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-primary" />
                                                            <span>{isEn ? 'Inspect Delta' : 'Ver Cambios'}</span>
                                                        </button>
                                                    </td>

                                                    <td className="py-3 px-4 font-sans max-w-xs">
                                                        <div className="truncate text-xs text-foreground" title={log.notes || ''}>
                                                            {log.notes || (isEn ? 'No notes provided' : 'Sin notas')}
                                                        </div>
                                                        {log.ip_address && (
                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                                                                <Globe className="w-3 h-3 text-muted-foreground/60" />
                                                                <span>{log.ip_address}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Bar */}
                        <div className="p-4 border-t border-border flex items-center justify-between gap-4 text-sm">
                            <div className="text-xs text-muted-foreground">
                                {isEn
                                    ? `Showing page ${page} of ${totalPages} (${total} total events)`
                                    : `Mostrando página ${page} de ${totalPages} (${total} eventos en total)`}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1 || isLoading}
                                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg disabled:opacity-50 hover:bg-muted transition"
                                >
                                    {isEn ? 'Previous' : 'Anterior'}
                                </button>
                                <span className="text-xs font-semibold px-2">{page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || isLoading}
                                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg disabled:opacity-50 hover:bg-muted transition"
                                >
                                    {isEn ? 'Next' : 'Siguiente'}
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Change Inspection Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Eye className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">
                                        {isEn ? 'Audit State Delta' : 'Detalle de Modificación Forense'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        ID: {selectedLog.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 rounded-xl bg-muted/40 text-xs">
                                <div>
                                    <div className="text-muted-foreground mb-0.5">{isEn ? 'Action' : 'Acción'}</div>
                                    <span className={`inline-block px-2 py-0.5 rounded font-semibold text-[10px] border ${getActionBadgeClass(selectedLog.action)}`}>
                                        {selectedLog.action}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">{isEn ? 'Actor Role' : 'Rol del Actor'}</div>
                                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                                        selectedLog.actor_role === 'client' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}>
                                        {selectedLog.actor_role === 'client' ? 'CLIENTE' : 'ADMIN'}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">{isEn ? 'User / Name' : 'Usuario / Nombre'}</div>
                                    <div className="font-semibold text-foreground">{selectedLog.admin_name}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">{isEn ? 'Target' : 'Objetivo'}</div>
                                    <div className="font-semibold text-foreground">{selectedLog.target_entity}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-0.5">{isEn ? 'IP Address' : 'Dirección IP'}</div>
                                    <div className="font-mono text-foreground">{selectedLog.ip_address || 'N/A'}</div>
                                </div>
                            </div>

                            {selectedLog.notes && (
                                <div className="p-3.5 rounded-xl border border-border bg-background">
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                                        {isEn ? 'Justification / Notes:' : 'Motivo / Notas Justificativas:'}
                                    </div>
                                    <p className="text-sm text-foreground">{selectedLog.notes}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                        <span>{isEn ? 'Previous State (Before)' : 'Estado Previo (Antes)'}</span>
                                    </div>
                                    <pre className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900 text-xs font-mono text-foreground overflow-x-auto max-h-64 whitespace-pre-wrap">
                                        {formatJsonPretty(selectedLog.previous_state_json)}
                                    </pre>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        <span>{isEn ? 'New State (After)' : 'Nuevo Estado (Después)'}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </div>
                                    <pre className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 text-xs font-mono text-foreground overflow-x-auto max-h-64 whitespace-pre-wrap">
                                        {formatJsonPretty(selectedLog.new_state_json)}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-card flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                            >
                                {isEn ? 'Close' : 'Cerrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
