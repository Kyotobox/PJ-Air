'use client';

import React from 'react';
import { Mail, Lock, User, Phone, Building2, Loader2, ArrowRight, CheckCircle2, Smartphone, FileText, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { formatPhoneNumber } from '@/lib/firebase';

interface RegisterFormProps {
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string;
    isPhoneVerified?: boolean;
    setIsPhoneVerified?: (verified: boolean) => void;
    onVerifyPhoneClick?: () => void;
    onPhoneChange?: () => void;
}

export const RegisterForm = ({
    formData,
    setFormData,
    onSubmit,
    isLoading,
    error,
    isPhoneVerified = false,
    setIsPhoneVerified,
    onVerifyPhoneClick,
    onPhoneChange,
}: RegisterFormProps) => {
    const { t, locale } = useLanguage();

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormData({ ...formData, phone: formatted });
        if (isPhoneVerified && setIsPhoneVerified) {
            setIsPhoneVerified(false);
        }
        if (onPhoneChange) {
            onPhoneChange();
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-fade-in text-center">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.fullName}</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. John Doe' : 'Ej: Juan Pérez'}
                            className="premium-input pl-12"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.username}</label>
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-[10px] font-bold">@</div>
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'user123' : 'usuario123'}
                            className="premium-input pl-12"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.email}</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="email"
                            placeholder={locale === 'en' ? 'john@example.com' : 'juan@ejemplo.com'}
                            className="premium-input pl-12"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.register.phone}</label>
                        {isPhoneVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 size={12} />
                                <span>{locale === 'en' ? 'Phone Verified ✓' : 'Teléfono Verificado ✓'}</span>
                            </span>
                        ) : (
                            formData.phone && formData.phone.replace(/\D/g, '').length >= 10 && onVerifyPhoneClick && (
                                <button
                                    type="button"
                                    onClick={onVerifyPhoneClick}
                                    className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                >
                                    <Smartphone size={12} />
                                    <span>{locale === 'en' ? 'Verify via SMS' : 'Verificar vía SMS'}</span>
                                </button>
                            )
                        )}
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="tel"
                            placeholder="+1 (305) 555-0100"
                            className={`premium-input pl-12 ${isPhoneVerified ? 'border-emerald-500 bg-emerald-50/20' : ''}`}
                            value={formData.phone}
                            onChange={handlePhoneChange}
                        />
                        {isPhoneVerified && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600">
                                <CheckCircle2 size={18} />
                            </div>
                        )}
                    </div>
                    {formData.phone && !isPhoneVerified && (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between gap-2 animate-fade-in shadow-xs">
                            <div className="flex items-center gap-2">
                                <Smartphone size={16} className="text-amber-600 shrink-0" />
                                <span className="font-semibold text-[11px] leading-tight">
                                    {locale === 'en'
                                        ? 'Phone verification required for wholesale accounts'
                                        : 'Verificación de teléfono requerida para cuentas mayoristas'}
                                </span>
                            </div>
                            {onVerifyPhoneClick && (
                                <button
                                    type="button"
                                    onClick={onVerifyPhoneClick}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors shrink-0 cursor-pointer"
                                >
                                    {locale === 'en' ? 'Verify via SMS' : 'Verificar vía SMS'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Company name — full width, mandatory */}
                <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-2">
                        {t.register.companyName}
                    </label>
                    <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. My Bakery Shop' : 'Ej: Panadería El Sol'}
                            className="premium-input pl-12"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        />
                    </div>
                </div>

                {/* Tax ID / NY Resale Certificate # — full width, mandatory */}
                <div className="space-y-3 md:col-span-2 p-4 bg-muted/20 border border-border/80 rounded-2xl">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <FileText size={14} className="text-primary" />
                            <span>TAX ID / NY RESALE CERTIFICATE # *</span>
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {locale === 'en' ? '0% Sales Tax ST-120' : '0% Impuestos ST-120'}
                        </span>
                    </div>
                    <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="text"
                            placeholder={locale === 'en' ? 'e.g. 12-3456789 or NY Certificate #' : 'Ej: 12-3456789 o Certificado NY'}
                            className="premium-input pl-12"
                            value={formData.tax_id || ''}
                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                        />
                    </div>
                    <div className="flex items-start gap-2.5 pt-2">
                        <input
                            id="st120_declared"
                            type="checkbox"
                            className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                            checked={Boolean(formData.st120_declared)}
                            onChange={(e) => setFormData({ ...formData, st120_declared: e.target.checked })}
                        />
                        <label htmlFor="st120_declared" className="text-[11px] text-foreground/80 leading-snug cursor-pointer">
                            {locale === 'en' ? (
                                <>Certify under penalty of perjury that all purchases are for resale under a valid NY Form ST-120 certificate. (Document can be uploaded in your profile).</>
                            ) : (
                                <>Certifico bajo pena de perjurio que todas las compras son para reventa amparadas en certificado ST-120 de NY vigente. (El archivo puede subirse en tu perfil).</>
                            )}
                        </label>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.password}</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="password"
                            placeholder="••••••••"
                            className="premium-input pl-12"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.confirmPassword}</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="password"
                            placeholder="••••••••"
                            className="premium-input pl-12"
                            value={formData.confirm_password}
                            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-2xl border border-border/60">
                <input
                    required
                    id="terms_agree"
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                />
                <label htmlFor="terms_agree" className="text-xs text-foreground/80 font-medium leading-relaxed cursor-pointer">
                    {locale === 'en' ? (
                        <>I have read and agree to the <a href="/terms" target="_blank" className="text-primary font-bold underline hover:text-black">Commercial Terms and Conditions</a> of Jhoanes Wholesale.</>
                    ) : (
                        <>He leído y acepto los <a href="/terms" target="_blank" className="text-primary font-bold underline hover:text-black">Términos y Condiciones Comerciales</a> de Jhoanes Wholesale.</>
                    )}
                </label>
            </div>

            <div className="pt-4">
                <button
                    disabled={isLoading || !isPhoneVerified}
                    className={`w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 transition-all ${
                        (!isPhoneVerified || isLoading) ? 'opacity-50 cursor-not-allowed shadow-none' : ''
                    }`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>{t.register.submit} <ArrowRight size={20} /></>
                    )}
                </button>
                {!isPhoneVerified && (
                    <p className="text-[11px] text-center text-amber-700/80 font-bold mt-2.5 animate-fade-in">
                        {locale === 'en'
                            ? '⚠ SMS phone verification is required to enable wholesale account registration'
                            : '⚠ Se requiere verificación de teléfono vía SMS para habilitar el registro mayorista'}
                    </p>
                )}
            </div>
        </form>
    );
};
