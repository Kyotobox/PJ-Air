'use client';

import React from 'react';
import Link from 'next/link';
import { LogIn, UserPlus, ShieldCheck, Truck, Sparkles, Building2, Store, Clock, Award, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

interface ExternalPortalLandingProps {
    onOpenLogin: () => void;
}

export default function ExternalPortalLanding({ onOpenLogin }: ExternalPortalLandingProps) {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between relative overflow-hidden selection:bg-primary selection:text-white">
            {/* Background Image with Rich Moody Gradient Overlay */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000 ease-out"
                style={{ 
                    backgroundImage: `url('/images/banners/seasonal/seasonal_hero_flatlay_table.jpg')`,
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/85 via-neutral-950/75 to-neutral-950/95 backdrop-blur-[2px]" />

            {/* Subtle decorative texture */}
            <div 
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: `url("https://www.transparenttextures.com/patterns/cubes.png")` }} 
            />

            {/* Top Navigation Bar */}
            <header className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-12 py-6 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none font-serif">
                        Jhoanes
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 mt-1">
                        Wholesale & B2B Orders
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <LanguageSwitcher variant="pill" />
                    <button
                        type="button"
                        onClick={onOpenLogin}
                        className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all border border-white/15 backdrop-blur-md"
                    >
                        <LogIn size={14} className="text-amber-400" />
                        <span>{isEn ? 'Sign In' : 'Iniciar Sesión'}</span>
                    </button>
                </div>
            </header>

            {/* Center Content / Hero Section */}
            <main className="relative z-20 max-w-4xl w-full mx-auto px-6 sm:px-12 py-12 my-auto text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-6 backdrop-blur-md animate-fade-in shadow-lg">
                    <Sparkles size={13} className="text-amber-400 shrink-0" />
                    <span>{isEn ? 'Exclusive Wholesale Portal' : 'Portal Exclusivo Mayorista'}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black font-serif tracking-tight text-white leading-[1.08] mb-6 drop-shadow-md">
                    {isEn ? (
                        <>
                            Artisanal Pastries for <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
                                Exceptional Businesses
                            </span>
                        </>
                    ) : (
                        <>
                            Pastelería Artesanal para <br className="hidden sm:inline" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
                                Negocios Excepcionales
                            </span>
                        </>
                    )}
                </h1>

                {/* Generic Editorial Message */}
                <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-300 font-medium leading-relaxed mb-10 px-2">
                    {isEn ? (
                        'Welcome to Jhoanes Bakery. Our online ordering catalog is strictly reserved for verified wholesale partners, cafés, restaurants, and grocery retailers across New York. Sign in to manage your daily orders or apply for a commercial account.'
                    ) : (
                        'Bienvenido a Panadería Jhoanes. Nuestro catálogo de pedidos en línea está reservado exclusivamente para clientes comerciales, cafeterías, restaurantes y distribuidores en Nueva York. Inicia sesión para gestionar tus pedidos diarios o solicita tu registro corporativo.'
                    )}
                </p>

                {/* Call To Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
                    <button
                        type="button"
                        onClick={onOpenLogin}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-sm font-black uppercase tracking-widest transition-all shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                        <LogIn size={18} strokeWidth={2.5} />
                        <span>{isEn ? 'Client Sign In' : 'Iniciar Sesión'}</span>
                    </button>

                    <Link
                        href="/auth/register"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-black uppercase tracking-widest transition-all border border-white/20 backdrop-blur-md hover:border-amber-400/50"
                    >
                        <Store size={18} className="text-amber-400" />
                        <span>{isEn ? 'Register Business' : 'Registrar Empresa'}</span>
                    </Link>
                </div>

                {/* Value Propositions / Key Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:bg-white/[0.07] transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center mb-3">
                            <Clock size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                            {isEn ? 'Fresh Daily Baking' : 'Horneado Fresco Diario'}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            {isEn ? 'Crafted overnight with premium European butter and delivered fresh every morning.' : 'Elaborado en la madrugada con mantequilla europea de alta pureza y entregado fresco al amanecer.'}
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:bg-white/[0.07] transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center mb-3">
                            <Truck size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                            {isEn ? 'NYC Direct Fleet Delivery' : 'Flota Propia en NYC'}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            {isEn ? 'Dedicated temperature-controlled routes serving Brooklyn, Queens, Manhattan, and Bronx.' : 'Rutas refrigeradas dedicadas cubriendo Brooklyn, Queens, Manhattan y El Bronx puntualmente.'}
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:bg-white/[0.07] transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center mb-3">
                            <ShieldCheck size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                            {isEn ? 'Commercial B2B Accounts' : 'Cuentas Comerciales B2B'}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                            {isEn ? 'Volume tier pricing, tax-exempt ST-120 invoicing, and flexible recurring standing orders.' : 'Tarifas por volumen, facturación exenta con ST-120 y órdenes recurrentes automatizadas.'}
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-20 max-w-7xl w-full mx-auto px-6 sm:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 text-neutral-400 text-xs">
                <p>
                    © {new Date().getFullYear()} Jhoanes Bakery Wholesale. {isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}
                </p>
                <div className="flex items-center gap-6">
                    <Link href="/terms" className="hover:text-amber-400 transition-colors">
                        {isEn ? 'Commercial Terms' : 'Términos Comerciales'}
                    </Link>
                    <Link href="/privacy" className="hover:text-amber-400 transition-colors">
                        {isEn ? 'Privacy Policy' : 'Política de Privacidad'}
                    </Link>
                    <Link href="/auth/forgot-password" className="hover:text-amber-400 transition-colors">
                        {isEn ? 'Recover Password' : 'Recuperar Contraseña'}
                    </Link>
                </div>
            </footer>
        </div>
    );
}
