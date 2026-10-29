'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Layers, Users, Truck, Settings, LogOut, ChevronLeft, ChevronRight, BarChart3, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { signOut, user, profile, isLoading } = useAuth();
    const { t, locale } = useLanguage();
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            const localSession = localStorage.getItem('local_session');
            if (!user && !localSession) {
                router.push('/auth/login');
            } else if (profile && profile.role !== 'admin') {
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
        { name: locale === 'en' ? 'Delivery Zones' : 'Zonas Delivery', icon: MapPin, href: '/admin/zones' },
        { name: t.adminSidebar.settings,    icon: Settings,         href: '/admin/settings' },
    ];

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

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {MENU_ITEMS.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.name : undefined}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-secondary hover:text-primary'}`}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
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
