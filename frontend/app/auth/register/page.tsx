'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, Building2, Loader2, ArrowRight } from 'lucide-react';
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

        if (!isPhoneVerified || !phoneIdToken) {
            setError(locale === 'en' ? 'You must verify your phone number via SMS before proceeding' : 'Debes verificar tu número de teléfono por SMS antes de continuar');
            return;
        }

        setIsLoading(true);

        // Client-side validation: Check basic email format (must include TLD like .com)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const sanitizedEmail = formData.email.trim();
        
        if (!emailRegex.test(sanitizedEmail)) {
            setError(t.register.invalidEmail);
            setIsLoading(false);
            return;
        }

        try {
            // 1. Sign up user via local API
            const data = await api.post('/auth/signup', {
                email: sanitizedEmail,
                password: formData.password,
                full_name: formData.full_name,
                username: formData.username,
                phone: formData.phone,
                phone_verified: true,
                idToken: phoneIdToken,
                company_name: formData.company_name,
            }) as any;

            // 2. Auto-login and Update context
            if (data.session) {
                updateLocalSession(data);
                // 3. Redirect to address registration instead of login
                router.push('/profile/addresses/new');
            } else {
                router.push('/auth/login?registered=true');
            }
        } catch (err: any) {
            setError(err.message || 'Error al crear la cuenta');
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
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-2xl jhoanes-card bg-white/80 backdrop-blur-xl">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-6 text-primary">
                        <User size={32} />
                    </div>
                    <h1 className="text-4xl font-black font-serif mb-3 tracking-tighter">{t.register.title}</h1>
                    <p className="text-muted-foreground font-medium">{t.register.subtitle}</p>
                </div>

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
