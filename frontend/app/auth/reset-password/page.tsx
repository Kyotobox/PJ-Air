'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';
    const { t } = useLanguage();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!token) {
            setErrorMessage(t.resetPassword?.invalidTokenDesc || 'Enlace inválido o ausente.');
            return;
        }

        if (password.length < 8) {
            setErrorMessage(t.resetPassword?.errorLength || 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage(t.resetPassword?.errorMismatch || 'Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);

        try {
            await api.post('/auth/reset-password', {
                token,
                newPassword: password,
            });
            setIsSuccess(true);
        } catch (err: any) {
            setErrorMessage(err.message || t.resetPassword?.invalidTokenDesc || 'Error al restablecer la contraseña');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="w-full max-w-md jhoanes-card bg-white/80 backdrop-blur-xl text-center p-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-[24px] mb-6 text-amber-600">
                    <AlertTriangle size={32} />
                </div>
                <h1 className="text-2xl font-black font-serif mb-3 tracking-tighter">
                    {t.resetPassword?.invalidTokenTitle || 'Enlace Inválido o Ausente'}
                </h1>
                <p className="text-muted-foreground font-medium text-sm mb-6">
                    {t.resetPassword?.invalidTokenDesc || 'No se encontró el token de restablecimiento. Por favor, solicita un nuevo enlace.'}
                </p>
                <Link
                    href="/auth/forgot-password"
                    className="inline-block w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 shadow-lg font-bold"
                >
                    {t.resetPassword?.requestNewLink || 'Solicitar Nuevo Enlace'}
                </Link>
                <div className="mt-6">
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={14} /> {t.resetPassword?.backToLogin || 'Regresar al Login'}
                    </Link>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="w-full max-w-md jhoanes-card bg-white/80 backdrop-blur-xl text-center p-8 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-[24px] mb-6 text-green-600">
                    <CheckCircle2 size={36} />
                </div>
                <h1 className="text-2xl font-black font-serif mb-3 tracking-tighter text-foreground">
                    {t.resetPassword?.successTitle || '¡Contraseña Actualizada!'}
                </h1>
                <p className="text-muted-foreground font-medium text-sm mb-8 leading-relaxed">
                    {t.resetPassword?.successMessage || 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tus nuevas credenciales.'}
                </p>
                <Link
                    href="/auth/login"
                    className="inline-block w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 shadow-lg font-bold"
                >
                    {t.resetPassword?.goToLogin || 'Iniciar Sesión'}
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md jhoanes-card bg-white/80 backdrop-blur-xl">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-4 text-primary">
                    <KeyRound size={32} />
                </div>
                <h1 className="text-3xl font-black font-serif mb-2 tracking-tighter">
                    {t.resetPassword?.title || 'Nueva Contraseña'}
                </h1>
                <p className="text-muted-foreground font-medium text-sm px-2">
                    {t.resetPassword?.subtitle || 'Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.'}
                </p>
            </div>

            {errorMessage && (
                <div className="p-4 mb-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold text-center flex items-center justify-center gap-2">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-foreground/70">
                        {t.resetPassword?.newPassword || 'Nueva Contraseña'}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type={showPassword ? 'text' : 'password'}
                            minLength={8}
                            placeholder="••••••••"
                            className="premium-input pl-12 pr-12 h-14"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-foreground/70">
                        {t.resetPassword?.confirmPassword || 'Confirmar Contraseña'}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <input
                            required
                            type={showPassword ? 'text' : 'password'}
                            minLength={8}
                            placeholder="••••••••"
                            className="premium-input pl-12 h-14"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    disabled={isLoading}
                    className="w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 shadow-lg font-bold"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (t.resetPassword?.submit || 'Actualizar Contraseña')}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-border/40 text-center">
                <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                    <ArrowLeft size={14} /> {t.resetPassword?.backToLogin || 'Regresar al Login'}
                </Link>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <Suspense fallback={
                <div className="w-full max-w-md jhoanes-card bg-white/80 backdrop-blur-xl text-center p-12">
                    <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                </div>
            }>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}
