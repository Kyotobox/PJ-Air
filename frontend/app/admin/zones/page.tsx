'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    MapPin, Plus, Edit2, Trash2, Search, Check, X,
    Loader2, AlertCircle, Sparkles, Tag, DollarSign,
    CheckCircle2, RefreshCw, Power, ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';

interface DeliveryZone {
    id: string;
    name: string;
    zip_codes: string;
    base_fee: number;
    min_free_delivery_amount: number | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export default function AdminZonesPage() {
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
    const [name, setName] = useState('');
    const [zipCodes, setZipCodes] = useState('');
    const [baseFee, setBaseFee] = useState('0.00');
    const [minFreeDelivery, setMinFreeDelivery] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Delete modal
    const [deleteConfirm, setDeleteConfirm] = useState<DeliveryZone | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchZones = async () => {
        try {
            setLoading(true);
            const data = await api.get('/zones') as DeliveryZone[];
            setZones(Array.isArray(data) ? data : []);
        } catch (err: any) {
            showToast(err.message || 'Error al cargar las zonas de entrega', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, []);

    const openCreateModal = () => {
        setEditingZone(null);
        setName('');
        setZipCodes('');
        setBaseFee('10.00');
        setMinFreeDelivery('');
        setIsActive(true);
        setFormError(null);
        setShowModal(true);
    };

    const openEditModal = (zone: DeliveryZone) => {
        setEditingZone(zone);
        setName(zone.name);
        setZipCodes(zone.zip_codes);
        setBaseFee(String(zone.base_fee ?? 0));
        setMinFreeDelivery(zone.min_free_delivery_amount !== null && zone.min_free_delivery_amount !== undefined ? String(zone.min_free_delivery_amount) : '');
        setIsActive(Boolean(zone.is_active));
        setFormError(null);
        setShowModal(true);
    };

    const handleSaveZone = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!name.trim()) {
            setFormError('El nombre de la zona es obligatorio.');
            return;
        }

        if (!zipCodes.trim()) {
            setFormError('Debe ingresar al menos un código postal.');
            return;
        }

        const feeNum = parseFloat(baseFee);
        if (isNaN(feeNum) || feeNum < 0) {
            setFormError('La tarifa base debe ser un número mayor o igual a cero.');
            return;
        }

        let freeDeliveryNum: number | null = null;
        if (minFreeDelivery.trim() !== '') {
            const parsed = parseFloat(minFreeDelivery);
            if (isNaN(parsed) || parsed < 0) {
                setFormError('El monto mínimo para envío gratis debe ser un número válido o dejarse vacío.');
                return;
            }
            freeDeliveryNum = parsed > 0 ? parsed : null;
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                zip_codes: zipCodes.trim(),
                base_fee: feeNum,
                min_free_delivery_amount: freeDeliveryNum,
                is_active: isActive,
            };

            if (editingZone) {
                await api.put(`/zones/${editingZone.id}`, payload);
                showToast(`Zona "${name}" actualizada exitosamente.`);
            } else {
                await api.post('/zones', payload);
                showToast(`Zona "${name}" creada exitosamente.`);
            }

            setShowModal(false);
            await fetchZones();
        } catch (err: any) {
            setFormError(err.message || 'Error al guardar la zona.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteZone = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await api.delete(`/zones/${deleteConfirm.id}`);
            showToast(`Zona "${deleteConfirm.name}" eliminada.`);
            setDeleteConfirm(null);
            await fetchZones();
        } catch (err: any) {
            showToast(err.message || 'Error al eliminar la zona.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const toggleZoneActive = async (zone: DeliveryZone) => {
        try {
            await api.put(`/zones/${zone.id}`, {
                is_active: !zone.is_active,
            });
            showToast(`Zona "${zone.name}" ${!zone.is_active ? 'activada' : 'desactivada'}.`);
            await fetchZones();
        } catch (err: any) {
            showToast(err.message || 'Error al actualizar el estado de la zona.', 'error');
        }
    };

    const filteredZones = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return zones;
        return zones.filter(z =>
            z.name.toLowerCase().includes(q) ||
            z.zip_codes.toLowerCase().includes(q)
        );
    }, [zones, searchQuery]);

    const activeCount = useMemo(() => zones.filter(z => z.is_active).length, [zones]);

    return (
        <div className="flex min-h-screen bg-muted/30">
            <AdminSidebar />

            <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white text-sm font-semibold animate-fade-in ${
                        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                    }`}>
                        {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {toast.msg}
                    </div>
                )}

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-primary/10 text-primary">
                                Logística & Despacho
                            </span>
                            <span className="text-xs text-muted-foreground font-semibold">
                                {activeCount} de {zones.length} zonas activas
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold font-serif tracking-tight">Zonas de Delivery</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configura los bloques de códigos postales (ZIP), tarifas base y montos para bonificación de envío gratis.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={fetchZones}
                            disabled={loading}
                            className="p-3 bg-card hover:bg-muted text-foreground/80 border border-border rounded-2xl transition-all shadow-sm"
                            title="Recargar zonas"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin text-primary' : ''} />
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus size={18} /> Nueva Zona
                        </button>
                    </div>
                </header>

                {/* Filter and Search */}
                <div className="bg-card border border-border rounded-2xl p-4 mb-8 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código postal (ej. 33178)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-muted/50 border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground self-end sm:self-center">
                        Mostrando {filteredZones.length} de {zones.length} zonas
                    </div>
                </div>

                {/* Zones Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 className="animate-spin text-primary" size={36} />
                        <span className="text-sm font-semibold">Cargando zonas de cobertura...</span>
                    </div>
                ) : filteredZones.length === 0 ? (
                    <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                            <MapPin size={32} />
                        </div>
                        <h3 className="text-lg font-bold mb-2">No se encontraron zonas</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            {searchQuery ? 'No hay zonas que coincidan con la búsqueda.' : 'Aún no has configurado zonas de entrega con tarifas personalizadas.'}
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-primary/95 transition-all"
                        >
                            Crear Primera Zona
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredZones.map(zone => {
                            const zipList = zone.zip_codes.split(/[\s,]+/).map(z => z.trim()).filter(Boolean);
                            const hasFreeDelivery = zone.min_free_delivery_amount !== null && Number(zone.min_free_delivery_amount) > 0;

                            return (
                                <div
                                    key={zone.id}
                                    className={`bg-card rounded-3xl border transition-all p-6 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:border-primary/40 ${
                                        zone.is_active ? 'border-border' : 'border-border/40 opacity-75 bg-muted/10'
                                    }`}
                                >
                                    <div>
                                        {/* Status Header */}
                                        <div className="flex items-start justify-between gap-2 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                                                    zone.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                                }`}>
                                                    <MapPin size={22} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg leading-tight text-foreground">{zone.name}</h3>
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider ${
                                                        zone.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${zone.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                                        {zone.is_active ? 'Activa' : 'Inactiva'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => toggleZoneActive(zone)}
                                                className={`p-2 rounded-xl border text-xs transition-all ${
                                                    zone.is_active
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                                                        : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                                                }`}
                                                title={zone.is_active ? 'Desactivar zona' : 'Activar zona'}
                                            >
                                                <Power size={14} />
                                            </button>
                                        </div>

                                        {/* Pricing Stats */}
                                        <div className="grid grid-cols-2 gap-3 mb-5 p-3.5 bg-muted/40 rounded-2xl border border-border/50 text-xs">
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">Tarifa Base</span>
                                                <span className="text-base font-extrabold text-foreground">
                                                    ${Number(zone.base_fee || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-wider block">Envío Gratis</span>
                                                {hasFreeDelivery ? (
                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                                        <Sparkles size={12} /> Desde ${Number(zone.min_free_delivery_amount).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-medium mt-0.5 block">
                                                        No configurado
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* ZIP Codes Badges */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between text-[11px] font-black uppercase text-muted-foreground tracking-wider mb-2">
                                                <span>Códigos Postales ({zipList.length})</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                                                {zipList.map((zip, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-0.5 bg-background border border-border rounded-lg text-xs font-mono font-semibold text-foreground/80 shadow-2xs"
                                                    >
                                                        {zip}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => openEditModal(zone)}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                title="Editar zona"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(zone)}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
                                                title="Eliminar zona"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => openEditModal(zone)}
                                            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                                        >
                                            Modificar <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Quick Add Card */}
                        <button
                            onClick={openCreateModal}
                            className="bg-card/50 hover:bg-card border-2 border-dashed border-border hover:border-primary rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary transition-all group min-h-[260px]"
                        >
                            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <Plus size={24} />
                            </div>
                            <span className="font-bold text-sm">Añadir otra zona de delivery</span>
                        </button>
                    </div>
                )}

                {/* Create / Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                            <div className="p-6 md:p-8 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold font-serif text-foreground">
                                        {editingZone ? 'Editar Zona de Cobertura' : 'Nueva Zona de Delivery'}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Asigna ZIP codes y reglas comerciales para esta zona.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveZone} className="p-6 md:p-8 space-y-5 overflow-y-auto">
                                {formError && (
                                    <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                                        <AlertCircle size={16} className="shrink-0" />
                                        {formError}
                                    </div>
                                )}

                                {/* Name */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                                        Nombre de la Zona *
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Doral / Medley / Sweetwater"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        required
                                    />
                                </div>

                                {/* ZIP Codes */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                                            Bloque de Códigos Postales (ZIP) *
                                        </label>
                                        <span className="text-[10px] text-muted-foreground font-semibold">Separados por coma</span>
                                    </div>
                                    <textarea
                                        placeholder="Ej. 33178, 33166, 33122, 33172"
                                        value={zipCodes}
                                        onChange={(e) => setZipCodes(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        required
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Ingresa los códigos postales de 5 dígitos que pertenecen a esta zona.
                                    </p>
                                </div>

                                {/* Pricing Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                                            Tarifa Base ($) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="10.00"
                                                value={baseFee}
                                                onChange={(e) => setBaseFee(e.target.value)}
                                                className="w-full pl-8 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
                                            Mínimo para Envío Gratis ($)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="Dejar vacío si no aplica"
                                                value={minFreeDelivery}
                                                onChange={(e) => setMinFreeDelivery(e.target.value)}
                                                className="w-full pl-8 pr-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Active Toggle */}
                                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/60">
                                    <div>
                                        <span className="text-sm font-bold block text-foreground">Zona Activa</span>
                                        <span className="text-xs text-muted-foreground">
                                            Las zonas inactivas no se consideran para resolver tarifas en checkout.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsActive(!isActive)}
                                        className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${
                                            isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                                        }`}
                                    >
                                        <span
                                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                                isActive ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-3.5 border border-border rounded-2xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="flex-1 py-3.5 bg-primary hover:bg-primary/95 text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Guardando...
                                            </>
                                        ) : editingZone ? (
                                            'Actualizar Zona'
                                        ) : (
                                            'Crear Zona'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 animate-fade-in">
                            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">¿Eliminar esta zona?</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Estás a punto de eliminar permanentemente la zona <strong className="text-foreground">"{deleteConfirm.name}"</strong>. Los pedidos futuros en estos códigos postales aplicarán la tarifa fallback general a menos que se asigne a otra zona.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-3 border border-border rounded-2xl font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteZone}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Eliminar Zona'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
