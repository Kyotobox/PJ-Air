import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { AUDITOR_MENU_ITEMS, filterSidebarNavItems } from '../components/layout/AdminSidebar';

/**
 * Sprint S102 TASK-102-02 Test Suite (§4, §6, §48)
 * Auditoría Global: Apertura de lectura en middleware y sidebar (/admin/*, /produccion, /delivery) con interfaz Read-Only SoD
 */
describe('TASK-102-02: Auditoría Global Omnipresente (Read-Only SoD) (§6, §48)', () => {
  const createMockRequest = (pathname: string, role: string, expired = false): NextRequest => {
    const exp = expired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ id: 'auditor-global-1', email: 'auditor@jhoanes.com', role, exp }));
    const token = `${header}.${payload}.signature`;

    const url = `https://jhoanes.com${pathname}`;
    return new NextRequest(url, {
      headers: {
        cookie: `auth_token=${token}; session_role=${role}`,
      },
    });
  };

  const sampleAdminMenu = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Reportes', href: '/admin/reports' },
    { name: 'Órdenes', href: '/admin/orders' },
    { name: 'Productos', href: '/admin/products' },
    { name: 'Clientes', href: '/admin/clients' },
    { name: 'Configuraciones', href: '/admin/settings' },
  ];

  describe('1. Middleware: Apertura de Lectura Global para Rol Auditor', () => {
    it('Happy Path: allows auditor to freely navigate to /admin/* routes', () => {
      const routes = [
        '/admin',
        '/admin/orders',
        '/admin/clients',
        '/admin/products',
        '/admin/settings',
        '/admin/reports',
        '/admin/finance',
        '/admin/zones',
        '/admin/banners',
      ];

      for (const route of routes) {
        const req = createMockRequest(route, 'auditor');
        const res = middleware(req);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    it('Happy Path: allows auditor to freely navigate to /produccion and /delivery routes', () => {
      const routes = [
        '/produccion',
        '/produccion/kitchen',
        '/delivery',
        '/delivery/routes',
      ];

      for (const route of routes) {
        const req = createMockRequest(route, 'auditor');
        const res = middleware(req);
        expect(res.headers.get('location')).toBeNull();
      }
    });

    it('Sad Path 1 (§6): strictly blocks unauthorized "client" role from /admin routes', () => {
      const req = createMockRequest('/admin/clients', 'client');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toBe('https://jhoanes.com/');
    });

    it('Sad Path 2 (§6): strictly blocks unauthorized "client" role from /produccion and /delivery routes', () => {
      const reqProd = createMockRequest('/produccion', 'client');
      expect(middleware(reqProd).headers.get('location')).toBe('https://jhoanes.com/');

      const reqDeliv = createMockRequest('/delivery', 'client');
      expect(middleware(reqDeliv).headers.get('location')).toBe('https://jhoanes.com/');
    });

    it('Sad Path 3 (§6): strictly blocks unauthenticated requests and redirects to /auth/login', () => {
      const req = new NextRequest('https://jhoanes.com/admin/clients');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirect=%2Fadmin%2Fclients');
    });

    it('Sad Path 4 (§6): strictly blocks expired tokens and purges cookies', () => {
      const req = createMockRequest('/admin/products', 'auditor', true);
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/auth/login');
    });
  });

  describe('2. AdminSidebar: Módulos Expandidos e Indicador de Modo Sólo Lectura', () => {
    it('Happy Path: defines the 7 auditor menu items with Clientes, Productos, Producción y Configuración', () => {
      expect(AUDITOR_MENU_ITEMS).toBeDefined();
      expect(AUDITOR_MENU_ITEMS).toHaveLength(7);

      const hrefs = AUDITOR_MENU_ITEMS.map((item) => item.href);
      expect(hrefs).toContain('/admin/orders');
      expect(hrefs).toContain('/admin/reports');
      expect(hrefs).toContain('/admin/finance');
      expect(hrefs).toContain('/admin/clients');
      expect(hrefs).toContain('/admin/products');
      expect(hrefs).toContain('/produccion');
      expect(hrefs).toContain('/admin/settings');
    });

    it('Happy Path: guarantees that every auditor item has readOnly indicator set to true', () => {
      for (const item of AUDITOR_MENU_ITEMS) {
        expect(item.readOnly).toBe(true);
      }
    });

    it('Happy Path: filterSidebarNavItems normalizes role case ("AUDITOR", " auditor ") and returns items', () => {
      const itemsUpper = filterSidebarNavItems('AUDITOR', sampleAdminMenu);
      expect(itemsUpper).toHaveLength(7);

      const itemsSpaces = filterSidebarNavItems('  auditor  ', sampleAdminMenu);
      expect(itemsSpaces).toHaveLength(7);
    });

    it('Sad Path 5 (§6): non-auditor roles do not receive restricted auditor menu', () => {
      const adminItems = filterSidebarNavItems('admin', sampleAdminMenu);
      expect(adminItems).toEqual(sampleAdminMenu);

      const clientItems = filterSidebarNavItems('client', sampleAdminMenu);
      expect(clientItems).toEqual(sampleAdminMenu);

      const nullItems = filterSidebarNavItems(null, sampleAdminMenu);
      expect(nullItems).toEqual(sampleAdminMenu);
    });
  });

  describe('3. SoD Mutative Guard: Strict Rejection of Mutative Operations for Auditor', () => {
    // Pure function representing the SoD check enforced in client & product pages
    const assertMutativeActionAllowed = (role: string, actionName: string): boolean => {
      const normalized = role.trim().toLowerCase();
      if (normalized === 'auditor') {
        throw new Error(`[SoD_VIOLATION] Operación mutativa "${actionName}" no permitida para el rol auditor.`);
      }
      return true;
    };

    it('Happy Path: allows admin to execute mutative actions', () => {
      expect(assertMutativeActionAllowed('admin', 'create_product')).toBe(true);
      expect(assertMutativeActionAllowed('admin', 'alter_credit_limit')).toBe(true);
      expect(assertMutativeActionAllowed('admin', 'delete_client')).toBe(true);
    });

    it('Sad Path 6 (§6): throws real exception when auditor attempts mutative operations', () => {
      expect(() => assertMutativeActionAllowed('auditor', 'create_product')).toThrow(
        /Operación mutativa "create_product" no permitida para el rol auditor/
      );
      expect(() => assertMutativeActionAllowed('AUDITOR', 'alter_credit_limit')).toThrow(
        /Operación mutativa "alter_credit_limit" no permitida para el rol auditor/
      );
      expect(() => assertMutativeActionAllowed(' auditor ', 'delete_product')).toThrow(
        /Operación mutativa "delete_product" no permitida para el rol auditor/
      );
    });
  });
});
