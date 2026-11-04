'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    Mail, Lock, User, Phone, Building2, Loader2, ArrowRight, 
    Clock, CalendarX, PhoneCall, ShieldCheck, FileCheck, CheckCircle2 
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { PhoneVerificationModal } from '@/components/auth/PhoneVerificationModal';
import { useLanguage } from '@/context/LanguageContext';

export default function RegisterPage() {
    const router = useRouter();
    const { updateLocalSession } = useAuth();
    const { t, locale } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [phoneIdToken, setPhoneIdToken] = useState('');
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        company_name: '',
        password: '',
        confirm_password: '',
        tax_id: '',
        st120_declared: false,
        legal_business_name: '',
        dba: '',
        ein: '',
        business_address: '',
        signer_name: '',
        signer_title: '',
        signer_phone: '',
        signer_email: '',
        terms_consent_1: false,
        terms_consent_2: false,
        terms_consent_3: false,
        signature_text: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirm_password) {
            setError(t.register.passwordMismatch);
            return;
        }

        if (!formData.company_name || !formData.company_name.trim()) {
            setError(locale === 'en' ? 'Company or store name is required' : 'El nombre de la compañía o tienda es obligatorio');
            return;
        }

        if (!formData.legal_business_name || !formData.legal_business_name.trim()) {
            setError(locale === 'en' ? 'Legal Business Name is required' : 'La Razón Social (Legal Name) es obligatoria');
            return;
        }

        if (!formData.ein || !formData.ein.trim()) {
            setError(locale === 'en' ? 'EIN / Federal Tax ID is required' : 'El EIN / Tax ID Federal es obligatorio');
            return;
        }

        if (!formData.business_address || !formData.business_address.trim()) {
            setError(locale === 'en' ? 'Commercial address is required' : 'La dirección comercial es obligatoria');
            return;
        }

        if (!formData.tax_id || !formData.tax_id.trim()) {
            setError(locale === 'en' ? 'Tax ID / NY Resale Certificate # is required for wholesale accounts' : 'El Tax ID / NY Resale Certificate # es obligatorio para cuentas mayoristas');
            return;
        }

        if (!formData.signer_name || !formData.signer_name.trim()) {
            setError(locale === 'en' ? 'Authorized signer name is required' : 'El nombre del firmante autorizado es obligatorio');
            return;
        }

        if (!formData.terms_consent_1 || !formData.terms_consent_2 || !formData.terms_consent_3) {
            setError(locale === 'en' ? 'You must accept all 3 mandatory consent checkboxes' : 'Debes marcar las 3 casillas de consentimiento obligatorio');
            return;
        }

        if (!formData.signature_text || formData.signature_text.trim().length < 3) {
            setError(locale === 'en' ? 'Please provide your full typed name as an electronic signature' : 'Por favor escribe tu nombre completo como firma electrónica vinculante');
            return;
        }

        if (!isPhoneVerified || !phoneIdToken) {
            setError(locale === 'en' ? 'You must verify your phone number via SMS before proceeding' : 'Debes verificar tu número de teléfono por SMS antes de continuar');
            return;
        }

        setIsLoading(true);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const sanitizedEmail = formData.email.trim();
        
        if (!emailRegex.test(sanitizedEmail)) {
            setError(t.register.invalidEmail);
            setIsLoading(false);
            return;
        }

        try {
            // Sign up user via local API with wholesale terms and electronic signature
            const data = await api.post('/auth/signup', {
                email: sanitizedEmail,
                password: formData.password,
                full_name: formData.full_name,
                username: formData.username,
                phone: formData.phone,
                phone_verified: true,
                idToken: phoneIdToken,
                company_name: formData.company_name,
                tax_id: formData.tax_id ? formData.tax_id.trim() : undefined,
                st120_declared: Boolean(formData.st120_declared),
                legal_business_name: formData.legal_business_name.trim(),
                dba: formData.dba ? formData.dba.trim() : undefined,
                ein: formData.ein.trim(),
                business_address: formData.business_address.trim(),
                signer_name: formData.signer_name.trim(),
                signer_title: formData.signer_title.trim(),
                signer_phone: formData.signer_phone.trim(),
                signer_email: formData.signer_email.trim(),
                signature_text: formData.signature_text.trim(),
                terms_version: 'v2026.10.29',
                accepted_at: new Date().toISOString(),
                check_enabled: false,
            }) as any;

            if (data.session) {
                updateLocalSession(data);
                router.push('/profile/addresses/new');
            } else {
                router.push('/auth/login?registered=true');
            }
        } catch (err: any) {
            setError(err.message || 'Error al crear la cuenta mayorista');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyPhoneClick = () => {
        const digits = formData.phone.replace(/\D/g, '');
        if (digits.length < 10) {
            setError(locale === 'en' ? 'Please enter a valid 10-digit phone number first' : 'Ingresa un número de teléfono válido de 10 dígitos primero');
            return;
        }
        setError('');
        setIsVerificationModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-6xl jhoanes-card bg-white/90 backdrop-blur-xl shadow-2xl p-6 sm:p-10">
                {/* Header */}
                <div className="text-center mb-10 pb-6 border-b border-border/40">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-4 text-primary">
                        <Building2 size={32} />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black font-serif mb-2 tracking-tighter">
                        {locale === 'en' ? 'Wholesale B2B Account Registration' : 'Registro de Cuenta Mayorista B2B'}
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium max-w-2xl mx-auto">
                        {locale === 'en'
                            ? 'Complete your company application, accept commercial terms, and submit your authorized electronic signature.'
                            : 'Completa el expediente de tu empresa, acepta los términos comerciales y suscribe tu firma electrónica autorizada.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Columna Principal: Formulario estructurado */}
                    <div className="lg:col-span-8">
                        <RegisterForm 
                            formData={formData}
                            setFormData={setFormData}
                            onSubmit={handleSubmit}
                            isLoading={isLoading}
                            error={error}
                            isPhoneVerified={isPhoneVerified}
                            setIsPhoneVerified={setIsPhoneVerified}
                            onVerifyPhoneClick={handleVerifyPhoneClick}
                            onPhoneChange={() => setPhoneIdToken('')}
                        />
                    </div>

                    {/* Columna Lateral: Key Points B2B */}
                    <aside className="lg:col-span-4 space-y-6">
                        <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl space-y-6 sticky top-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
                                <ShieldCheck size={20} className="text-amber-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">
                                    {locale === 'en' ? 'Wholesale Key Points' : 'Puntos Clave Mayoristas'}
                                </h3>
                            </div>

                            <ul className="space-y-4 text-xs">
                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-100">
                                            {locale === 'en' ? '36-Hour Order Cutoff' : 'Corte de Pedidos de 36h'}
                                        </p>
                                        <p className="text-slate-400 text-[11px] leading-relaxed">
                                            {locale === 'en'
                                                ? 'Orders must be placed 36 hours before delivery for scheduled baking.'
                                                : 'Todo pedido debe confirmarse 36 horas antes del despacho para programación de hornos.'}
                                        </p>
                                    </div>
                                </li>

                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <CalendarX size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-100">
                                            {locale === 'en' ? 'No Tuesday Deliveries' : 'Sin Entregas los Martes'}
                                        </p>
                                        <p className="text-slate-400 text-[11px] leading-relaxed">
                                            {locale === 'en'
                                                ? 'Deliveries run Wednesday through Monday. No deliveries on Tuesdays (plant sanitation).'
                                                : 'Despachos de miércoles a lunes. No hay reparto los martes por sanitización profunda.'}
                                        </p>
                                    </div>
                                </li>

                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <PhoneCall size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-100">
                                            {locale === 'en' ? 'Direct Wholesale Line' : 'Línea Directa Wholesale'}
                                        </p>
                                        <p className="text-emerald-300 font-mono font-bold text-xs">
                                            (347) 761-2687
                                        </p>
                                        <p className="text-slate-400 text-[10px]">
                                            {locale === 'en' ? 'Mon-Sat 7am - 6pm EST' : 'Lun-Sáb 7am - 6pm EST'}
                                        </p>
                                    </div>
                                </li>

                                <li className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                                        <FileCheck size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-100">
                                            {locale === 'en' ? 'NY ESRA / E-SIGN Compliance' : 'Cumplimiento Legal NY ESRA'}
                                        </p>
                                        <p className="text-slate-400 text-[11px] leading-relaxed">
                                            {locale === 'en'
                                                ? 'Electronic consent and signature have full legal binding force in NY.'
                                                : 'Firma y consentimientos electrónicos con plena validez vinculante en el Estado de NY.'}
                                        </p>
                                    </div>
                                </li>
                            </ul>

                            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1">
                                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                                    <CheckCircle2 size={13} />
                                    <span>{locale === 'en' ? 'Stripe Card-on-File' : 'Tarjeta de Respaldo Stripe'}</span>
                                </p>
                                <p className="text-slate-400 text-[10px] leading-tight">
                                    {locale === 'en'
                                        ? 'Tokenized card on file secures credit and covers overdue invoices or 1.5% monthly late charges.'
                                        : 'Tarjeta tokenizada para respaldar crédito comercial y cobro de balances morosos al 1.5% mensual.'}
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>

                <PhoneVerificationModal
                    isOpen={isVerificationModalOpen}
                    onClose={() => setIsVerificationModalOpen(false)}
                    phoneNumber={formData.phone}
                    title={locale === 'en' ? 'Verify Mobile Number' : 'Verificación de Identidad Telefónica'}
                    description={
                        locale === 'en'
                            ? `Verify your mobile number to activate instant B2B wholesale order notifications`
                            : `Verifica tu número móvil para activar notificaciones automáticas de pedidos mayoristas`
                    }
                    onVerified={async (data) => {
                        setIsPhoneVerified(true);
                        setPhoneIdToken(data?.idToken || 'mock-valid-firebase-token');
                    }}
                />

                <div className="mt-12 pt-8 border-t border-border/40 text-center space-y-4">
                    <p className="text-sm text-muted-foreground font-medium">
                        {t.register.alreadyMember} <Link href="/auth/login" className="text-primary font-bold hover:underline ml-1">{t.register.loginHere}</Link>
                    </p>
                    <div className="pt-2">
                        <Link 
                            href="/auth/forgot-password"
                            className="text-[10px] font-black text-muted-foreground hover:text-primary hover:underline uppercase tracking-widest"
                        >
                            {t.register.forgotPassword}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
