'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    Users, Search, Loader2, AlertCircle, Shield, User, Mail, Phone,
    CheckCircle2, X, MapPin, ShoppingBag, ChevronRight, Package, Clock, Edit, Truck, Trash2, Target
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { formatUtmDisplay } from '@/lib/utm';

interface Address { id: string; address: string; city: string; state?: string; zip_code?: string; country?: string; is_default?: boolean; }
interface OrderItem { 
    id: string; 
    quantity: number; 
    price_at_time: number; 
    product?: { name: string; description?: string; };
}
interface Order { id: string; total: number; status: string; created_at: string; delivery_date?: string; items?: OrderItem[]; }
interface UserRecord {
    id: string; email: string; role: string;
    profile?: { full_name?: string; username?: string; phone?: string; avatar_url?: string; };
    addresses?: Address[];
    orders?: Order[];
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    account_status?: string;
}

const ROLES = ['client', 'admin', 'delivery', 'produccion'];

const ROLE_STYLES: Record<string, string> = {
    admin:      'bg-primary/10 text-primary border-primary/20',
    delivery:   'bg-amber-50 text-amber-700 border-amber-200',
    produccion: 'bg-violet-50 text-violet-700 border-violet-200',
    client:     'bg-muted text-muted-foreground border-border',
};

