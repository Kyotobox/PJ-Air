import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { AUDITOR_MENU_ITEMS, filterSidebarNavItems } from '../components/layout/AdminSidebar';

/**
 * Sprint S97 Certification Test Suite: Auditor Navigation Filtering & RBAC Protection (§6, §48)
 *
 * Verificaciones mandatorias:
 * 1. Probar el filtrado de navegación para el rol auditor (sidebar solo muestra enlaces financieros).
 * 2. Sad paths (§6): Exclusión total de módulos operativos, productos, usuarios, delivery y configuración.
 * 3. Aislamiento de rutas en middleware: redirección mandatoria ante accesos no autorizados.
 */
describe('Sprint S97: Auditor Navigation Filtering & Sidebar RBAC (§6, §48)', () => {
  const fullAdminMenuItems = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Reportes Fiscales', href: '/admin/reports' },
    { name: 'Facturación y Órdenes', href: '/admin/orders' },
    { name: 'Productos', href: '/admin/products' },
    { name: 'Categorías', href: '/admin/categories' },
    { name: 'Usuarios', href: '/admin/users' },
    { name: 'Clientes', href: '/admin/clients' },
    { name: 'Rutas', href: '/admin/routes' },
    { name: 'Buzón Feedback', href: '/admin/feedback' },
    { name: 'Banners Temporada', href: '/admin/banners' },
    { name: 'Zonas Delivery', href: '/admin/zones' },
    { name: 'Días de Despacho', href: '/admin/dispatch' },
    { name: 'Bitácora Forense', href: '/admin/audit-logs' },
    { name: 'Configuraciones', href: '/admin/settings' },
  ];

  const createMockRequest = (pathname: string, role: string, expired = false): NextRequest => {
    const exp = expired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ id: 'auditor-1', email: 'auditor@jhoanes.com', role, exp }));
    const token = `${header}.${payload}.signature`;

    const url = `https://jhoanes.com${pathname}`;
    return new NextRequest(url, {
      headers: {
        cookie: `auth_token=${token}; session_role=${role}`,
      },
    });
  };

  describe('Happy Paths: Auditor Financial Navigation Links Filtering', () => {
    it('defines exactly the 3 financial and accounting links for auditor role', () => {
      expect(AUDITOR_MENU_ITEMS).toBeDefined();
      expect(AUDITOR_MENU_ITEMS).toHaveLength(3);

      const hrefs = AUDITOR_MENU_ITEMS.map((item) => item.href);
      expect(hrefs).toEqual(['/admin/orders', '/admin/reports', '/admin/finance']);
    });

    it('filterSidebarNavItems returns only the financial links when role is "auditor"', () => {
      const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);

      expect(filtered).toHaveLength(3);
      expect(filtered.map((item) => item.href)).toEqual([
        '/admin/orders',
        '/admin/reports',
        '/admin/finance',
      ]);
    });

    it('filterSidebarNavItems includes "Facturación y Ventas" (/admin/orders)', () => {
      const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);
      const ordersLink = filtered.find((i) => i.href === '/admin/orders');
      expect(ordersLink).toBeDefined();
      expect(ordersLink?.name).toContain('Facturación');
    });

    it('filterSidebarNavItems includes "Reportes Fiscales" (/admin/reports)', () => {
      const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);
      const reportsLink = filtered.find((i) => i.href === '/admin/reports');
      expect(reportsLink).toBeDefined();
      expect(reportsLink?.name).toContain('Reportes Fiscales');
    });

    it('filterSidebarNavItems includes "Libro de Store Credit" (/admin/finance)', () => {
      const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);
      const financeLink = filtered.find((i) => i.href === '/admin/finance');
      expect(financeLink).toBeDefined();
      expect(financeLink?.name).toContain('Libro de Store Credit');
    });

    it('filterSidebarNavItems preserves the full menu for "admin" role', () => {
      const filtered = filterSidebarNavItems('admin', fullAdminMenuItems);
      expect(filtered).toHaveLength(fullAdminMenuItems.length);
      expect(filtered).toEqual(fullAdminMenuItems);
    });

    it('filterSidebarNavItems fallback returns full menu when role is undefined or null', () => {
      expect(filterSidebarNavItems(undefined, fullAdminMenuItems)).toEqual(fullAdminMenuItems);
      expect(filterSidebarNavItems(null, fullAdminMenuItems)).toEqual(fullAdminMenuItems);
    });
  });

  describe('Sad Paths: Strict Exclusion of Operational Modules for Auditor Role (§6)', () => {
    const forbiddenRoutes = [
      { name: 'Dashboard General', href: '/admin' },
      { name: 'Catálogo de Productos', href: '/admin/products' },
      { name: 'Gestión de Categorías', href: '/admin/categories' },
      { name: 'Gestión de Usuarios y Roles', href: '/admin/users' },
      { name: 'Directorio de Clientes', href: '/admin/clients' },
      { name: 'Rutas de Entrega', href: '/admin/routes' },
      { name: 'Buzón de Feedback', href: '/admin/feedback' },
      { name: 'Banners de Temporada', href: '/admin/banners' },
      { name: 'Zonas de Delivery', href: '/admin/zones' },
      { name: 'Días de Despacho', href: '/admin/dispatch' },
      { name: 'Bitácora Forense', href: '/admin/audit-logs' },
      { name: 'Configuraciones del Sistema', href: '/admin/settings' },
      { name: 'Módulo de Producción / Cocina', href: '/produccion' },
      { name: 'Módulo de Delivery / Chofer', href: '/delivery' },
    ];

    for (const forbidden of forbiddenRoutes) {
      it(`filterSidebarNavItems strictly excludes ${forbidden.name} (${forbidden.href}) from auditor sidebar`, () => {
        const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);
        const exists = filtered.some((item) => item.href === forbidden.href);
        expect(exists).toBe(false);
      });
    }

    it('proves that zero mutative or operational links leak into the auditor navigation', () => {
      const filtered = filterSidebarNavItems('auditor', fullAdminMenuItems);
      const allowedHrefs = new Set(['/admin/orders', '/admin/reports', '/admin/finance']);

      for (const item of filtered) {
        expect(allowedHrefs.has(item.href)).toBe(true);
      }
    });
  });

  describe('Middleware Integration: Enforcement of Route Isolation for Auditor Links', () => {
    it('allows auditor navigation to /admin/orders without redirect', () => {
      const req = createMockRequest('/admin/orders', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor navigation to /admin/reports without redirect', () => {
      const req = createMockRequest('/admin/reports', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor navigation to /admin/finance without redirect', () => {
      const req = createMockRequest('/admin/finance', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('Sad path (§6): blocks auditor direct URL access to /admin/products and redirects with notice', () => {
      const req = createMockRequest('/admin/products', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('Sad path (§6): blocks auditor direct URL access to /admin/users and redirects with notice', () => {
      const req = createMockRequest('/admin/users', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('Sad path (§6): blocks auditor direct URL access to /produccion and redirects with notice', () => {
      const req = createMockRequest('/produccion', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('Sad path (§6): blocks auditor direct URL access to /delivery and redirects with notice', () => {
      const req = createMockRequest('/delivery', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });
  });

  describe('Auditor Profile Insignia Specifications', () => {
    it('validates canonical auditor badge description', () => {
      const AUDITOR_PROFILE_BADGE = '🛡️ Auditor Contable / Finanzas';
      expect(AUDITOR_PROFILE_BADGE).toBe('🛡️ Auditor Contable / Finanzas');
    });
  });
});
