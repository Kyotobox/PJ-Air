'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

export default function ForgotPasswordPage() {
    const [identifier, setIdentifier] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier) return;

        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const data = await api.post('/auth/recover-password', { identifier: identifier.trim().toLowerCase() }) as any;
            setMessage({ 
                type: 'success', 
                text: data.message || `Gracias, su contraseña se ha enviado al correo ${data.email || ''}`
            });
        } catch (err: any) {
            setMessage({ 
                type: 'error', 
                text: err.message || `No hemos conseguido un usuario o email que coincida con: ${identifier.trim()}` 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-md jhoanes-card bg-white/80 backdrop-blur-xl">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-6 text-primary">
                        <Mail size={32} />
                    </div>
                    <h1 className="text-3xl font-black font-serif mb-3 tracking-tighter">{t.forgotPassword.title}</h1>
                    <p className="text-muted-foreground font-medium text-sm px-4">
                        {t.forgotPassword.subtitle}
                    </p>
                </div>

                {message.text ? (
                    <div className={`p-6 rounded-[24px] text-center animate-fade-in ${
                        message.type === 'success' 
                        ? 'bg-green-50 border border-green-100 text-green-700' 
                        : 'bg-red-50 border border-red-100 text-red-700'
                    }`}>
                        {message.type === 'success' && <CheckCircle2 className="mx-auto mb-3 text-green-500" size={32} />}
                        <p className="text-sm font-bold leading-relaxed">{message.text}</p>
                        {message.type === 'success' && (
                            <Link 
                                href="/auth/login" 
                                className="inline-block mt-6 text-xs font-black uppercase tracking-widest text-primary hover:underline"
                            >
                                {t.forgotPassword.successLink}
                            </Link>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 text-foreground/70">
                                {t.forgotPassword.emailOrUser}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                                <input
                                    required
                                    type="email"
                                    placeholder="ejemplo@correo.com"
                                    className="premium-input pl-12 h-14"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            disabled={isLoading}
                            className="w-full premium-button jhoanes-gradient text-white text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 shadow-lg"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : t.forgotPassword.submit}
                        </button>
                    </form>
                )}

                <div className="mt-10 pt-8 border-t border-border/40 text-center">
                    <Link href="/auth/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeft size={14} /> {t.forgotPassword.backToLogin}
                    </Link>
                </div>
            </div>
        </div>
    );
}
