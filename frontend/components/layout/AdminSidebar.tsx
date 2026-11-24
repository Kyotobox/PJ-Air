'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Layers, Users, Truck, Settings, LogOut, ChevronLeft, ChevronRight, BarChart3, MapPin, MessageSquare, Sparkles, Calendar, ShieldCheck, Tag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

// TASK-102-02: Enlaces para rol auditor (Apertura Global SoD: /admin/*, /produccion, /delivery) con indicador de sólo lectura
export interface AuditorMenuItem {
    name: string;
    icon: any;
    href: string;
    readOnly?: boolean;
}

export const AUDITOR_MENU_ITEMS: AuditorMenuItem[] = [
    { name: '📊 Facturación y Ventas', icon: ShoppingBag, href: '/admin/orders', readOnly: true },
    { name: '📈 Reportes Fiscales', icon: BarChart3, href: '/admin/reports', readOnly: true },
    { name: '🏷️ Libro de Store Credit', icon: Tag, href: '/admin/finance', readOnly: true },
    { name: '👥 Clientes', icon: Users, href: '/admin/clients', readOnly: true },
    { name: '📦 Productos', icon: ShoppingBag, href: '/admin/products', readOnly: true },
    { name: '🏭 Producción', icon: Layers, href: '/produccion', readOnly: true },
    { name: '⚙️ Configuración', icon: Settings, href: '/admin/settings', readOnly: true },
];

/**
 * Filtra los enlaces de navegación del sidebar según el rol del usuario (§6, §48, TASK-102-02).
 * Para el rol auditor, muestra los módulos de Facturación, Reportes, Store Credit, Clientes, Productos,
 * Producción y Configuración con indicador explícito de modo sólo lectura.
 */
export function filterSidebarNavItems<T = any>(role: string | undefined | null, fullMenuItems: T[]): T[] {
    const normalizedRole = role ? String(role).trim().toLowerCase() : '';
    if (normalizedRole === 'auditor') {
        return AUDITOR_MENU_ITEMS as unknown as T[];
    }
    return fullMenuItems;
}

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { signOut, user, profile, isLoading } = useAuth();
    const { t, locale } = useLanguage();
    const [collapsed, setCollapsed] = useState(false);

    const rawRole = (user as any)?.role || profile?.role || (user as any)?.user_metadata?.role;
    const userRole = rawRole ? String(rawRole).trim().toLowerCase() : '';
    const isAuditor = userRole === 'auditor';

    useEffect(() => {
        if (!isLoading) {
            const localSession = localStorage.getItem('local_session');
            if (!user && !localSession) {
                router.push('/auth/login');
            } else if (profile && profile.role !== 'admin' && profile.role !== 'auditor') {
                router.push('/');
            }
        }
    }, [isLoading, user, profile, router]);

    const MENU_ITEMS = [
        { name: t.adminSidebar.dashboard,   icon: LayoutDashboard, href: '/admin' },
        { name: t.adminSidebar.reports,     icon: BarChart3,        href: '/admin/reports' },
        { name: t.adminSidebar.orders,      icon: ShoppingBag,      href: '/admin/orders' },
        { name: t.adminSidebar.products,    icon: ShoppingBag,     href: '/admin/products' },
        { name: t.adminSidebar.categories,  icon: Layers,           href: '/admin/categories' },
        { name: t.adminSidebar.users,       icon: Users,            href: '/admin/users' },
        { name: t.adminSidebar.clients,     icon: Users,            href: '/admin/clients' },
        { name: t.adminSidebar.routes,      icon: Truck,            href: '/admin/routes' },
        { name: locale === 'en' ? 'B2B Feedback' : 'Buzón Feedback', icon: MessageSquare, href: '/admin/feedback' },
        { name: locale === 'en' ? 'Seasonal Banners' : 'Banners Temporada', icon: Sparkles, href: '/admin/banners' },
        { name: locale === 'en' ? 'Delivery Zones' : 'Zonas Delivery', icon: MapPin, href: '/admin/zones' },
        { name: locale === 'en' ? 'Dispatch Schedule' : 'Días de Despacho', icon: Calendar, href: '/admin/dispatch' },
        { name: locale === 'en' ? 'Audit Trail' : 'Bitácora Forense', icon: ShieldCheck, href: '/admin/audit-logs' },
        { name: t.adminSidebar.settings,    icon: Settings,         href: '/admin/settings' },
    ];

    // Enlaces exclusivos para rol auditor (Read-Only SoD)
    const navItems = filterSidebarNavItems(userRole, MENU_ITEMS);

    const handleLogout = async () => {
        await signOut();
        router.push('/auth/login');
    };

    return (
        <div className={`AdminSidebar ${collapsed ? 'w-20' : 'w-64'} bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out z-10`}>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between gap-2 min-h-[72px]">
                {!collapsed && (
                    <button
                        onClick={() => setCollapsed(true)}
                        className="text-xl font-bold text-primary flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
                        title="Collapse menu"
                    >
                        <span className="bg-primary text-white px-2 py-1 rounded-lg text-sm shrink-0">PJ</span>
                        <span className="truncate">Admin Panel</span>
                    </button>
                )}
                {collapsed && (
                    <button onClick={() => setCollapsed(false)} className="mx-auto" title="Expand menu">
                        <span className="bg-primary text-white px-2 py-1 rounded-lg text-sm font-bold">PJ</span>
                    </button>
                )}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
                    title={collapsed ? 'Expand menu' : 'Collapse menu'}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Insignia de perfil para rol Auditor */}
            {isAuditor && (
                <div
                    data-testid="auditor-profile-badge"
                    className={`mx-3 my-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}
                    title="🛡️ Auditor Global (Read-Only SoD)"
                >
                    {!collapsed ? (
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold tracking-tight truncate">
                                🛡️ Auditor Global
                            </span>
                            <span className="text-[10px] text-amber-600/90 dark:text-amber-400/90 font-semibold">
                                Modo Sólo Lectura (SoD)
                            </span>
                        </div>
                    ) : (
                        <span className="text-base leading-none" title="🛡️ Auditor Global (Read-Only SoD)">🛡️</span>
                    )}
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item: any) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                    const isReadOnly = Boolean(item.readOnly || isAuditor);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? `${item.name}${isReadOnly ? ' (Solo Lectura)' : ''}` : undefined}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-secondary hover:text-primary'}`}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!collapsed && (
                                <div className="flex items-center justify-between flex-1 min-w-0">
                                    <span className="truncate">{item.name}</span>
                                    {isReadOnly && (
                                        <span
                                            data-testid="readonly-indicator"
                                            className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0"
                                            title="Modo sólo lectura"
                                        >
                                            Lectura
                                        </span>
                                    )}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-border">
                <button
                    onClick={handleLogout}
                    title={collapsed ? t.adminSidebar.logout : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors ${collapsed ? 'justify-center' : ''}`}
                >
                    <LogOut size={20} className="shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">{t.adminSidebar.logout}</span>}
                </button>
            </div>
        </div>
    );
}