const STATUS_COLORS: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [updatingRole, setUpdatingRole] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [savingAddr, setSavingAddr] = useState(false);
    const [deliveryUsers, setDeliveryUsers] = useState<any[]>([]);
    const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
    const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'admin' | 'delivery' | 'produccion'>('all');
    
    // Discount states
    const [generalDiscount, setGeneralDiscount] = useState<number>(0);
    const [productDiscounts, setProductDiscounts] = useState<any[]>([]);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [pdSearch, setPdSearch] = useState('');
    const [selectedPdProduct, setSelectedPdProduct] = useState<any>(null);
    const [pdPercent, setPdPercent] = useState<string>('');
    const [pdPrice, setPdPrice] = useState<string>('');
    const [isSavingDiscount, setIsSavingDiscount] = useState(false);
    const [deliveryFee, setDeliveryFee] = useState<number>(0);
    const [isSavingFee, setIsSavingFee] = useState(false);

    // Password reset & New Staff states
    const [resetPasswordModal, setResetPasswordModal] = useState<UserRecord | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResettingPwd, setIsResettingPwd] = useState(false);

    const [showNewStaffModal, setShowNewStaffModal] = useState(false);
    const [newStaffEmail, setNewStaffEmail] = useState('');
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffPassword, setNewStaffPassword] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<'admin' | 'delivery' | 'produccion'>('delivery');
    const [isCreatingStaff, setIsCreatingStaff] = useState(false);

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetPasswordModal) return;
        if (newPassword.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        setIsResettingPwd(true);
        try {
            await api.patch(`/admin-actions/users/${resetPasswordModal.id}/reset-password`, { newPassword });
            showToast('✅ Contraseña restablecida');
            setResetPasswordModal(null);
            setNewPassword('');
        } catch (err: any) {
            alert(err.message || 'Error al restablecer la contraseña');
        } finally {
            setIsResettingPwd(false);
        }
    };

    const handleCreateStaffSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newStaffPassword.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres');
            return;
        }
        setIsCreatingStaff(true);
        try {
            await api.post('/auth/signup', {
                email: newStaffEmail,
                password: newStaffPassword,
                full_name: newStaffName,
                role: newStaffRole,
            });
            showToast('✅ Usuario Staff creado');
            setShowNewStaffModal(false);
            setNewStaffEmail('');
            setNewStaffName('');
            setNewStaffPassword('');
            setNewStaffRole('delivery');
            fetchUsers();
        } catch (err: any) {
            alert(err.message || 'Error al crear usuario staff');
        } finally {
            setIsCreatingStaff(false);
        }
    };

    useEffect(() => { 
        fetchUsers(); 
        fetchDeliveryUsers();
        fetchProducts();
    }, []);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    const fetchUsers = async () => {
        try {
            setLoading(true); setError(null);
            const data = await api.get('/users');
            setUsers(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || 'No se pudieron cargar los usuarios');
        } finally { setLoading(false); }
    };

    const fetchDeliveryUsers = async () => {
        try {
            const data = await api.get('/users');
            if (Array.isArray(data)) {
                setDeliveryUsers(data.filter(u => u.role === 'delivery'));
            }
        } catch (err) { console.error('Error fetching delivery users', err); }
    };

    const fetchProducts = async () => {
        try {
            const data = await api.get('/products');
            setAvailableProducts(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Error fetching products', err); }
    };

    const openUserDetail = async (user: UserRecord) => {
        setSelectedUser(user);
        setGeneralDiscount(Number((user as any).general_discount) || 0);
        // Reload full detail (includes orders and addresses)
        try {
            setLoadingDetail(true);
            const detail = await api.get(`/users/${user.id}`) as any;
            setSelectedUser(detail);
            setGeneralDiscount(Number(detail.general_discount) || 0);
            setDeliveryFee(Number(detail.delivery_fee) || 0);
            
            // Get product discounts
            const discounts = await api.get(`/users/${user.id}/product-discounts`) as any[];
            setProductDiscounts(discounts || []);
        } catch { /* keep what we have */ }
        finally { setLoadingDetail(false); }
    };

    const handleRoleChange = async (userId: string, newRole: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setUpdatingRole(userId);
        try {
            await api.patch(`/users/${userId}/role`, { role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, role: newRole } : prev);
            showToast(`✅ Rol actualizado a "${newRole}"`);
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setUpdatingRole(null); }
    };

    const handleUpdateAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAddress) return;
        setSavingAddr(true);
        try {
            const updated = await api.patch(`/addresses/${editingAddress.id}`, editingAddress) as Address;
            setSelectedUser(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    addresses: prev.addresses?.map(a => a.id === updated.id ? updated : a)
                };
            });
            showToast('✅ Dirección actualizada');
            setEditingAddress(null);
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setSavingAddr(false); }
    };

    const handleAssignOrder = async (orderId: string, deliveryId: string) => {
        try {
            await api.patch(`/orders/${orderId}/assign`, { deliveryUserId: deliveryId });
            showToast('✅ Pedido asignado');
            setAssigningOrder(null);
            // Refresh detail
            if (selectedUser) openUserDetail(selectedUser);
        } catch (err: any) { showToast(`❌ ${err.message}`); }
    };

    const handleUpdateGeneralDiscount = async () => {
        if (!selectedUser) return;
        setIsSavingDiscount(true);
        try {
            await api.patch(`/users/${selectedUser.id}/general-discount`, { discount: generalDiscount });
            showToast('✅ Descuento general actualizado');
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingDiscount(false); }
    };

    const handleUpdateDeliveryFee = async () => {
        if (!selectedUser) return;
        setIsSavingFee(true);
        try {
            await api.patch(`/users/${selectedUser.id}/delivery-fee`, { fee: deliveryFee });
            showToast('✅ Delivery Fee actualizado');
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingFee(false); }
    };

    const handleAddProductDiscount = async () => {
        if (!selectedUser || !selectedPdProduct) return;
        setIsSavingDiscount(true);
        try {
            const data: any = { productId: selectedPdProduct.id };
            if (pdPercent) data.discount_percentage = Number(pdPercent);
            if (pdPrice) data.special_price = Number(pdPrice);

            await api.post(`/users/${selectedUser.id}/product-discounts`, data);
            showToast('✅ Descuento por producto guardado');
            
            // Refresh discounts
            const discounts = await api.get(`/users/${selectedUser.id}/product-discounts`) as any[];
            setProductDiscounts(discounts || []);
            
            setSelectedPdProduct(null);
            setPdPercent('');
            setPdPrice('');
            setPdSearch('');
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingDiscount(false); }
    };

    const handleDeleteProductDiscount = async (id: string) => {
        if (!confirm('¿Eliminar este descuento?')) return;
        try {
            await api.delete(`/users/product-discounts/${id}`);
            setProductDiscounts(prev => prev.filter(d => d.id !== id));
            showToast('✅ Descuento eliminado');
        } catch (err: any) { showToast(`❌ ${err.message}`); }
    };

    const filtered = users.filter(u => {
        const matchesSearch = 
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.profile?.phone?.toLowerCase().includes(search.toLowerCase());
        
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        
        return matchesSearch && matchesRole;
    }).sort((a, b) => {
        const nameA = a.profile?.full_name || a.email || '';
        const nameB = b.profile?.full_name || b.email || '';
        return nameA.localeCompare(nameB);
    });

    return (
        <div className="flex min-h-screen bg-muted/30">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
                        <p className="text-muted-foreground">
                            {loading ? 'Cargando...' : `${users.length} usuario${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowNewStaffModal(true)}
                        className="py-3 px-5 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        Nuevo Usuario
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="bg-card p-4 rounded-2xl border border-border mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input type="text" placeholder="Buscar por email, nombre o usuario..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm" />
                    </div>

                    <div className="flex gap-2 bg-muted/50 p-1 rounded-xl border border-border">
                        {['all', 'client', 'delivery', 'produccion', 'admin'].map(f => (
                            <button
                                key={f}
                                onClick={() => setRoleFilter(f as any)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    roleFilter === f 
                                        ? 'bg-primary text-white shadow-sm' 
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {f === 'all' ? 'Todos' : f === 'client' ? 'Clientes' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                        <Loader2 size={24} className="animate-spin text-primary" /><span>Cargando usuarios...</span>
                    </div>
                )}
                {error && !loading && (
                    <div className="flex items-center gap-3 p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600">
                        <AlertCircle size={20} /><span className="font-medium">{error}</span>
                    </div>
                )}
                {!loading && !error && users.length === 0 && (
                    <div className="text-center py-20 bg-card rounded-2xl border border-border">
                        <Users size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                        <p className="font-medium text-muted-foreground">No hay usuarios registrados</p>
                    </div>
                )}

                {!loading && !error && users.length > 0 && (
                    <div className="bg-card rounded-2xl border border-border overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Teléfono</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Origen / Campaña</th>
                                    <th className="px-6 py-4">Actividad</th>
                                    <th className="px-6 py-4 text-right">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(u => (
                                    <tr key={u.id} className="hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => openUserDetail(u)}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {u.profile?.avatar_url ? (
                                                    <img src={u.profile.avatar_url?.startsWith('http') || u.profile.avatar_url?.startsWith('data:') ? u.profile.avatar_url : `${API_URL}${u.profile.avatar_url}`} className="w-9 h-9 rounded-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><User size={16} /></div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-sm">{u.profile?.full_name || u.email || '—'}</p>
                                                        {u.account_status === 'PENDING_APPROVAL' && (
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                                                Pendiente Aprobación
                                                            </span>
                                                        )}
                                                    </div>
                                                    {u.profile?.phone && <p className="text-xs text-muted-foreground">{u.profile.phone}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail size={14} className="text-muted-foreground shrink-0" />{u.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {u.profile?.phone ? (
                                                <div className="flex items-center gap-2"><Phone size={14} />{u.profile.phone}</div>
                                            ) : '—'}
                                        </td>
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                {updatingRole === u.id
                                                    ? <Loader2 size={16} className="animate-spin text-primary" />
                                                    : <Shield size={14} className={u.role === 'admin' ? 'text-primary' : 'text-muted-foreground'} />}
                                                <select
                                                    value={u.role || 'client'}
                                                    disabled={updatingRole === u.id}
                                                    onChange={e => handleRoleChange(u.id, e.target.value, e as any)}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-all disabled:opacity-60 ${ROLE_STYLES[u.role] || ROLE_STYLES.client}`}
                                                >
                                                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const utm = formatUtmDisplay(u);
                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border w-fit ${utm.badgeClass}`}>
                                                            <Target size={12} className="shrink-0" />
                                                            <span>{utm.sourceLabel}</span>
                                                        </span>
                                                        {utm.campaignLabel && (
                                                            <span className="text-[11px] font-semibold text-primary truncate max-w-[180px]" title={utm.campaignLabel}>
                                                                {utm.campaignLabel}
                                                            </span>
                                                        )}
                                                        {utm.detailLabel && !utm.campaignLabel && (
                                                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={utm.detailLabel}>
                                                                {utm.detailLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4 text-xs font-bold">
                                                <div className="flex items-center gap-1.5 text-slate-500" title="Direcciones">
                                                    <MapPin size={14} className="text-slate-400" />
                                                    {u.addresses?.length || 0}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-500" title="Pedidos">
                                                    <ShoppingBag size={14} className="text-slate-400" />
                                                    {u.orders?.length || 0}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <ChevronRight size={18} className="ml-auto text-muted-foreground" />
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Sin resultados para "{search}"</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Detail slide-over */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
                    {/* Panel */}
                    <aside className="w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                {selectedUser.profile?.avatar_url ? (
                                    <img src={selectedUser.profile.avatar_url?.startsWith('http') || selectedUser.profile.avatar_url?.startsWith('data:') ? selectedUser.profile.avatar_url : `${API_URL}${selectedUser.profile.avatar_url}`} className="w-12 h-12 rounded-full object-cover" alt="" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                                        {(selectedUser.profile?.full_name || selectedUser.email)?.[0]?.toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-lg leading-tight">{selectedUser.profile?.full_name || selectedUser.email || 'Sin nombre'}</p>
                                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-muted rounded-full"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {loadingDetail && (
                                <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-primary" /></div>
                            )}

                            {selectedUser.account_status === 'PENDING_APPROVAL' && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                        <Shield size={16} />
                                        <span>Cuenta B2B Pendiente de Aprobación</span>
                                    </div>
                                    <p className="text-xs text-amber-900/80 leading-relaxed">
                                        Este cliente comercial está a la espera de autorización para habilitar el acceso a pedidos.
                                    </p>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.patch(`/users/${selectedUser.id}/approve`, { account_status: 'APPROVED' });
                                                setSelectedUser({ ...selectedUser, account_status: 'APPROVED' });
                                                setUsers(users.map(u => u.id === selectedUser.id ? { ...u, account_status: 'APPROVED' } : u));
                                            } catch (e: any) {
                                                alert('Error aprobando cuenta: ' + e.message);
                                            }
                                        }}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <CheckCircle2 size={15} />
                                        Aprobar Cuenta Comercial
                                    </button>
                                </div>
                            )}

                            {/* Profile info */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Información Personal</h3>
                                <div className="bg-muted/40 rounded-2xl p-5 space-y-3 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono text-xs">{selectedUser.id.slice(0, 16)}…</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{selectedUser.email}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">Teléfono</span><span>{selectedUser.profile?.phone || '—'}</span></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Rol</span>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${ROLE_STYLES[selectedUser.role] || ROLE_STYLES.client}`}>
                                            {selectedUser.role?.charAt(0).toUpperCase()}{selectedUser.role?.slice(1)}
                                        </span>
                                    </div>
                                    {selectedUser.role !== 'admin' && (
                                        <div className="pt-3 border-t border-border/50 flex justify-end">
                                            <button
                                                onClick={() => setResetPasswordModal(selectedUser)}
                                                className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all cursor-pointer"
                                            >
                                                Restablecer Contraseña
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* UTM Attribution / Origen de Registro */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                    <Target size={14} />Origen de Registro / Atribución UTM
                                </h3>
                                <div className="bg-muted/40 rounded-2xl p-4 text-sm space-y-2 border border-border">
                                    {(() => {
                                        const utm = formatUtmDisplay(selectedUser);
                                        return (
                                            <>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground text-xs">Canal / Fuente:</span>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${utm.badgeClass}`}>
                                                        <Target size={12} />
                                                        {utm.sourceLabel}
                                                    </span>
                                                </div>
                                                {selectedUser.utm_source && (
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">utm_source:</span>
                                                        <span className="font-mono font-medium">{selectedUser.utm_source}</span>
                                                    </div>
                                                )}
                                                {selectedUser.utm_medium && (
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">utm_medium:</span>
                                                        <span className="font-mono">{selectedUser.utm_medium}</span>
                                                    </div>
                                                )}
                                                {selectedUser.utm_campaign && (
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">utm_campaign:</span>
                                                        <span className="font-mono font-bold text-primary">{selectedUser.utm_campaign}</span>
                                                    </div>
                                                )}
                                                {selectedUser.utm_content && (
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">utm_content:</span>
                                                        <span className="font-mono">{selectedUser.utm_content}</span>
                                                    </div>
                                                )}
                                                {utm.isDirect && (
                                                    <p className="text-xs text-muted-foreground italic pt-1">
                                                        Registro directo sin parámetros de campaña publicitaria.
                                                    </p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </section>

                            {/* Addresses */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                    <MapPin size={14} />Direcciones ({selectedUser.addresses?.length || 0})
                                </h3>
                                {!selectedUser.addresses?.length ? (
                                    <p className="text-sm text-muted-foreground italic">Sin direcciones guardadas.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedUser.addresses.map(addr => (
                                            <div key={addr.id} className="bg-muted/40 rounded-2xl p-4 text-sm relative group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 pr-12">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold">{addr.address}</p>
                                                            {addr.is_default && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">Principal</span>}
                                                        </div>
                                                        <p className="text-muted-foreground text-xs">{[addr.city, addr.state, addr.zip_code, addr.country].filter(Boolean).join(', ')}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => setEditingAddress(addr)}
                                                        className="absolute top-4 right-4 p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                        title="Editar dirección"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Orders */}
                            <section>
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                                    <ShoppingBag size={14} />Pedidos ({selectedUser.orders?.length || 0})
                                </h3>
                                {!selectedUser.orders?.length ? (
                                    <p className="text-sm text-muted-foreground italic">Sin pedidos registrados.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedUser.orders.slice().reverse().map(order => (
                                            <div key={order.id} className="bg-muted/40 rounded-2xl p-4 text-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Clock size={12} />
                                                            <span className="text-xs">{new Date(order.created_at).toLocaleDateString('es')}</span>
                                                        </div>
                                                        <span className="font-bold text-primary">${Number(order.total || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setAssigningOrder(assigningOrder === order.id ? null : order.id); }}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-black uppercase hover:bg-primary/20 transition-all"
                                                            >
                                                                <Truck size={12} /> Asignar
                                                            </button>
                                                            {assigningOrder === order.id && (
                                                                <div className="absolute right-0 bottom-full mb-2 w-48 bg-white shadow-2xl border border-border rounded-xl z-10 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
                                                                    <p className="px-3 py-2 text-[10px] font-black uppercase text-muted-foreground bg-muted">Repartidores</p>
                                                                    <div className="max-h-40 overflow-y-auto">
                                                                        {deliveryUsers.map(d => (
                                                                            <button 
                                                                                key={d.id} 
                                                                                onClick={() => handleAssignOrder(order.id, d.id)}
                                                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-primary/10 transition-colors border-t border-border"
                                                                            >
                                                                                {d.profile?.full_name || d.email}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); window.location.href = `/admin/orders?search=${order.id}`; }}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground border border-border rounded-lg text-[10px] font-black uppercase hover:bg-muted-foreground/10 transition-all font-sans"
                                                        >
                                                            Ver Detalle
                                                        </button>
                                                    </div>
                                                </div>
                                                {order.items && order.items.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                                                        {order.items.map(item => (
                                                            <div key={item.id} className="flex flex-col gap-1 py-1 border-b border-border/10 last:border-0">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex flex-col flex-1">
                                                                        <span className="font-semibold text-foreground text-xs">{item.quantity} x {item.product?.name || 'Producto'}</span>
                                                                        {item.product?.description && (
                                                                            <span className="text-[10px] text-muted-foreground italic line-clamp-2 mt-0.5 leading-tight">{item.product.description}</span>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-bold text-primary text-xs ml-4">
                                                                        ${((Number(item.price_at_time) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                             {/* Discounts Section (Only for Clients) */}
                             {selectedUser.role === 'client' && (
                                <section className="pt-8 border-t border-border">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
                                        <AlertCircle size={16} /> Descuentos Especiales
                                    </h3>

                                    {/* General Discount */}
                                    <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 mb-8">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground mb-3 block">Descuento General (%)</label>
                                        <div className="flex gap-3">
                                            <div className="relative flex-1">
                                                <input 
                                                    type="number" 
                                                    value={generalDiscount}
                                                    onChange={e => setGeneralDiscount(Number(e.target.value))}
                                                    placeholder="Ej: 10"
                                                    className="w-full pl-6 pr-10 py-3 rounded-xl border border-primary/30 outline-none focus:ring-2 focus:ring-primary/20 font-bold bg-white"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-primary">%</span>
                                            </div>
                                            <button 
                                                onClick={handleUpdateGeneralDiscount}
                                                disabled={isSavingDiscount}
                                                className="bg-primary text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                                            >
                                                {isSavingDiscount ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground mt-3 font-medium italic">Se aplicará a todos los productos del pedido.</p>
                                    </div>

                                    {/* Delivery Fee */}
                                    <div className="bg-amber-50/50 border border-amber-200 rounded-[2rem] p-6 mb-8">
                                        <label className="text-[10px] font-black uppercase text-amber-700/60 mb-3 block">Cargo por Envío (Delivery Fee)</label>
                                        <div className="flex gap-3">
                                            <div className="relative flex-1">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-amber-600">$</span>
                                                <input 
                                                    type="number" 
                                                    value={deliveryFee}
                                                    onChange={e => setDeliveryFee(Number(e.target.value))}
                                                    placeholder="Ej: 15.00"
                                                    className="w-full pl-8 pr-6 py-3 rounded-xl border border-amber-300 outline-none focus:ring-2 focus:ring-amber-500/20 font-bold bg-white text-amber-900"
                                                />
                                            </div>
                                            <button 
                                                onClick={handleUpdateDeliveryFee}
                                                disabled={isSavingFee}
                                                className="bg-amber-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                                            >
                                                {isSavingFee ? <Loader2 size={16} className="animate-spin" /> : 'Establecer'}
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-amber-600/70 mt-3 font-medium italic">Este monto se sumará al total en cada pedido de este cliente.</p>
                                    </div>

                                    {/* Product Specific Discounts */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-foreground">Descuentos por Producto</h4>
                                            <span className="text-[10px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{productDiscounts.length}</span>
                                        </div>

                                        {/* List */}
                                        <div className="space-y-3">
                                            {productDiscounts.map(pd => (
                                                <div key={pd.id} className="flex justify-between items-center p-4 bg-white border border-border rounded-xl group hover:border-primary/30 transition-all">
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <p className="font-bold text-xs truncate uppercase tracking-tight">{pd.product?.name || 'Producto'}</p>
                                                        <div className="flex gap-2 mt-1">
                                                            {pd.discount_percentage ? (
                                                                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-lg border border-green-100 italic">-{pd.discount_percentage}% desc.</span>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 italic">Precio: ${pd.special_price}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteProductDiscount(pd.id)}
                                                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {productDiscounts.length === 0 && (
                                                <div className="py-8 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
                                                    <p className="text-xs text-muted-foreground italic tracking-tight">Sin descuentos específicos aún.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Add New Product Discount */}
                                        <div className="bg-card border border-border rounded-3xl p-6 shadow-xl shadow-foreground/5 space-y-4">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.1em]">Nuevo Descuento Producto</p>
                                            
                                            {/* Search */}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar producto..." 
                                                    value={pdSearch}
                                                    onChange={e => setPdSearch(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                                />
                                                {pdSearch && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border shadow-2xl rounded-2xl z-20 max-h-48 overflow-y-auto">
                                                        {availableProducts
                                                            .filter(p => p.name.toLowerCase().includes(pdSearch.toLowerCase()))
                                                            .map(p => (
                                                                <button 
                                                                    key={p.id}
                                                                    onClick={() => { setSelectedPdProduct(p); setPdSearch(''); }}
                                                                    className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-primary/5 border-b border-border/50 last:border-0 flex justify-between"
                                                                >
                                                                    <span>{p.name}</span>
                                                                    <span className="text-primary">${p.price}</span>
                                                                </button>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            {selectedPdProduct && (
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 mb-4 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase text-primary/60 mb-0.5">Producto Seleccionado</p>
                                                            <p className="font-bold text-sm tracking-tight">{selectedPdProduct.name}</p>
                                                        </div>
                                                        <button onClick={() => setSelectedPdProduct(null)} className="p-1.5 hover:bg-primary/10 rounded-full text-primary"><X size={16} /></button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block px-1">Descuento (%)</label>
                                                            <div className="relative">
                                                                <input type="number" value={pdPercent} onChange={e => { setPdPercent(e.target.value); if(e.target.value) setPdPrice(''); }} placeholder="Ej: 15" className="w-full pl-4 pr-8 py-2.5 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/20 text-xs font-bold bg-white" />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-end justify-center text-[10px] font-bold text-muted-foreground mb-3">ó</div>
                                                        <div className="col-start-1 col-end-3">
                                                            <label className="text-[9px] font-black uppercase text-muted-foreground mb-1 block px-1">Precio Especial ($)</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                                                <input type="number" value={pdPrice} onChange={e => { setPdPrice(e.target.value); if(e.target.value) setPdPercent(''); }} placeholder="Ej: 45.00" className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary/20 text-xs font-bold bg-white" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={handleAddProductDiscount}
                                                        disabled={isSavingDiscount || (!pdPercent && !pdPrice)}
                                                        className="w-full py-3.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-neutral-800 transition-all disabled:opacity-30"
                                                    >
                                                        {isSavingDiscount ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Guardar Descuento Item'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                             )}
                         </div>
                    </aside>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl bg-green-600 text-white font-semibold text-sm animate-fade-in">
                    <CheckCircle2 size={20} />{toast}
                </div>
            )}

            {/* Edit Address Modal */}
            {editingAddress && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingAddress(null)} />
                    <div className="bg-background w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-zoom-in">
                        <div className="p-8 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-black">Editar Dirección</h2>
                            <button onClick={() => setEditingAddress(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateAddress} className="p-8 space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Dirección</label>
                                <input 
                                    type="text" 
                                    value={editingAddress.address} 
                                    onChange={e => setEditingAddress({...editingAddress, address: e.target.value})}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Ciudad</label>
                                    <input 
                                        type="text" 
                                        value={editingAddress.city} 
                                        onChange={e => setEditingAddress({...editingAddress, city: e.target.value})}
                                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Estado</label>
                                    <input 
                                        type="text" 
                                        value={editingAddress.state || ''} 
                                        onChange={e => setEditingAddress({...editingAddress, state: e.target.value})}
                                        className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-border">
                                <button 
                                    type="button" 
                                    onClick={() => setEditingAddress(null)}
                                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-border rounded-2xl hover:bg-muted transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={savingAddr}
                                    className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {savingAddr ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetPasswordModal(null)} />
                    <div className="bg-background w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-zoom-in">
                        <div className="p-8 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-black">Restablecer Contraseña</h2>
                            <button onClick={() => setResetPasswordModal(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResetPasswordSubmit} className="p-8 space-y-4">
                            <p className="text-xs text-muted-foreground font-medium">
                                Restableciendo contraseña para <strong>{resetPasswordModal.profile?.full_name || resetPasswordModal.email}</strong>. El usuario tendrá que cambiarla obligatoriamente al ingresar.
                            </p>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Nueva Contraseña (mín. 8 caracteres)</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-border">
                                <button 
                                    type="button" 
                                    onClick={() => setResetPasswordModal(null)}
                                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-border rounded-2xl hover:bg-muted transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isResettingPwd}
                                    className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isResettingPwd ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Staff Modal */}
            {showNewStaffModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewStaffModal(false)} />
                    <div className="bg-background w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-zoom-in">
                        <div className="p-8 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-black">Nuevo Usuario Staff</h2>
                            <button onClick={() => setShowNewStaffModal(false)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateStaffSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Nombre Completo</label>
                                <input 
                                    type="text" 
                                    value={newStaffName} 
                                    onChange={e => setNewStaffName(e.target.value)}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Email</label>
                                <input 
                                    type="email" 
                                    value={newStaffEmail} 
                                    onChange={e => setNewStaffEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Contraseña Temporal (mín. 8 caracteres)</label>
                                <input 
                                    type="password" 
                                    value={newStaffPassword} 
                                    onChange={e => setNewStaffPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block px-1">Rol</label>
                                <select 
                                    value={newStaffRole} 
                                    onChange={e => setNewStaffRole(e.target.value as any)}
                                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-xs"
                                >
                                    <option value="delivery">Delivery</option>
                                    <option value="produccion">Producción</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-border">
                                <button 
                                    type="button" 
                                    onClick={() => setShowNewStaffModal(false)}
                                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-border rounded-2xl hover:bg-muted transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isCreatingStaff}
                                    className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isCreatingStaff ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
