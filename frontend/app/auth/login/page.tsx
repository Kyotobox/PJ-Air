'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams.get('redirect');
    const isPendingApproval = searchParams.get('pending_approval') === 'true';
    const isRegistered = searchParams.get('registered') === 'true';
    const { updateLocalSession } = useAuth();
    const { t, locale } = useLanguage();
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await api.post('/auth/login', {
                email: identifier.trim().toLowerCase(),
                password: password,
            }) as any;

            if (data.session) {
                updateLocalSession(data);
                
                // Get role for redirection
                const userDetail = await api.get(`/users/${data.user.id}`) as any;
                const role = userDetail.role || 'client';

                if (role === 'admin') router.push('/admin');
                else if (role === 'auditor') router.push('/admin/orders');
                else if (role === 'produccion') router.push('/produccion');
                else if (role === 'delivery') router.push('/delivery');
                else router.push(redirectParam || '/');
            }
        } catch (err: any) {
            const rawMsg = err.message || '';
            if (rawMsg.includes('ACCOUNT_PENDING_APPROVAL')) {
                setError(locale === 'en'
                    ? 'Your wholesale commercial account is currently under administrative review. We will notify you once approved.'
                    : 'Tu cuenta comercial está en proceso de revisión por nuestro equipo administrativo. Te notificaremos una vez aprobada.');
            } else {
                setError(rawMsg || (locale === 'en' ? 'Error signing in' : 'Error al iniciar sesión'));
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const [isLoading, setIsLoading] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-xl jhoanes-card bg-white/80 backdrop-blur-xl relative">
                <div className="flex justify-end mb-2">
                    <LanguageSwitcher variant="pill" />
                </div>
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-6 text-primary">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-4xl font-black font-serif mb-3 tracking-tighter">{t.login.title}</h1>
                    <p className="text-muted-foreground font-medium">{t.login.subtitle}</p>
                </div>

                {isPendingApproval && !error && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold leading-relaxed shadow-sm">
                        ⏳ <strong>{locale === 'en' ? 'Application Under Administrative Review:' : 'Solicitud en Revisión Administrativa:'}</strong>{' '}
                        {locale === 'en'
                            ? 'Your wholesale commercial account has been submitted successfully. As your delivery address is outside our standard local delivery radius, our logistics and operations team will review freight coverage before activating commercial ordering. We will notify you via email or phone once approved.'
                            : 'Tu cuenta comercial mayorista ha sido registrada exitosamente. Al encontrarse fuera del radio de entrega local habitual, nuestro equipo de logística y administración revisará y aprobará la cobertura y cotización de flete antes de habilitar el acceso comercial. Te notificaremos a tu correo o teléfono una vez aprobada.'}
                    </div>
                )}

                {isRegistered && !isPendingApproval && !error && (
                    <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold leading-relaxed shadow-sm">
                        ✓ <strong>{locale === 'en' ? 'Registration Successful:' : 'Registro Exitoso:'}</strong>{' '}
                        {locale === 'en'
                            ? 'Your commercial account has been created. Please sign in with your credentials.'
                            : 'Tu cuenta comercial ha sido creada. Por favor ingresa con tus credenciales.'}
                    </div>
                )}

                <LoginForm 
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    password={password}
                    setPassword={setPassword}
                    onSubmit={handleLogin}
                    isLoading={isLoading}
                    error={error}
                />

                <div className="mt-8 pt-6 border-t border-border/40 text-center">
                    <p className="text-sm text-muted-foreground font-medium">
                        {t.login.noAccount}{' '}
                        <Link 
                            href={redirectParam ? `/auth/register?redirect=${encodeURIComponent(redirectParam)}` : '/auth/register'} 
                            className="text-primary font-bold hover:underline ml-1"
                        >
                            {t.login.registerNow}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">...</div>}>
            <LoginContent />
        </Suspense>
    );
}
