'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { useLanguage } from '@/context/LanguageContext';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectParam = searchParams.get('redirect');
    const { updateLocalSession } = useAuth();
    const { t } = useLanguage();
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await api.post('/auth/login', {
                email: identifier.trim(),
                password: password,
            }) as any;

            if (data.session) {
                updateLocalSession(data);
                
                // Get role for redirection
                const userDetail = await api.get(`/users/${data.user.id}`) as any;
                const role = userDetail.role || 'client';

                if (role === 'admin') router.push('/admin');
                else if (role === 'produccion') router.push('/produccion');
                else if (role === 'delivery') router.push('/delivery');
                else router.push(redirectParam || '/');
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };
    
    const [isLoading, setIsLoading] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="w-full max-w-xl jhoanes-card bg-white/80 backdrop-blur-xl">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-[24px] mb-6 text-primary">
                        <LogIn size={32} />
                    </div>
                    <h1 className="text-4xl font-black font-serif mb-3 tracking-tighter">{t.login.title}</h1>
                    <p className="text-muted-foreground font-medium">{t.login.subtitle}</p>
                </div>

                <LoginForm 
                    identifier={identifier}
                    setIdentifier={setIdentifier}
                    password={password}
                    setPassword={setPassword}
                    onSubmit={handleLogin}
                    isLoading={isLoading}
                    error={error}
                />
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
