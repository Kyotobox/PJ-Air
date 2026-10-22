'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import {
    Users, Search, Loader2, AlertCircle, User, Mail, Phone,
    CheckCircle2, X, MapPin, ShoppingBag, ChevronRight, Clock, Edit, Trash2,
    ChevronLeft, ListFilter, Percent, Tag, DollarSign, CreditCard, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';

interface Address { id: string; address: string; city: string; state?: string; zip_code?: string; country?: string; is_default?: boolean; }
interface OrderItem { 
    id: string; 
    quantity: number; 
    price_at_time: number; 
    product?: { name: string; description?: string; };
}
interface Order { 
    id: string; 
    total: number; 
    status: string; 
    created_at: string; 
    delivery_date?: string; 
    payment_status?: string;
    delivery_fee_charged?: number;
    items?: OrderItem[]; 
}
interface UserRecord {
    id: string; email: string; role: string; general_discount?: number; delivery_fee?: number;
    account_type?: 'cash' | 'credit';
    credit_limit?: number;
    credit_override?: boolean;
    profile?: { full_name?: string; username?: string; phone?: string; avatar_url?: string; nickname?: string; };
    addresses?: Address[];
    orders?: Order[];
}

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};

export default function AdminClientsPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [toast, setToast] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [addrFormData, setAddrFormData] = useState<Partial<Address>>({});
    const [savingAddr, setSavingAddr] = useState(false);
    
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

    // Credit states
    const [accountType, setAccountType] = useState<'cash' | 'credit'>('cash');
    const [creditLimit, setCreditLimit] = useState<number>(0);
    const [creditOverride, setCreditOverride] = useState<boolean>(false);
    const [isSavingCredit, setIsSavingCredit] = useState(false);
    const [creditSummary, setCreditSummary] = useState<any>(null);

    // Nickname states
    const [nickname, setNickname] = useState<string>('');
    const [isSavingNickname, setIsSavingNickname] = useState(false);

    // Password reset states
    const [resetPasswordModal, setResetPasswordModal] = useState<UserRecord | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [isResettingPwd, setIsResettingPwd] = useState(false);

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

    useEffect(() => { 
        fetchUsers(); 
        fetchProducts();
    }, []);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    const fetchUsers = async () => {
        try {
            setLoading(true); setError(null);
            const data = await api.get('/users');
            // Filter only clients
            const clients = (Array.isArray(data) ? data : []).filter(u => u.role === 'client');
            setUsers(clients);
        } catch (err: any) {
            setError(err.message || 'No se pudieron cargar los clientes');
        } finally { setLoading(false); }
    };

    const fetchProducts = async () => {
        try {
            const data = await api.get('/products');
            setAvailableProducts(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Error fetching products', err); }
    };

    const openUserDetail = async (user: UserRecord) => {
        setSelectedUser(user);
        setGeneralDiscount(Number(user.general_discount) || 0);
        setDeliveryFee(Number(user.delivery_fee) || 0);
        setNickname(user.profile?.nickname || '');
        setAccountType(user.account_type || 'cash');
        setCreditLimit(Number(user.credit_limit) || 0);
        setCreditOverride(Boolean(user.credit_override));
        
        try {
            setLoadingDetail(true);
            const detail = await api.get(`/users/${user.id}`) as any;
            setSelectedUser(detail);
            setGeneralDiscount(Number(detail.general_discount) || 0);
            setDeliveryFee(Number(detail.delivery_fee) || 0);
            setNickname(detail.profile?.nickname || '');
            setAccountType(detail.account_type || 'cash');
            setCreditLimit(Number(detail.credit_limit) || 0);
            setCreditOverride(Boolean(detail.credit_override));
            
            // Get product discounts
            const discounts = await api.get(`/users/${detail.id}/product-discounts`) as any[];
            setProductDiscounts(discounts || []);

            // Get live credit summary
            try {
                const summary = await api.get(`/users/${detail.id}/credit-summary`);
                setCreditSummary(summary);
            } catch {
                setCreditSummary(null);
            }
        } catch (err) {
            console.error("Error loading user details", err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleUpdateCredit = async () => {
        if (!selectedUser) return;
        setIsSavingCredit(true);
        try {
            await api.patch(`/users/${selectedUser.id}/credit`, {
                account_type: accountType,
                credit_limit: creditLimit,
                credit_override: creditOverride,
            });
            showToast('✅ Configuración de crédito actualizada');
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? {
                ...u,
                account_type: accountType,
                credit_limit: creditLimit,
                credit_override: creditOverride,
            } : u));
            setSelectedUser(prev => prev ? {
                ...prev,
                account_type: accountType,
                credit_limit: creditLimit,
                credit_override: creditOverride,
            } : null);

            // Refresh credit summary
            const summary = await api.get(`/users/${selectedUser.id}/credit-summary`);
            setCreditSummary(summary);
        } catch (err: any) {
            showToast(`❌ ${err.message}`);
        } finally {
            setIsSavingCredit(false);
        }
    };

    const handleMarkOrderPaid = async (orderId: string) => {
        if (!selectedUser) return;
        try {
            await api.patch(`/orders/${orderId}/payment-status`, { payment_status: 'paid' });
            showToast('✅ Orden marcada como pagada');
            // Refresh user and credit summary
            const detail = await api.get(`/users/${selectedUser.id}`) as any;
            setSelectedUser(detail);
            const summary = await api.get(`/users/${selectedUser.id}/credit-summary`);
            setCreditSummary(summary);
        } catch (err: any) {
            showToast(`❌ ${err.message}`);
        }
    };

    const handleUpdateNickname = async () => {
        if (!selectedUser) return;
        setIsSavingNickname(true);
        try {
            await api.patch(`/users/${selectedUser.id}/profile`, { nickname });
            showToast('✅ Nickname actualizado');
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, profile: { ...u.profile, nickname } } : u));
            setSelectedUser(prev => prev ? { ...prev, profile: { ...prev.profile, nickname } } : null);
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingNickname(false); }
    };

    const handleUpdateGeneralDiscount = async () => {
        if (!selectedUser) return;
        setIsSavingDiscount(true);
        try {
            await api.patch(`/users/${selectedUser.id}/general-discount`, { discount: generalDiscount });
            showToast('✅ Descuento general actualizado');
            // Update local users list
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, general_discount: generalDiscount } : u));
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingDiscount(false); }
    };

    const handleUpdateDeliveryFee = async () => {
        if (!selectedUser) return;
        setIsSavingFee(true);
        try {
            await api.patch(`/users/${selectedUser.id}/delivery-fee`, { fee: deliveryFee });
            showToast('✅ Tarifa de envío actualizada');
            // Update local users list
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, delivery_fee: deliveryFee } : u));
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setIsSavingFee(false); }
    };

    const handleUpdateAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAddress) return;
        setSavingAddr(true);
        try {
            await api.patch(`/addresses/${editingAddress.id}`, addrFormData);
            showToast('✅ Dirección actualizada');
            
            // Refresh selected user data
            if (selectedUser) {
                const refreshed = await api.get(`/users/${selectedUser.id}`) as any;
                setSelectedUser(refreshed);
            }
            setEditingAddress(null);
        } catch (err: any) { showToast(`❌ ${err.message}`); }
        finally { setSavingAddr(false); }
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
        finally { setIsSavingDiscount(true); setTimeout(() => setIsSavingDiscount(false), 500); }
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
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            u.email?.toLowerCase().includes(s) ||
            u.profile?.full_name?.toLowerCase().includes(s) ||
            u.profile?.username?.toLowerCase().includes(s)
        );
    }).sort((a, b) => {
        const nameA = a.profile?.full_name || a.email || '';
        const nameB = b.profile?.full_name || b.email || '';
        return nameA.localeCompare(nameB);
    });

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginatedUsers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="flex min-h-screen bg-[#F8FAFC]">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-auto">
                {/* Header */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Clientes</h1>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                           <Users size={16} /> {filtered.length} Clientes registrados
                        </p>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, email o ID..." 
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700" 
                        />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl text-slate-500 text-sm font-bold border border-slate-100">
                        <ListFilter size={16} />
                        Filtro: Clientes
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                <th className="px-8 py-5">Nombre / Usuario</th>
                                <th className="px-8 py-5">Contacto</th>
                                <th className="px-6 py-5">Cuenta / Crédito</th>
                                <th className="px-8 py-5 text-center">Info</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={32} /></td></tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr><td colSpan={5} className="py-20 text-center text-slate-500 font-medium italic">No se encontraron clientes</td></tr>
                            ) : paginatedUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shadow-inner">
                                                {u.profile?.avatar_url ? <img src={u.profile.avatar_url?.startsWith('http') || u.profile.avatar_url?.startsWith('data:') ? u.profile.avatar_url : `${API_URL}${u.profile.avatar_url}`} className="w-full h-full rounded-2xl object-cover" /> : (u.profile?.full_name || u.email || '?')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{u.profile?.nickname ? `${u.profile.nickname} (${u.profile.full_name})` : (u.profile?.full_name || 'Sin Nombre')}</p>
                                                <p className="text-xs text-slate-400 font-medium italic">@{u.profile?.username || 'sin_usuario'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Mail size={14} className="text-slate-300" />{u.email}</div>
                                            {u.profile?.phone && <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><Phone size={14} className="text-slate-300" />{u.profile.phone}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1 items-start">
                                            {u.account_type === 'credit' ? (
                                                <>
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700">
                                                        Crédito
                                                    </span>
                                                    <span className="text-xs font-black text-slate-700">
                                                        ${Number(u.credit_limit || 0).toLocaleString()}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                                                    Contado
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="inline-flex gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-400" title="Direcciones">
                                                <MapPin size={14} /> {u.addresses?.length || 0}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-400" title="Pedidos">
                                                <ShoppingBag size={14} /> {u.orders?.length || 0}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button 
                                            onClick={() => openUserDetail(u)}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg shadow-slate-200 hover:shadow-primary/30"
                                        >
                                            Editar <ChevronRight size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-8 py-6 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400">
                                Mostrando <span className="text-slate-900">{(currentPage-1)*ITEMS_PER_PAGE + 1}</span> a <span className="text-slate-900">{Math.min(currentPage*ITEMS_PER_PAGE, filtered.length)}</span> de <span className="text-slate-900">{filtered.length}</span> resultados
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(c => c - 1)}
                                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                                ><ChevronLeft size={18} /></button>
                                {[...Array(totalPages)].map((_, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-10 h-10 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(c => c + 1)}
                                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                                ><ChevronRight size={18} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Detail Modal Overlay */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
                    <aside className="relative w-full max-w-2xl h-full bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden animate-slide-in-right">
                        {/* Detail Header */}
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-[2rem] bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-xl">
                                    {(selectedUser.profile?.full_name || selectedUser.email)?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedUser.profile?.full_name || 'Sin Nombre'}</h2>
                                    <p className="text-slate-400 font-bold text-sm tracking-wide">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"><X size={20} /></button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-12 pb-32">
                            {loadingDetail && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}

                            {/* Section: General Info */}
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-slate-400">Datos del Cliente</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Teléfono</label>
                                        <p className="font-bold text-slate-700">{selectedUser.profile?.phone || 'No registrado'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Usuario</label>
                                        <p className="font-bold text-slate-700">@{selectedUser.profile?.username || '—'}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => setResetPasswordModal(selectedUser)}
                                        className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all cursor-pointer"
                                    >
                                        Restablecer Contraseña
                                    </button>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mt-4 flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nickname (Uso Interno)</label>
                                        <input
                                            type="text"
                                            value={nickname}
                                            onChange={e => setNickname(e.target.value)}
                                            placeholder="Nombre alternativo o ID interno..."
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700"
                                        />
                                    </div>
                                    <button
                                        onClick={handleUpdateNickname}
                                        disabled={isSavingNickname}
                                        className="px-5 py-2.5 bg-slate-900 hover:bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 h-[38px] flex items-center justify-center"
                                    >
                                        {isSavingNickname ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </section>

                            {/* Section: Addresses */}
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-slate-400">Direcciones</h3>
                                </div>
                                <div className="grid gap-3">
                                    {selectedUser.addresses?.map(addr => (
                                        <div key={addr.id} className="p-5 bg-white border border-slate-200 rounded-[2rem] flex items-center justify-between group hover:border-blue-400 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><MapPin size={18} /></div>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{addr.address}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{addr.city}, {addr.state}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {addr.is_default && <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider mr-2">Principal</span>}
                                                <button 
                                                    onClick={() => { setEditingAddress(addr); setAddrFormData(addr); }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-all"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )) || <p className="text-sm font-medium text-slate-400 italic">No hay direcciones guardadas</p>}
                                </div>
                            </section>

                            {/* Section: B2B Credit & Financial Governance */}
                            <section className="pt-8 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                        <h3 className="text-xs font-black uppercase tracking-[.2em] text-slate-400">
                                            Crédito B2B y Condiciones Financieras
                                        </h3>
                                    </div>
                                    {accountType === 'credit' && creditSummary && (
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            creditSummary.is_overdraft && !creditSummary.credit_override
                                                ? 'bg-red-100 text-red-700'
                                                : creditSummary.is_overdraft && creditSummary.credit_override
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {creditSummary.is_overdraft && !creditSummary.credit_override
                                                ? '🚫 Límite Excedido (Bloqueado)'
                                                : creditSummary.is_overdraft && creditSummary.credit_override
                                                ? '⚠️ Sobregiro Autorizado'
                                                : '✅ Crédito al Día'}
                                        </span>
                                    )}
                                </div>

                                <div className="bg-slate-50/80 rounded-[2.5rem] p-8 border border-slate-200 space-y-6">
                                    {/* Account Type Selector */}
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">
                                            Modalidad de Pago Comercial
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setAccountType('cash')}
                                                className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                                                    accountType === 'cash'
                                                        ? 'bg-white border-slate-900 shadow-md text-slate-900'
                                                        : 'bg-transparent border-slate-200 text-slate-400 hover:border-slate-300'
                                                }`}
                                            >
                                                <DollarSign size={20} className={accountType === 'cash' ? 'text-primary' : ''} />
                                                <div className="text-left">
                                                    <p className="font-black text-xs uppercase">Contado / Cash</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Pago con Stripe</p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setAccountType('credit')}
                                                className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                                                    accountType === 'credit'
                                                        ? 'bg-white border-blue-600 shadow-md text-blue-900'
                                                        : 'bg-transparent border-slate-200 text-slate-400 hover:border-slate-300'
                                                }`}
                                            >
                                                <CreditCard size={20} className={accountType === 'credit' ? 'text-blue-600' : ''} />
                                                <div className="text-left">
                                                    <p className="font-black text-xs uppercase">Línea de Crédito</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Facturación periódica</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Credit Fields (only if account_type === 'credit') */}
                                    {accountType === 'credit' && (
                                        <div className="space-y-6 pt-4 border-t border-slate-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
                                                        Límite de Crédito Autorizado ($)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="50"
                                                        value={creditLimit}
                                                        onChange={e => setCreditLimit(Number(e.target.value) || 0)}
                                                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-300 transition-all shadow-inner"
                                                    />
                                                </div>

                                                <div className="flex flex-col justify-center">
                                                    <label className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
                                                        <input
                                                            type="checkbox"
                                                            checked={creditOverride}
                                                            onChange={e => setCreditOverride(e.target.checked)}
                                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                                        />
                                                        <div>
                                                            <p className="text-xs font-black text-slate-800">Sobregiro Excepcional</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">Permite ordenar aunque supere el límite</p>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Live Credit Health Balance */}
                                            {creditSummary && (
                                                <div className="grid grid-cols-3 gap-3 p-5 bg-white rounded-2xl border border-slate-200 text-center">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Límite</p>
                                                        <p className="text-base font-black text-slate-800">${Number(creditSummary.credit_limit || 0).toFixed(2)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 mb-0.5">Utilizado</p>
                                                        <p className="text-base font-black text-amber-600">${Number(creditSummary.used_credit || 0).toFixed(2)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-green-600 mb-0.5">Disponible</p>
                                                        <p className="text-base font-black text-green-600">${Number(creditSummary.available_credit || 0).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={handleUpdateCredit}
                                            disabled={isSavingCredit}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSavingCredit ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                            {isSavingCredit ? 'Guardando...' : 'Guardar Parámetros de Crédito'}
                                        </button>
                                    </div>

                                    {/* Unpaid orders reconciliation */}
                                    {selectedUser.orders && selectedUser.orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length > 0 && (
                                        <div className="pt-4 border-t border-slate-200 space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                Órdenes con Saldo Pendiente ({selectedUser.orders.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length})
                                            </p>
                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                {selectedUser.orders
                                                    .filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled')
                                                    .map(order => (
                                                        <div key={order.id} className="p-3.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                                                            <div>
                                                                <p className="font-black text-slate-800">#{order.id.slice(0, 8)} • ${Number(order.total).toFixed(2)}</p>
                                                                <p className="text-[10px] text-slate-400">{order.delivery_date ? `Entrega: ${order.delivery_date}` : new Date(order.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkOrderPaid(order.id)}
                                                                className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all border border-green-200"
                                                            >
                                                                Marcar Pagado ✓
                                                            </button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Section: Personalized Offers */}
                            <section className="pt-10 border-t border-slate-100">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-slate-400">Ofertas y Tarifas Especiales</h3>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mb-10">
                                    {/* General Discount */}
                                    <div className="bg-green-50/50 border border-green-200 rounded-[2.5rem] p-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-green-100 text-green-600 rounded-xl"><Percent size={18} /></div>
                                            <span className="text-xs font-black uppercase text-green-700">Descuento Global</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number" 
                                                value={generalDiscount}
                                                onChange={e => setGeneralDiscount(Number(e.target.value))}
                                                onFocus={e => (e.target.value === '0' || e.target.value === '1') && e.target.select()}
                                                className="w-full px-5 py-3.5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-green-300 font-black text-green-900 bg-white shadow-inner"
                                            />
                                            <button 
                                                onClick={handleUpdateGeneralDiscount}
                                                className="bg-green-600 text-white px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-green-700 transition-all"
                                            >
                                                OK
                                            </button>
                                        </div>
                                        <p className="text-[10px] font-bold text-green-600/60 mt-4 italic">Se aplica a toda la factura final.</p>
                                    </div>

                                    {/* Delivery Fee */}
                                    <div className="bg-amber-50/50 border border-amber-200 rounded-[2.5rem] p-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><DollarSign size={18} /></div>
                                            <span className="text-xs font-black uppercase text-amber-700">Costo Envío</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="number" 
                                                value={deliveryFee}
                                                onChange={e => setDeliveryFee(Number(e.target.value))}
                                                onFocus={e => (e.target.value === '0' || e.target.value === '1') && e.target.select()}
                                                className="w-full px-5 py-3.5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-amber-300 font-black text-amber-900 bg-white shadow-inner"
                                            />
                                            <button 
                                                onClick={handleUpdateDeliveryFee}
                                                className="bg-amber-600 text-white px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700 transition-all"
                                            >
                                                OK
                                            </button>
                                        </div>
                                        <p className="text-[10px] font-bold text-amber-600/60 mt-4 italic">Costo fijo de delivery para este cliente.</p>
                                    </div>
                                </div>

                                {/* Custom Products List */}
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-black text-slate-800 text-sm">Precios por Producto</h4>
                                        <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black">{productDiscounts.length}</span>
                                    </div>

                                    <div className="grid gap-3">
                                        {productDiscounts.map(pd => (
                                            <div key={pd.id} className="flex justify-between items-center p-5 bg-white border border-slate-200 rounded-3xl hover:border-primary/40 transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300"><Tag size={20} /></div>
                                                    <div>
                                                        <p className="font-black text-slate-800 text-xs uppercase">{pd.product?.name || 'Producto'}</p>
                                                        {pd.discount_percentage ? (
                                                            <span className="text-[10px] font-black text-green-600">OFERTA: -{pd.discount_percentage}%</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-primary">PRECIO FIJO: ${pd.special_price}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteProductDiscount(pd.id)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        ))}
                                        
                                        {/* Add NEW Discount Form */}
                                        <div className="mt-4 p-8 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 space-y-5">
                                            <p className="text-center text-[10px] font-black uppercase tracking-[.2em] text-slate-400 mb-2">Asignar Nueva Oferta</p>
                                            
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar producto para oferta..." 
                                                    value={pdSearch}
                                                    onChange={e => setPdSearch(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-white border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 shadow-sm"
                                                />
                                                {pdSearch && (
                                                    <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 shadow-2xl rounded-3xl z-20 max-h-56 overflow-y-auto p-2">
                                                        {availableProducts
                                                            .filter(p => p.name.toLowerCase().includes(pdSearch.toLowerCase()))
                                                            .map(p => (
                                                                <button key={p.id} onClick={() => { setSelectedPdProduct(p); setPdSearch(''); }} className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 rounded-2xl flex justify-between font-black text-xs uppercase tracking-tight">
                                                                    {p.name} <span className="text-primary">${p.price}</span>
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            {selectedPdProduct && (
                                                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 animate-fade-in">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <p className="font-black text-primary text-xs uppercase tracking-widest">{selectedPdProduct.name}</p>
                                                        <button onClick={() => setSelectedPdProduct(null)} className="text-slate-300 hover:text-slate-900"><X size={18} /></button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block px-2">Descuento %</label>
                                                            <input type="number" value={pdPercent} onChange={e => { setPdPercent(e.target.value); if(e.target.value) setPdPrice(''); }} onFocus={e => (e.target.value === '0' || e.target.value === '1') && e.target.select()} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700" placeholder="%" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block px-2">ó Precio $</label>
                                                            <input type="number" value={pdPrice} onChange={e => { setPdPrice(e.target.value); if(e.target.value) setPdPercent(''); }} onFocus={e => (e.target.value === '0' || e.target.value === '1') && e.target.select()} className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-700" placeholder="$" />
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={handleAddProductDiscount}
                                                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[.2em] shadow-xl shadow-slate-200 hover:bg-primary transition-all"
                                                    >
                                                        {isSavingDiscount ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar Oferta'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </aside>
                </div>
            )}

            {/* Address Edit Modal */}
            {editingAddress && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEditingAddress(null)} />
                    <div className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-black mb-6">Editar Dirección</h3>
                        <form onSubmit={handleUpdateAddress} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 px-4 mb-2 block">Calle y Altura</label>
                                <input 
                                    type="text" 
                                    value={addrFormData.address || ''} 
                                    onChange={e => setAddrFormData({ ...addrFormData, address: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    required 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 px-4 mb-2 block">Ciudad</label>
                                    <input 
                                        type="text" 
                                        value={addrFormData.city || ''} 
                                        onChange={e => setAddrFormData({ ...addrFormData, city: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 px-4 mb-2 block">Provincia</label>
                                    <input 
                                        type="text" 
                                        value={addrFormData.state || ''} 
                                        onChange={e => setAddrFormData({ ...addrFormData, state: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 pt-6">
                                <button type="button" onClick={() => setEditingAddress(null)} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancelar</button>
                                <button type="submit" disabled={savingAddr} className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-primary transition-all flex items-center justify-center">
                                    {savingAddr ? <Loader2 className="animate-spin" size={18} /> : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification Toast */}
            {toast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-8 py-5 rounded-[2.5rem] shadow-2xl bg-slate-900 text-white border border-white/10 animate-fade-in-up">
                    <CheckCircle2 size={24} className="text-green-400" />
                    <span className="font-black uppercase text-[10px] tracking-widest">{toast}</span>
                </div>
            )}
            {/* Reset Password Modal */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetPasswordModal(null)} />
                    <div className="bg-background w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-zoom-in">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-black">Restablecer Contraseña</h2>
                            <button onClick={() => setResetPasswordModal(null)} className="p-2 hover:bg-muted rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResetPasswordSubmit} className="p-8 space-y-4">
                            <p className="text-xs text-slate-500 font-medium">
                                Restableciendo contraseña para <strong>{resetPasswordModal.profile?.full_name || resetPasswordModal.email}</strong>. El usuario tendrá que cambiarla obligatoriamente al ingresar.
                            </p>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 px-1 mb-1 block">Nueva Contraseña (mín. 8 caracteres)</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setResetPasswordModal(null)}
                                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isResettingPwd}
                                    className="flex-1 py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-primary transition-all disabled:opacity-50"
                                >
                                    {isResettingPwd ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
