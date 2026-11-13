'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Mail, MapPin, Sparkles, Lock, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

export default function TemporarilyClosed() {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between relative overflow-hidden selection:bg-amber-500 selection:text-neutral-950 font-sans">
            {/* Background Image with Rich Ambient Gradient Overlay */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
                style={{ 
                    backgroundImage: `url('/images/banners/seasonal/seasonal_hero_flatlay_table.jpg')`,
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/90 via-neutral-950/80 to-neutral-950/95 backdrop-blur-[3px]" />

            {/* Subtle background texture */}
            <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")` }} 
            />

            {/* Header */}
            <header className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-12 py-8 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none font-serif">
                        Jhoanes
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 mt-1">
                        Bakery & Pastry Wholesale
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <LanguageSwitcher variant="pill" />
                </div>
            </header>

            {/* Center Card */}
            <main className="relative z-20 max-w-2xl w-full mx-auto px-6 py-12 my-auto text-center">
                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-[0.25em] mb-8 backdrop-blur-md shadow-xl animate-fade-in">
                    <Lock size={14} className="text-amber-400 shrink-0" />
                    <span>{isEn ? 'Temporarily Closed · System Maintenance' : 'Sitio Cerrado Temporalmente · Mantenimiento'}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-serif tracking-tight text-white leading-[1.1] mb-6 drop-shadow-lg">
                    {isEn ? (
                        <>
                            We Are Preparing <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
                                Something Exceptional
                            </span>
                        </>
                    ) : (
                        <>
                            Estamos Preparando <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
                                Algo Excepcional
                            </span>
                        </>
                    )}
                </h1>

                {/* Generic Message */}
                <p className="text-base sm:text-lg text-neutral-300 font-medium leading-relaxed max-w-xl mx-auto mb-10">
                    {isEn ? (
                        'Our online ordering platform is temporarily closed as we complete infrastructure upgrades. We will be back online shortly to serve our wholesale clients with the finest artisanal breads and pastries in New York.'
                    ) : (
                        'Nuestra plataforma de pedidos en línea se encuentra cerrada temporalmente mientras completamos mejoras en el sistema. Estaremos de vuelta muy pronto para atender a nuestros clientes con la mejor panadería y pastelería artesanal de Nueva York.'
                    )}
                </p>

                {/* Contact Card */}
                <div className="max-w-md mx-auto p-6 rounded-3xl bg-white/[0.05] border border-white/10 backdrop-blur-xl shadow-2xl text-left space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/90 mb-1">
                        {isEn ? 'Direct Wholesale Inquiries' : 'Atención y Pedidos Especiales'}
                    </div>

                    <div className="flex items-center gap-3 text-neutral-200 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                            <Mail size={16} />
                        </div>
                        <a href="mailto:pedidos@jhoanes.com" className="hover:text-amber-400 font-semibold transition-colors">
                            pedidos@jhoanes.com
                        </a>
                    </div>

                    <div className="flex items-center gap-3 text-neutral-200 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                            <MapPin size={16} />
                        </div>
                        <span className="font-medium text-neutral-300">
                            New York, NY · Wholesale Distribution
                        </span>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 text-neutral-500 text-xs">
                <p>
                    © {new Date().getFullYear()} Jhoanes Bakery. {isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}
                </p>
                <div className="flex items-center gap-4">
                    <Link 
                        href="/terms" 
                        className="text-neutral-500 hover:text-neutral-300 transition-colors text-[11px] font-semibold"
                    >
                        {isEn ? 'Commercial Terms' : 'Términos Comerciales'}
                    </Link>
                    <Link 
                        href="/privacy" 
                        className="text-neutral-500 hover:text-neutral-300 transition-colors text-[11px] font-semibold"
                    >
                        {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
                    </Link>
                    <Link 
                        href="/auth/login" 
                        className="text-neutral-600 hover:text-neutral-400 transition-colors text-[11px] uppercase tracking-wider font-semibold"
                    >
                        {isEn ? 'Authorized Staff' : 'Acceso Autorizado'}
                    </Link>
                </div>
            </footer>
        </div>
    );
}
