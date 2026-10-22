'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { FileText, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
    const { locale } = useLanguage();
    const [terms, setTerms] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;
        const fetchTerms = async () => {
            setIsLoading(true);
            try {
                const configKey = locale === 'en' ? 'terms_and_conditions_en' : 'terms_and_conditions_es';
                const data = await api.get(`/configs/${configKey}`) as any;
                if (isMounted && data && data.value) {
                    setTerms(data.value);
                }
            } catch (err) {
                console.error('Error fetching terms:', err);
                // Fallback default message
                if (isMounted) {
                    setTerms(locale === 'en' 
                        ? 'Jhoanes Wholesale policies: Orders placed before 12:00 PM are delivered in approximately 1.5 days. Cash customers pay via Stripe. Credit customers operate under pre-approved credit lines.'
                        : 'Políticas comerciales de Jhoanes Wholesale: Pedidos colocados antes de las 12:00 p. m. se entregan en 1.5 días. Clientes de contado liquidan por Stripe y clientes a crédito con línea pre-aprobada.');
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchTerms();
        return () => { isMounted = false; };
    }, [locale]);

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <Navbar />

            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <Link 
                        href="/" 
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ArrowLeft size={16} /> {locale === 'en' ? 'Back to Catalog' : 'Volver al Catálogo'}
                    </Link>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-border/60 shadow-xl p-8 sm:p-14 relative overflow-hidden">
                    <div className="h-2.5 w-full absolute top-0 left-0 bg-gradient-to-r from-primary to-[#b45309]" />

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Jhoanes Wholesale</span>
                            <h1 className="text-2xl sm:text-4xl font-black font-serif text-foreground">
                                {locale === 'en' ? 'Commercial Terms & Conditions' : 'Términos y Condiciones Comerciales'}
                            </h1>
                        </div>
                    </div>

                    <hr className="border-border/60 my-6" />

                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center animate-pulse">
                            <Loader2 size={36} className="animate-spin text-primary/30 mb-3" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                {locale === 'en' ? 'Loading policies...' : 'Cargando políticas...'}
                            </p>
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none text-foreground/80 leading-relaxed font-sans whitespace-pre-line text-sm sm:text-base">
                            {terms}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
