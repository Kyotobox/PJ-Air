'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, ShieldCheck, FileText, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

export default function Footer() {
    const { locale } = useLanguage();
    const isEn = locale === 'en';

    return (
        <footer className="mt-16 border-t border-border/60 bg-white/70 backdrop-blur-md text-foreground py-10 transition-colors">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    {/* Brand column */}
                    <div className="md:col-span-1 space-y-3">
                        <Link href="/" className="flex flex-col group">
                            <span className="text-2xl font-black tracking-tight text-foreground leading-none group-hover:text-primary transition-colors font-serif">
                                Jhoanes
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mt-1">
                                {isEn ? 'B2B Wholesale Bakery' : 'Panadería Mayorista B2B'}
                            </span>
                        </Link>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {isEn
                                ? 'Artisanal wholesale bakery distribution serving cafes, restaurants, and grocery partners across New York City.'
                                : 'Distribución mayorista artesanal para cafeterías, restaurantes y comercios aliados en toda la ciudad de Nueva York.'}
                        </p>
                    </div>

                    {/* Direct Wholesale Contact - CRITICAL FOR GOOGLE ADS VERIFICATION */}
                    <div className="md:col-span-1 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                            {isEn ? 'Wholesale Inquiries' : 'Línea de Ventas Mayorista'}
                        </p>
                        <div className="space-y-2 text-xs">
                            <div className="p-3 rounded-2xl bg-primary/5 border border-primary/15">
                                <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                    {isEn ? 'Direct Call Line (Click to Dial):' : 'Atención Telefónica Directa:'}
                                </span>
                                <a
                                    href="tel:+13477612687"
                                    className="inline-flex items-center gap-2 text-sm font-black text-primary hover:text-[#5B0606] transition-colors underline underline-offset-4"
                                    aria-label="Call Wholesale: (347) 761-2687"
                                >
                                    <Phone size={15} className="shrink-0 text-primary" />
                                    <span>Wholesale: (347) 761-2687</span>
                                </a>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail size={13} className="shrink-0 text-primary" />
                                <a href="mailto:pedidos@jhoanes.com" className="hover:text-primary transition-colors font-medium">
                                    pedidos@jhoanes.com
                                </a>
                            </div>

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin size={13} className="shrink-0 text-primary" />
                                <span>New York, NY · NYC Metro Fleet</span>
                            </div>
                        </div>
                    </div>

                    {/* Operational Quick Links */}
                    <div className="md:col-span-1 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
                            {isEn ? 'Ordering & Operations' : 'Pedidos y Operación'}
                        </p>
                        <ul className="space-y-2 text-xs font-semibold text-muted-foreground">
                            <li>
                                <Link href="/" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    <span>{isEn ? 'Wholesale Catalog' : 'Catálogo Mayorista'}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/orders" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    <span>{isEn ? 'Standing Orders & Tracking' : 'Mis Pedidos y Entregas'}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/auth/register" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    <span>{isEn ? 'Apply for B2B Account' : 'Crear Cuenta Comercial'}</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal & Compliance Links */}
                    <div className="md:col-span-1 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
                            {isEn ? 'Legal & Trust' : 'Marco Legal y Cumplimiento'}
                        </p>
                        <ul className="space-y-2 text-xs font-semibold text-muted-foreground">
                            <li>
                                <Link href="/terms" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    <FileText size={12} className="text-primary" />
                                    <span>{isEn ? 'Commercial Terms & Policies' : 'Términos y Políticas Comerciales'}</span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="hover:text-primary transition-colors inline-flex items-center gap-1.5">
                                    <ShieldCheck size={12} className="text-primary" />
                                    <span>{isEn ? 'Privacy Policy & Data Rights' : 'Política de Privacidad'}</span>
                                </Link>
                            </li>
                            <li>
                                <span className="text-[11px] text-muted-foreground/80 inline-flex items-center gap-1.5">
                                    <Clock size={12} className="text-primary" />
                                    <span>{isEn ? 'Daily Order Cut-off: 12:00 PM EST' : 'Cierre Diario: 12:00 PM EST'}</span>
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sub-footer Bar with copyright and explicit phone confirmation */}
                <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                    <p>
                        © {new Date().getFullYear()} Jhoanes Bakery Wholesale. {isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-bold flex-wrap">
                        <LanguageSwitcher variant="pill" />
                        <span>•</span>
                        <a
                            href="tel:+13477612687"
                            className="text-primary hover:text-[#5B0606] transition-colors inline-flex items-center gap-1.5"
                        >
                            <Phone size={12} />
                            <span>Wholesale: (347) 761-2687</span>
                        </a>
                        <span>•</span>
                        <Link href="/terms" className="hover:text-primary transition-colors">
                            {isEn ? 'Commercial Terms' : 'Términos Comerciales'}
                        </Link>
                        <span>•</span>
                        <Link href="/privacy" className="hover:text-primary transition-colors">
                            {isEn ? 'Privacy Policy' : 'Privacidad'}
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
