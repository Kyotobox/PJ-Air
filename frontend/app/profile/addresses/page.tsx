'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { MapPin, Plus, Trash2, Home, Briefcase, Edit2, Loader2, AlertCircle, Moon, Key, Snowflake, Camera, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const ZONES = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro'];

interface Address {
    id: string;
    name: string;
    address: string;
    zone: string;
    notes?: string;
    access_code?: string;
    has_key?: boolean;
    key_location?: string;
    fridge_access_required?: boolean;
    delivery_photos_json?: string;
}

interface AddressForm {
    name: string;
    address: string;
    zone: string;
    notes: string;
}

const emptyForm: AddressForm = { name: '', address: '', zone: 'Norte', notes: '' };

export default function AddressesPage() {
    const { user } = useAuth();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<AddressForm>(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchAddresses();
    }, [user]);

    const fetchAddresses = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.get(`/addresses/user/${user!.id}`) as any[];
            setAddresses(data || []);
        } catch (err: any) {
            setError(err.message || 'Error al cargar las direcciones');
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (addr: Address) => {
        setEditingId(addr.id);
        setForm({ name: addr.name, address: addr.address, zone: addr.zone, notes: addr.notes || '' });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.address) return;
        setSaving(true);
        try {
            if (editingId) {
                const updated = await api.patch(`/addresses/${editingId}`, form) as any;
                setAddresses(prev => prev.map(a => a.id === editingId ? updated : a));
            } else {
                const created = await api.post('/addresses', { userId: user!.id, ...form }) as any;
                setAddresses(prev => [...prev, created]);
            }
            setShowModal(false);
        } catch (err: any) {
            alert(err.message || 'Error al guardar la dirección');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta dirección?')) return;
        try {
            await api.delete(`/addresses/${id}`);
            setAddresses(prev => prev.filter(a => a.id !== id));
        } catch (err: any) {
            alert(err.message || 'Error al eliminar');
        }
    };

    return (
        <div className="min-h-screen bg-muted/20">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-12">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-primary">Mis Direcciones</h1>
                        <p className="text-muted-foreground">Gestiona tus puntos de entrega para recibir tus pedidos</p>
                    </div>
                    <button onClick={openNew} className="flex items-center gap-2 bg-primary text-white btn-premium">
                        <Plus size={20} /> Agregar Nueva
                    </button>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <span className="font-medium">Cargando direcciones...</span>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex items-center gap-3 p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 mb-6">
                        <AlertCircle size={20} />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {!loading && (
                    <div className="grid grid-cols-1 gap-6">
                        {addresses.map(addr => (
                            <div key={addr.id} className="bg-card p-8 rounded-3xl border border-border shadow-sm flex items-start justify-between group hover:border-primary/50 transition-all">
                                <div className="flex gap-6">
                                    <div className="w-14 h-14 bg-secondary text-primary rounded-2xl flex items-center justify-center shrink-0">
                                        {addr.name.toLowerCase().includes('casa') ? <Home size={28} /> : <Briefcase size={28} />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold mb-1">{addr.name}</h3>
                                        <p className="font-medium text-foreground/80 mb-1">{addr.address}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-1 rounded">Zona: {addr.zone}</span>
                                            {addr.notes && <span className="text-xs text-muted-foreground italic">"{addr.notes}"</span>}
                                        </div>
                                        {(addr.access_code || addr.has_key || addr.fridge_access_required || addr.delivery_photos_json) && (
                                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                                    <Moon size={11} /> Despacho Madrugada
                                                </span>
                                                {addr.access_code && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/80 bg-muted px-2 py-1 rounded-md">
                                                        <ShieldCheck size={11} className="text-primary" /> Código: {addr.access_code}
                                                    </span>
                                                )}
                                                {addr.has_key && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground/80 bg-muted px-2 py-1 rounded-md">
                                                        <Key size={11} className="text-amber-600" /> {addr.key_location ? `Llave: ${addr.key_location}` : 'Llave requerida'}
                                                    </span>
                                                )}
                                                {addr.fridge_access_required && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                                                        <Snowflake size={11} /> Acceso a Neveras
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEdit(addr)}
                                        className="p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(addr.id)}
                                        className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {addresses.length === 0 && (
                            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-border">
                                <MapPin size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                                <h3 className="text-xl font-bold text-muted-foreground">Aún no tienes direcciones</h3>
                                <p className="text-muted-foreground mb-6">Agrega una dirección para comenzar a pedir</p>
                                <button onClick={openNew} className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg">
                                    Agregar Mi Primera Dirección
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-8 border-b border-border bg-muted/30">
                            <h2 className="text-2xl font-bold">{editingId ? 'Editar Dirección' : 'Nueva Dirección'}</h2>
                            <p className="text-sm text-muted-foreground">Completa los datos para el delivery</p>
                        </div>

                        <div className="p-8 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-muted-foreground uppercase mb-1">Nombre (Alias)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Casa, Trabajo"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-muted-foreground uppercase mb-1">Zona</label>
                                    <select
                                        value={form.zone}
                                        onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                                        className="w-full px-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    >
                                        {ZONES.map(z => <option key={z}>{z}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-muted-foreground uppercase mb-1">Dirección Completa</label>
                                <textarea
                                    rows={2}
                                    value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="w-full px-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    placeholder="Calle, edificio, apto..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-muted-foreground uppercase mb-1">Notas (Opcional)</label>
                                <input
                                    type="text"
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Cerca de..., Color de fachada..."
                                    className="w-full px-4 py-3 bg-muted rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-muted/10 flex gap-4">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-4 font-bold text-muted-foreground hover:bg-muted rounded-2xl transition-all">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl hover:bg-black transition-all disabled:opacity-60"
                            >
                                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar Dirección'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
