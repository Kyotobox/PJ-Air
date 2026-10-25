'use client';

import React from 'react';
import { Mail, Lock, User, Phone, Building2, Loader2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface RegisterFormProps {
    formData: any;
    setFormData: (data: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error: string;
}

export const RegisterForm = ({
    formData,
    setFormData,
    onSubmit,
    isLoading,
    error
}: RegisterFormProps) => {
    const { t, locale } = useLanguage();

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
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">{t.register.phone}</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type="tel"
                            placeholder={locale === 'en' ? 'e.g. +1 212 555 0100' : 'Ej: +51 987 654 321'}
                            className="premium-input pl-12"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
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
                    disabled={isLoading}
                    className="w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>{t.register.submit} <ArrowRight size={20} /></>
                    )}
                </button>
            </div>
        </form>
    );
};
