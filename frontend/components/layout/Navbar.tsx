'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, User, Menu, X, ShoppingBag, Plus, LayoutDashboard, Package, Users, ClipboardList, Truck, Map, Clock, FileText, ShieldCheck, Phone } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { API_URL } from '@/lib/config';
import ScheduleOrdersModal from '@/components/modals/ScheduleOrdersModal';

export default function Navbar() {
    const { getCartCount } = useCart();
    const { user, profile, signOut } = useAuth();
    const { t, locale } = useLanguage();
    const cartCount = getCartCount();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const isAdmin = profile?.role === 'admin' || user?.email === 'admin@test.com';
    const isAuditor = profile?.role === 'auditor';

    return (
        <>
            <ScheduleOrdersModal 
                isOpen={showScheduleModal} 
                onClose={() => setShowScheduleModal(false)} 
            />

            <header className="sticky top-0 z-[50]">
                {/* Top Wholesale Call Line Banner for Google Ads Verification & Direct Dialing */}
                <div className="bg-[#5B0606] text-white py-1.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 border-b border-[#7A0D0D]/40">
                    <Phone size={12} className="shrink-0 text-amber-300" />
                    <span className="opacity-90">{locale === 'en' ? 'Direct Wholesale Line:' : 'Atención Mayorista:'}</span>
                    <a
                        href="tel:+13477612687"
                        className="font-black text-amber-200 hover:text-white underline underline-offset-2 transition-colors inline-flex items-center gap-1"
                    >
                        <span>Wholesale: (347) 761-2687</span>
                    </a>
                </div>

                <nav className="bg-white/90 backdrop-blur-xl border-b border-border/40">
                    <div className="max-w-7xl mx-auto px-6 lg:px-12">
                        <div className="flex justify-between items-center h-20">
                            <div className="flex items-center gap-8">
                                {/* Logo */}
                                <Link href="/" className="flex flex-col group">
                                    <span className="text-2xl font-black tracking-tight text-foreground leading-none group-hover:text-primary transition-colors">Jhoanes</span>
                                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground mt-0.5">{t.nav.orderSystem}</span>
                                </Link>

                                <div className="hidden lg:flex items-center gap-6 ml-8">
                                    <Link href="/" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-colors">{t.nav.catalog}</Link>
                                    <button
                                        type="button"
                                        onClick={() => setShowScheduleModal(true)}
                                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-colors cursor-pointer"
                                    >
                                        <Clock size={13} className="text-primary" />
                                        <span>{locale === 'en' ? 'Baking Schedule' : 'Horarios de Horneado'}</span>
                                    </button>
                                    <Link href="/terms" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-colors">
                                        {locale === 'en' ? 'Terms' : 'Términos'}
                                    </Link>
                                    <Link href="/privacy" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/70 hover:text-primary transition-colors">
                                        {locale === 'en' ? 'Privacy' : 'Privacidad'}
                                    </Link>
                                    <a
                                        href="tel:+13477612687"
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 text-[10px] font-black uppercase tracking-wider transition-all"
                                        title="Call Wholesale"
                                    >
                                        <Phone size={11} className="shrink-0" />
                                        <span>Wholesale: (347) 761-2687</span>
                                    </a>
                                </div>
                            </div>

                        <div className="flex items-center gap-4">
                            {/* Language Switcher */}
                            <div className="hidden lg:block">
                                <LanguageSwitcher variant="pill" />
                            </div>

                            <div className="hidden lg:flex items-center gap-4 border-r border-border/40 pr-6 mr-2">
                                {user ? (
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-4">
                                            <Link href="/profile" className="flex flex-col items-end group/user">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground group-hover/user:text-primary transition-colors">{user.email?.split('@')[0]}</span>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); signOut(); }}
                                                    className="text-[8px] font-black uppercase tracking-widest text-primary hover:underline"
                                                >
                                                    {t.nav.logout}
                                                </button>
                                            </Link>
                                            <Link href="/profile" className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all overflow-hidden">
                                                {profile?.avatar_url ? (
                                                    <img src={profile.avatar_url?.startsWith('http') || profile.avatar_url?.startsWith('data:') ? profile.avatar_url : `${API_URL}${profile.avatar_url}`} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={20} />
                                                )}
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Link href="/auth/login" className="text-[10px] font-black uppercase tracking-widest text-foreground/70 hover:text-primary transition-colors">{t.nav.login}</Link>
                                        <Link href="/auth/register" className="px-5 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-all">{t.nav.register}</Link>
                                    </>
                                )}
                            </div>

                            {isAuditor && (
                                <Link href="/admin/orders" className="hidden sm:flex items-center gap-2 px-5 py-2 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all">
                                    <ShieldCheck size={14} className="text-emerald-700" />
                                    <span>{locale === 'en' ? 'Audit & Finance' : 'Panel Auditor'}</span>
                                </Link>
                            )}

                            {user && !isAuditor && (
                                <Link href="/orders" className="hidden sm:flex items-center gap-2 px-6 py-2 bg-muted/50 rounded-full border border-border/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all">
                                    {t.nav.myOrders}
                                </Link>
                            )}

                            <div className="relative">
                                <Link href="/checkout" className="relative p-2.5 bg-foreground text-white rounded-full shadow-lg hover:bg-primary transition-all group overflow-hidden block">
                                    <ShoppingBag size={18} className="relative z-10 group-hover:-translate-y-10 transition-transform duration-300" />
                                    <div className="absolute inset-0 flex items-center justify-center translate-y-10 group-hover:translate-y-0 transition-transform duration-300">
                                        <Plus size={18} />
                                    </div>
                                </Link>
                                {cartCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 z-30 bg-[#6B0D0D] text-white text-[10px] font-bold w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-fade-in shadow-[#6B0D0D]/40">
                                        {cartCount}
                                    </span>
                                )}
                            </div>

                            {/* Hamburger button */}
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 text-foreground hover:bg-muted rounded-full transition-all"
                                aria-label="Open menu"
                            >
                                <Menu size={22} strokeWidth={1.5} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            </header>

            {/* Side panel overlay */}
            {isMenuOpen && (
                <div
                    className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Side panel */}
            <aside className={`fixed top-0 right-0 h-full w-80 bg-card z-[70] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-border">
                    <div>
                        <p className="font-black text-sm">{user ? user.email?.split('@')[0] : t.nav.menu}</p>
                        {isAdmin && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">Admin</span>
                        )}
                        {isAuditor && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">Auditor</span>
                        )}
                    </div>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-muted rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                    {/* Language switcher in the panel */}
                    <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t.common.language}</span>
                        <LanguageSwitcher variant="pill" />
                    </div>

                    {/* Mobile Direct Wholesale Call Line for Google Ads & instant dialing */}
                    <div className="mx-2 my-2 p-3 rounded-2xl bg-primary/5 border border-primary/15 flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            {locale === 'en' ? 'Direct Wholesale Line' : 'Línea Directa Mayorista'}
                        </span>
                        <a
                            href="tel:+13477612687"
                            className="inline-flex items-center gap-2 text-xs font-black text-primary hover:text-[#5B0606] transition-colors underline underline-offset-2"
                        >
                            <Phone size={13} className="shrink-0 text-primary" />
                            <span>Wholesale: (347) 761-2687</span>
                        </a>
                    </div>

                    {/* Common links */}
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">{t.nav.general}</p>
                    <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm">
                        <Package size={18} className="text-primary" /> {t.nav.catalog}
                    </Link>
                    <button
                        type="button"
                        onClick={() => { setIsMenuOpen(false); setShowScheduleModal(true); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm text-left"
                    >
                        <Clock size={18} className="text-primary" /> {locale === 'en' ? 'Baking Schedule' : 'Horarios de Horneado'}
                    </button>
                    <Link href="/orders" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm">
                        <ClipboardList size={18} className="text-primary" /> {t.nav.myOrders}
                    </Link>
                    <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm">
                        <User size={18} className="text-primary" /> {t.nav.myProfile}
                    </Link>

                    {/* Legal & Compliance links */}
                    <div className="my-3 border-t border-border" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">{locale === 'en' ? 'Legal & Compliance' : 'Legal y Cumplimiento'}</p>
                    <Link href="/terms" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm">
                        <FileText size={18} className="text-primary" /> {locale === 'en' ? 'Commercial Terms' : 'Términos Comerciales'}
                    </Link>
                    <Link href="/privacy" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted transition-all font-bold text-sm">
                        <ShieldCheck size={18} className="text-primary" /> {locale === 'en' ? 'Privacy Policy' : 'Política de Privacidad'}
                    </Link>

                    {/* Admin links */}
                    {isAdmin && (
                        <>
                            <div className="my-3 border-t border-border" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">{t.nav.administration}</p>
                            <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <LayoutDashboard size={18} /> {t.nav.adminPanel}
                            </Link>
                            <Link href="/admin/products" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <Package size={18} /> {t.nav.products}
                            </Link>
                            <Link href="/admin/categories" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <ClipboardList size={18} /> {t.nav.categories}
                            </Link>
                            <Link href="/admin/orders" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <ShoppingCart size={18} /> {t.nav.adminOrders}
                            </Link>
                            <Link href="/admin/users" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <Users size={18} /> {t.nav.users}
                            </Link>
                            <Link href="/admin/deliveries" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/10 text-primary transition-all font-bold text-sm">
                                <Truck size={18} /> {t.nav.deliveries}
                            </Link>
                        </>
                    )}

                    {/* Auditor links */}
                    {isAuditor && (
                        <>
                            <div className="my-3 border-t border-border" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 px-3 py-2">
                                {locale === 'en' ? 'Audit & Finance' : 'Auditoría y Finanzas'}
                            </p>
                            <Link href="/admin/orders" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-all font-bold text-sm">
                                <ShoppingCart size={18} /> {locale === 'en' ? 'Orders & Invoices' : 'Pedidos y Facturación'}
                            </Link>
                            <Link href="/admin/reports" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-all font-bold text-sm">
                                <ClipboardList size={18} /> {locale === 'en' ? 'Tax & Sales Reports' : 'Reportes Fiscales y Ventas'}
                            </Link>
                            <Link href="/admin/finance" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-all font-bold text-sm">
                                <FileText size={18} /> {locale === 'en' ? 'Store Credit Ledger' : 'Libro de Store Credit'}
                            </Link>
                        </>
                    )}
                </nav>

                {/* Footer */}
                {user && (
                    <div className="px-4 py-4 border-t border-border">
                        <button
                            onClick={() => { signOut(); setIsMenuOpen(false); }}
                            className="w-full py-3 text-center text-sm font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                            {t.nav.logout}
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
