'use client';

import React from 'react';
import { User, Lock, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

interface LoginFormProps {
    identifier: string;
    setIdentifier: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error?: string;
}

export const LoginForm = ({
    identifier,
    setIdentifier,
    password,
    setPassword,
    onSubmit,
    isLoading,
    error,
}: LoginFormProps) => {
    const { t, locale } = useLanguage();

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-fade-in text-center">
                    {error}
                </div>
            )}
            <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-foreground/70">
                    {t.login.emailOrUser}
                </label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                    <input
                        required
                        type="text"
                        placeholder={locale === 'en' ? 'your@email.com or username' : 'tu@correo.com o usuario'}
                        className="premium-input pl-12 h-14"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-foreground/70">
                        {t.login.password}
                    </label>
                </div>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                    <input
                        required
                        type="password"
                        placeholder="••••••••"
                        className="premium-input pl-12 h-14"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <div className="pt-4 space-y-4">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full premium-button bg-[#111] hover:bg-[#222] text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>{t.login.submit} <ArrowRight size={20} /></>
                    )}
                </button>

                <div className="text-center">
                    <Link
                        href="/auth/forgot-password"
                        className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
                    >
                        {t.login.forgotPassword}
                    </Link>
                </div>
            </div>
        </form>
    );
};
