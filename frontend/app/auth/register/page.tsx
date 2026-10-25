'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, Building2, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useLanguage } from '@/context/LanguageContext';

export default function RegisterPage() {
    const router = useRouter();
    const { updateLocalSession } = useAuth();
    const { t, locale } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
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
