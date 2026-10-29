'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    MessageSquare, Search, Loader2, AlertCircle, CheckCircle2,
    Clock, Check, RefreshCw, Filter, Eye, X, User, Mail, Tag
} from 'lucide-react';
import { api } from '@/lib/api';

interface FeedbackItem {
    id: string;
    user_id?: string;
    category: string;
    message: string;
    status: string; // 'pending' | 'reviewed' | 'resolved'
    created_at: string;
    user?: {
        id: string;
        email: string;
        profile?: {
            company_name?: string;
            contact_name?: string;
            phone?: string;
        };
    };
}

export default function AdminFeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('all');
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const fetchFeedbacks = async () => {
        setIsLoading(true);
        try {
            const data = await api.get('/feedback') as FeedbackItem[];
            setFeedbacks(data || []);
        } catch (err) {
            console.error('Error fetching feedbacks:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setIsUpdating(id);
        try {
            await api.patch(`/feedback/${id}/status`, { status: newStatus });
            setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
            if (selectedFeedback && selectedFeedback.id === id) {
                setSelectedFeedback(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Error al actualizar el estado del feedback');
        } finally {
            setIsUpdating(null);
        }
    };

    const filtered = feedbacks.filter(f => {
        const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
        const q = search.toLowerCase();
        const matchesSearch =
            !search ||
            f.message.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q) ||
            f.user?.email?.toLowerCase().includes(q) ||
            f.user?.profile?.company_name?.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const pendingCount = feedbacks.filter(f => f.status === 'pending').length;
    const reviewedCount = feedbacks.filter(f => f.status === 'reviewed').length;
    const resolvedCount = feedbacks.filter(f => f.status === 'resolved').length;

    const getCategoryBadge = (cat: string) => {
        const c = cat.toLowerCase();
        if (c.includes('reclamo') || c.includes('complaint')) {
            return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-black uppercase tracking-wider">Reclamo</span>;
        }
        if (c.includes('sugerencia') || c.includes('suggestion')) {
            return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-black uppercase tracking-wider">Sugerencia</span>;
        }
        if (c.includes('producto')) {
            return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase tracking-wider">Producto</span>;
        }
        if (c.includes('servicio')) {
            return <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-black uppercase tracking-wider">Servicio</span>;
        }
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-black uppercase tracking-wider">{cat}</span>;
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'resolved') {
            return (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                    <CheckCircle2 size={12} /> Resuelto
                </span>
            );
        }
        if (s === 'reviewed') {
            return (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                    <Clock size={12} /> En Revisión
                </span>
            );
        }
        return (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                <AlertCircle size={12} /> Pendiente
            </span>
        );
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
            <AdminSidebar />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                                    <MessageSquare size={24} />
                                </div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                    Buzón de Sugerencias y Feedback
                                </h1>
                            </div>
                            <p className="text-sm text-slate-500 font-medium">
                                Bandeja de entrada de sugerencias, reclamos e iniciativas recibidas de clientes B2B.
                            </p>
                        </div>

                        <button
                            onClick={fetchFeedbacks}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Recibidos</p>
                            <p className="text-3xl font-black text-slate-900 mt-1">{feedbacks.length}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm">
                            <p className="text-xs font-black uppercase text-amber-600 tracking-wider">Pendientes</p>
                            <p className="text-3xl font-black text-amber-600 mt-1">{pendingCount}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-sm">
                            <p className="text-xs font-black uppercase text-blue-600 tracking-wider">En Revisión</p>
                            <p className="text-3xl font-black text-blue-600 mt-1">{reviewedCount}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                            <p className="text-xs font-black uppercase text-emerald-600 tracking-wider">Resueltos</p>
                            <p className="text-3xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por cliente, empresa o mensaje..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                            {(['all', 'pending', 'reviewed', 'resolved'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                                        statusFilter === st
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {st === 'all' ? 'Todos' : st === 'pending' ? 'Pendientes' : st === 'reviewed' ? 'En Revisión' : 'Resueltos'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Feedbacks List */}
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center">
                                <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cargando sugerencias...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
                                <MessageSquare size={44} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-base font-bold text-slate-700">No hay mensajes de feedback</p>
                                <p className="text-xs text-slate-400 mt-1">Los mensajes enviados por clientes desde el portal aparecerán aquí.</p>
                            </div>
                        ) : (
                            filtered.map(fb => (
                                <div
                                    key={fb.id}
                                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {getCategoryBadge(fb.category)}
                                            {getStatusBadge(fb.status)}
                                            <span className="text-xs text-slate-400 font-medium">
                                                {new Date(fb.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Status Action Buttons */}
                                        <div className="flex items-center gap-2">
                                            {fb.status !== 'reviewed' && fb.status !== 'resolved' && (
                                                <button
                                                    disabled={isUpdating === fb.id}
                                                    onClick={() => handleUpdateStatus(fb.id, 'reviewed')}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                >
                                                    <Clock size={12} /> Revisar
                                                </button>
                                            )}
                                            {fb.status !== 'resolved' && (
                                                <button
                                                    disabled={isUpdating === fb.id}
                                                    onClick={() => handleUpdateStatus(fb.id, 'resolved')}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                >
                                                    <Check size={12} /> Resolver
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedFeedback(fb)}
                                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                                                title="Ver detalle completo"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <p className="text-sm text-slate-800 leading-relaxed font-normal bg-slate-50/50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                                        {fb.message}
                                    </p>

                                    {/* Author Info */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-slate-400" />
                                            <span className="font-bold text-slate-700">
                                                {fb.user?.profile?.company_name || fb.user?.profile?.contact_name || fb.user?.email || 'Cliente Anónimo'}
                                            </span>
                                            {fb.user?.email && (
                                                <span className="text-slate-400">({fb.user.email})</span>
                                            )}
                                        </div>
                                        {fb.user?.profile?.phone && (
                                            <span className="text-slate-400">Tel: {fb.user.profile.phone}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Modal de Detalle */}
            {selectedFeedback && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {getCategoryBadge(selectedFeedback.category)}
                                {getStatusBadge(selectedFeedback.status)}
                            </div>
                            <button
                                onClick={() => setSelectedFeedback(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-slate-900 mb-1">Detalle del Mensaje</h3>
                            <p className="text-xs text-slate-400">Enviado el {new Date(selectedFeedback.created_at).toLocaleString()}</p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-72 overflow-y-auto">
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{selectedFeedback.message}</p>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-2 text-xs">
                            <p className="font-bold text-blue-900">Datos de Contacto del Cliente:</p>
                            <p className="text-slate-700">Empresa: <strong>{selectedFeedback.user?.profile?.company_name || 'N/A'}</strong></p>
                            <p className="text-slate-700">Contacto: <strong>{selectedFeedback.user?.profile?.contact_name || 'N/A'}</strong></p>
                            <p className="text-slate-700">Email: <strong>{selectedFeedback.user?.email || 'N/A'}</strong></p>
                            <p className="text-slate-700">Teléfono: <strong>{selectedFeedback.user?.profile?.phone || 'N/A'}</strong></p>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            {selectedFeedback.status !== 'resolved' && (
                                <button
                                    onClick={() => handleUpdateStatus(selectedFeedback.id, 'resolved')}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    Marcar como Resuelto
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedFeedback(null)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
