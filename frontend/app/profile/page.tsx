'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { User, MapPin, Mail, Phone, BadgeCheck, Loader2, Save, Plus, Trash2, CreditCard, Building2, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { API_URL } from '@/lib/config';
import { PhoneVerificationModal } from '@/components/auth/PhoneVerificationModal';
import { formatPhoneNumber } from '@/lib/firebase';

export default function ProfilePage() {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const { t, locale } = useLanguage();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        phone: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [isFetchingMethods, setIsFetchingMethods] = useState(true);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [deletingMethodId, setDeletingMethodId] = useState<string | null>(null);
    const [isAddingMethod, setIsAddingMethod] = useState(false);

    const fetchPaymentMethods = async () => {
        try {
            setIsFetchingMethods(true);
            const methods = await api.get('/payments/payment-methods') as any[];
            setPaymentMethods(Array.isArray(methods) ? methods : []);
        } catch (err) {
            console.warn('Error fetching payment methods:', err);
        } finally {
            setIsFetchingMethods(false);
        }
    };

    useEffect(() => {
        if (isAuthLoading) return;
        
        if (!user) {
            router.push('/auth/login');
            return;
        }

        const fetchUserData = async () => {
            try {
                const userData = await api.get(`/users/${user.id}`) as any;
                setProfile(userData.profile);
                setAddresses(userData.addresses || []);
                setFormData({
                    full_name: userData.profile?.full_name || '',
                    username: userData.profile?.username || '',
                    phone: userData.profile?.phone || ''
                });
            } catch (err) {
                console.error('Error fetching user data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
        fetchPaymentMethods();
    }, [user, isAuthLoading, router]);

    const handleDeletePaymentMethod = async (id: string) => {
        if (!confirm(locale === 'en' ? 'Remove this payment method?' : '¿Eliminar este método de pago?')) return;
        try {
            setDeletingMethodId(id);
            await api.delete(`/payments/payment-methods/${id}`);
            setPaymentMethods(prev => prev.filter(m => m.id !== id));
            setMessage({
                type: 'success',
                text: locale === 'en' ? 'Payment method removed successfully.' : 'Método de pago eliminado con éxito.'
            });
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || (locale === 'en' ? 'Failed to remove payment method' : 'Error al eliminar método de pago')
            });
        } finally {
            setDeletingMethodId(null);
        }
    };

    const handleOpenCustomerPortal = async () => {
        try {
            setIsOpeningPortal(true);
            const res = await api.post('/payments/customer-portal', {}) as { url: string };
            if (res?.url) {
                window.open(res.url, '_blank');
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || (locale === 'en' ? 'Could not open billing portal' : 'No se pudo abrir el portal de facturación')
            });
        } finally {
            setIsOpeningPortal(false);
        }
    };

    const handleAddNewPaymentMethod = async () => {
        try {
            setIsAddingMethod(true);
            const res = await api.post('/payments/setup-intent', {}) as { clientSecret: string };
            if (res?.clientSecret) {
                const portalRes = await api.post('/payments/customer-portal', {}).catch(() => null) as any;
                if (portalRes?.url) {
                    window.open(portalRes.url, '_blank');
                } else {
                    setMessage({
                        type: 'success',
                        text: locale === 'en' ? 'SetupIntent initialized. Use checkout or portal to register cards.' : 'SetupIntent iniciado. Puedes guardar tu tarjeta en checkout o portal.'
                    });
                }
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.message || (locale === 'en' ? 'Error setting up payment method' : 'Error al configurar método')
            });
        } finally {
            setIsAddingMethod(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/users/${user.id}/avatar`, {
                method: 'POST',
                body: uploadData,
            });
            
            if (response.ok) {
                const updatedProfile = await response.json();
                setProfile(updatedProfile);
                setMessage({ type: 'success', text: t.profile.avatarSuccess });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Upload failed:', response.status, errorData);
                throw new Error(errorData.message || (t.profile.avatarError));
            }
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setMessage({ type: 'error', text: err.message || t.profile.avatarError });
        } finally {
            setIsUploading(false);
        }
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const originalPhone = profile?.phone || '';
        const cleanOriginal = originalPhone.replace(/\D/g, '');
        const cleanNew = formData.phone.replace(/\D/g, '');

        // If phone changed, require SMS OTP verification
        if (cleanNew !== cleanOriginal) {
            if (cleanNew.length < 10) {
                setMessage({
                    type: 'error',
                    text: locale === 'en' ? 'Please enter a valid 10-digit phone number' : 'Ingresa un número de teléfono válido de 10 dígitos'
                });
                return;
            }
            setIsPhoneModalOpen(true);
            return;
        }

        setIsSaving(true);
        setMessage({ type: '', text: '' });
        try {
            await api.patch(`/users/${user.id}/profile`, formData);
            setProfile((prev: any) => ({ ...prev, ...formData }));
            setMessage({ type: 'success', text: t.profile.savedSuccess });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setMessage({ type: 'error', text: err.message || t.profile.passwordError });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhoneVerifiedAndSave = async (verifiedData: { phone: string; idToken?: string; verificationCode?: string }) => {
        if (!user) return;
        setIsSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const verifyRes = await api.post('/auth/verify-phone', {
                phone: verifiedData.phone,
                idToken: verifiedData.idToken,
                verificationCode: verifiedData.verificationCode,
            }) as any;

            await api.patch(`/users/${user.id}/profile`, {
                full_name: formData.full_name,
                username: formData.username,
            });

            const verifiedPhone = verifyRes.phone || verifiedData.phone;
            setProfile((prev: any) => ({
                ...prev,
                full_name: formData.full_name,
                username: formData.username,
                phone: verifiedPhone,
                phone_verified: true,
            }));

            setFormData((prev) => ({
                ...prev,
                phone: verifiedPhone,
            }));

            setMessage({
                type: 'success',
                text: locale === 'en' ? 'Phone verified and profile updated successfully!' : '¡Teléfono verificado y perfil actualizado con éxito!'
            });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err: any) {
            console.error('Error verifying phone:', err);
            setMessage({
                type: 'error',
                text: err.message || (locale === 'en' ? 'Failed to verify phone' : 'Error al verificar teléfono')
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelPhoneModal = () => {
        setIsPhoneModalOpen(false);
        setFormData((prev) => ({
            ...prev,
            phone: profile?.phone || '',
        }));
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordMessage({ type: 'error', text: t.profile.passwordMismatch });
            return;
        }
        
        setIsChangingPassword(true);
        setPasswordMessage({ type: '', text: '' });
        
        try {
            await api.patch('/auth/change-password', {
                userId: user.id,
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            setPasswordMessage({ type: 'success', text: t.profile.passwordSuccess });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setPasswordMessage({ type: '', text: '' }), 3000);
        } catch (err: any) {
            console.error('Error changing password:', err);
            setPasswordMessage({ type: 'error', text: err.message || t.profile.passwordError });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleDeleteAddress = async (id: string) => {
        if (!confirm(t.profile.deleteAddressConfirm)) return;
        try {
            await api.delete(`/addresses/${id}`);
            setAddresses(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error('Error deleting address:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t.profile.loadingProfile}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-20">
            <Navbar />

            <main className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Profile Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                            <div className="jhoanes-gradient p-8 text-white flex flex-col items-center">
                                <div 
                                    className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30 mb-4 backdrop-blur-md overflow-hidden cursor-pointer relative group"
                                    onClick={() => document.getElementById('avatar-input')?.click()}
                                >
                                    {profile?.avatar_url ? (
                                        <img 
                                            src={profile.avatar_url?.startsWith('http') || profile.avatar_url?.startsWith('data:') ? profile.avatar_url : `${API_URL}${profile.avatar_url}`} 
                                            alt="Avatar" 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User size={48} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus size={24} />
                                    </div>
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <Loader2 size={24} className="animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <input 
                                    id="avatar-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                                <h2 className="text-xl font-bold font-serif">{formData.full_name || (locale === 'en' ? 'User' : 'Usuario')}</h2>
                                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{t.profile.memberClient}</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <Mail size={16} className="text-primary" />
                                    <span className="truncate">{user?.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <BadgeCheck size={16} className="text-primary" />
                                    <span>{t.profile.verifiedAccount}</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => router.push('/profile/addresses/new')}
                            className="w-full premium-button bg-white text-primary border-2 border-primary/10 py-4 hover:bg-primary/5 shadow-none flex items-center justify-center gap-2 group"
                        >
                            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> {t.profile.addAddress}
                        </button>
                    </div>

                    {/* Editor Section */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Profile Editor */}
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <h3 className="text-xl font-bold font-serif mb-8 flex items-center gap-2">
                                <User className="text-primary" size={24} /> {t.profile.editInfo}
                            </h3>

                            <form onSubmit={handleProfileUpdate} className="space-y-6">
                                {message.text && (
                                    <div className={`p-4 rounded-2xl text-xs font-bold text-center animate-fade-in ${message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                        {message.text}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{t.profile.fullName}</label>
                                        <input 
                                            type="text"
                                            className="premium-input px-6 h-14 font-bold"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{t.profile.username}</label>
                                        <input 
                                            type="text"
                                            className="premium-input px-6 h-14 font-bold"
                                            value={formData.username}
                                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between ml-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.profile.contactPhone}</label>
                                        {profile?.phone_verified ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                <CheckCircle2 size={12} />
                                                <span>{locale === 'en' ? 'Verified ✓' : 'Verificado ✓'}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                {locale === 'en' ? 'Unverified' : 'No verificado'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="tel"
                                            className={`premium-input px-6 h-14 font-bold pl-12 ${profile?.phone_verified ? 'border-emerald-500/40' : ''}`}
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                                            required
                                        />
                                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        {profile?.phone_verified && (
                                            <CheckCircle2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600" />
                                        )}
                                    </div>
                                </div>

                                <button 
                                    disabled={isSaving}
                                    className="w-full premium-button jhoanes-gradient text-white py-4 shadow-xl flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {t.profile.save}</>}
                                </button>
                            </form>
                        </div>

                        {/* Saved Addresses */}
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <h3 className="text-xl font-bold font-serif mb-8 flex items-center gap-2">
                                <MapPin className="text-primary" size={24} /> {t.profile.savedAddresses}
                            </h3>

                            <div className="space-y-4">
                                {addresses.length > 0 ? (
                                    addresses.map((addr) => (
                                        <div key={addr.id} className="p-6 bg-white border border-border rounded-2xl flex justify-between items-start hover:border-primary/30 hover:shadow-md transition-all group">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                                    <MapPin size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm uppercase tracking-tight mb-1">{addr.alias}</h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">{addr.address}</p>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <span className="text-[8px] font-black uppercase tracking-widest bg-secondary text-primary px-2 py-0.5 rounded-full">Zone {addr.zone}</span>
                                                        {addr.is_default && <span className="text-[8px] font-black uppercase tracking-widest bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">{locale === 'en' ? 'Default' : 'Predeterminada'}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteAddress(addr.id)}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title={t.common.delete}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center bg-muted/20 rounded-3xl border border-dashed border-border/40">
                                        <p className="text-sm text-muted-foreground">{t.profile.noAddresses}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* B2B Payment Methods & Stripe Customer Portal */}
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-xl font-bold font-serif flex items-center gap-2">
                                        <CreditCard className="text-primary" size={24} /> 
                                        {locale === 'en' ? 'Payment Methods & Billing' : 'Métodos de Pago y Facturación'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {locale === 'en'
                                            ? 'Manage saved cards, ACH direct debits, and access the Stripe Corporate Portal.'
                                            : 'Administra tus tarjetas guardadas, débitos ACH y accede al portal corporativo de facturación.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenCustomerPortal}
                                    disabled={isOpeningPortal}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shrink-0 disabled:opacity-50"
                                >
                                    {isOpeningPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                    {locale === 'en' ? 'Stripe Billing Portal' : 'Portal de Facturación'}
                                </button>
                            </div>

                            {/* Payment methods list */}
                            {isFetchingMethods ? (
                                <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-xs font-medium">
                                    <Loader2 size={16} className="animate-spin" />
                                    {locale === 'en' ? 'Loading payment methods...' : 'Cargando métodos de pago...'}
                                </div>
                            ) : paymentMethods.length > 0 ? (
                                <div className="space-y-3">
                                    {paymentMethods.map((pm) => {
                                        const isCard = pm.type === 'card' || !!pm.card;
                                        return (
                                            <div key={pm.id} className="p-5 bg-white border border-border rounded-2xl flex items-center justify-between hover:border-primary/30 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800">
                                                        {isCard ? <CreditCard size={20} /> : <Building2 size={20} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-sm uppercase tracking-tight">
                                                                {isCard ? (pm.card?.brand || 'Tarjeta') : (pm.us_bank_account?.bank_name || 'Cuenta Bancaria')}
                                                            </span>
                                                            <span className="font-mono text-xs font-bold text-muted-foreground">
                                                                •••• {isCard ? pm.card?.last4 : pm.us_bank_account?.last4}
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                                                {isCard ? '1-Click' : 'ACH'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {isCard
                                                                ? `${locale === 'en' ? 'Expires' : 'Vence'}: ${pm.card?.exp_month}/${pm.card?.exp_year}`
                                                                : `${locale === 'en' ? 'Direct Debit Bank' : 'Débito Directo Bancario'}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePaymentMethod(pm.id)}
                                                    disabled={deletingMethodId === pm.id}
                                                    className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                                                    title={locale === 'en' ? 'Delete payment method' : 'Eliminar método de pago'}
                                                >
                                                    {deletingMethodId === pm.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/40 space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        {locale === 'en' ? 'No saved payment methods yet.' : 'Aún no tienes métodos de pago guardados.'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/70">
                                        {locale === 'en' ? 'You can save a card during checkout for faster 1-click purchases.' : 'Puedes guardar tu tarjeta durante el checkout para compras en 1 clic.'}
                                    </p>
                                </div>
                            )}

                            {/* Add payment method button / SetupIntent notice */}
                            <div className="mt-6 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <ShieldCheck size={16} className="text-green-600" />
                                    {locale === 'en' ? 'Protected with PCI-DSS 256-bit encryption' : 'Protegido con encriptación bancaria PCI-DSS'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddNewPaymentMethod}
                                    disabled={isAddingMethod}
                                    className="w-full sm:w-auto px-4 py-2 border border-border hover:border-primary/50 text-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                                >
                                    {isAddingMethod ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    {locale === 'en' ? 'Add Payment Method' : 'Agregar Método de Pago'}
                                </button>
                            </div>
                        </div>

                        {/* Change Password Card */}
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm">
                            <h3 className="text-xl font-bold font-serif mb-8 flex items-center gap-2">
                                <Plus className="text-primary" size={24} /> {t.profile.security}
                            </h3>

                            <form onSubmit={handleChangePassword} className="space-y-6">
                                {passwordMessage.text && (
                                    <div className={`p-4 rounded-2xl text-xs font-bold text-center animate-fade-in ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                                        {passwordMessage.text}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{t.profile.currentPassword}</label>
                                    <input 
                                        type="password"
                                        className="premium-input px-6 h-14 font-bold"
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{t.profile.newPassword}</label>
                                        <input 
                                            type="password"
                                            className="premium-input px-6 h-14 font-bold"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">{t.profile.confirmPassword}</label>
                                        <input 
                                            type="password"
                                            className="premium-input px-6 h-14 font-bold"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                <button 
                                    disabled={isChangingPassword}
                                    className="w-full premium-button bg-black text-white py-4 shadow-xl flex items-center justify-center gap-2"
                                >
                                    {isChangingPassword ? <Loader2 className="animate-spin" size={20} /> : <>{t.profile.updatePassword}</>}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>

            <PhoneVerificationModal
                isOpen={isPhoneModalOpen}
                onClose={handleCancelPhoneModal}
                phoneNumber={formData.phone}
                title={locale === 'en' ? 'Verify New Phone Number' : 'Verificación de Nuevo Teléfono'}
                description={
                    locale === 'en'
                        ? 'Please verify your new phone number via 6-digit SMS code to save it.'
                        : 'Por favor verifica tu nuevo número de teléfono mediante código SMS de 6 dígitos para guardarlo.'
                }
                onVerified={handlePhoneVerifiedAndSave}
            />
        </div>
    );
}
