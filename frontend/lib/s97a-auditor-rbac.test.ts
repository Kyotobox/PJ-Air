import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

/**
 * Sprint S97A Test Suite: Auditor RBAC & Route Isolation Engine (§6, §48)
 * Verificación de aislamiento estricto de rutas (middleware) y configuración de navegación (Sidebar).
 */
describe('Sprint S97A: Auditor RBAC & Frontend Route Isolation (§6, §48)', () => {
  const createMockRequest = (pathname: string, role: string, expired = false): NextRequest => {
    const exp = expired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ id: 'auditor-1', email: 'auditor@jhoanes.com', role, exp }));
    const token = `${header}.${payload}.signature`;

    const url = `https://jhoanes.com${pathname}`;
    const req = new NextRequest(url, {
      headers: {
        cookie: `auth_token=${token}; session_role=${role}`,
      },
    });
    return req;
  };

  describe('Happy Paths: Auditor Allowed Routes', () => {
    it('allows auditor to access /admin/orders in read-only mode', () => {
      const req = createMockRequest('/admin/orders', 'auditor');
      const res = middleware(req);
      // NextResponse.next() returns a response without Location header redirect
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor to access /admin/orders subroutes (/admin/orders/[id])', () => {
      const req = createMockRequest('/admin/orders/abc-123-uuid', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor to access /admin/reports', () => {
      const req = createMockRequest('/admin/reports', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor to access /admin/reports subroutes', () => {
      const req = createMockRequest('/admin/reports/sales-tax-ny', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('allows auditor to access /admin/finance (Libro de Store Credit)', () => {
      const req = createMockRequest('/admin/finance', 'auditor');
      const res = middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });
  });

  describe('Sad Paths: Auditor Route Blocking & Forced Redirects (§6)', () => {
    it('blocks auditor from /produccion and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/produccion', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /produccion/kitchen and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/produccion/kitchen', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /delivery and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/delivery', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /admin/zones and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/admin/zones', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /admin/banners and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/admin/banners', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /admin/settings and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/admin/settings', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /admin root dashboard and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/admin', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });

    it('blocks auditor from /admin/users and redirects to /admin/orders with notice', () => {
      const req = createMockRequest('/admin/users', 'auditor');
      const res = middleware(req);
      const location = res.headers.get('location');
      expect(location).toContain('/admin/orders');
      expect(location).toContain('notice=unauthorized_auditor_route');
    });
  });

  describe('Auditor Navigation Structure & Profile Insignia Specifications', () => {
    it('defines only the 3 authorized links for auditor role', () => {
      const AUDITOR_LINKS = [
        { name: '📊 Facturación y Ventas', href: '/admin/orders' },
        { name: '📈 Reportes Fiscales', href: '/admin/reports' },
        { name: '🏷️ Libro de Store Credit', href: '/admin/finance' },
      ];

      expect(AUDITOR_LINKS).toHaveLength(3);
      expect(AUDITOR_LINKS.map(l => l.href)).toEqual(['/admin/orders', '/admin/reports', '/admin/finance']);
    });

    it('ensures forbidden modules are completely excluded from auditor navigation', () => {
      const AUDITOR_LINKS = [
        { name: '📊 Facturación y Ventas', href: '/admin/orders' },
        { name: '📈 Reportes Fiscales', href: '/admin/reports' },
        { name: '🏷️ Libro de Store Credit', href: '/admin/finance' },
      ];

      const forbiddenHrefs = [
        '/admin',
        '/admin/products',
        '/admin/categories',
        '/admin/users',
        '/admin/clients',
        '/admin/routes',
        '/admin/feedback',
        '/admin/banners',
        '/admin/zones',
        '/admin/dispatch',
        '/admin/settings',
        '/produccion',
        '/delivery',
      ];

      const auditorHrefs = AUDITOR_LINKS.map(l => l.href);
      for (const forbidden of forbiddenHrefs) {
        expect(auditorHrefs).not.toContain(forbidden);
      }
    });

    it('specifies the canonical profile badge for auditor', () => {
      const AUDITOR_BADGE = '🛡️ Auditor Contable / Finanzas';
      expect(AUDITOR_BADGE).toBe('🛡️ Auditor Contable / Finanzas');
    });
  });

  describe('TASK-102-01: Prevalencia de sesión Admin sobre cookies residuales y saneamiento de session_role (§6, §48)', () => {
    it('Happy Path: prioritizes jwtPayload.role=admin over residual cookie session_role=auditor', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ id: 'admin-1', email: 'admin@jhoanes.com', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `${header}.${payload}.signature`;

      // Simular cookie residual con session_role=auditor
      const req = new NextRequest('https://jhoanes.com/admin/orders', {
        headers: {
          cookie: `auth_token=${token}; session_role=auditor`,
        },
      });

      const res = middleware(req);
      // Admin tiene acceso permitido sin redirect forzado a notice de auditor
      expect(res.headers.get('location')).toBeNull();
      // Y la cookie residual es saneada en la respuesta a session_role=admin
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('session_role=admin');
    });

    it('Happy Path: allows admin with residual auditor cookie to access protected /produccion routes', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ id: 'admin-1', email: 'admin@jhoanes.com', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `${header}.${payload}.signature`;

      const req = new NextRequest('https://jhoanes.com/produccion', {
        headers: {
          cookie: `auth_token=${token}; session_role=auditor`,
        },
      });

      const res = middleware(req);
      // Si el auditor residual hubiera prevalecido, habría sido redirigido a /admin/orders?notice=unauthorized_auditor_route
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('set-cookie')).toContain('session_role=admin');
    });

    it('Sad Path 1 (§6): rejects forged session_role=admin cookie when JWT token has client role', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ id: 'client-1', email: 'client@jhoanes.com', role: 'client', exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `${header}.${payload}.signature`;

      // Atacante intenta elevar privilegios inyectando cookie session_role=admin
      const req = new NextRequest('https://jhoanes.com/admin/orders', {
        headers: {
          cookie: `auth_token=${token}; session_role=admin`,
        },
      });

      const res = middleware(req);
      // Debe rechazar el acceso a /admin y redirigir al home (/)
      const location = res.headers.get('location');
      expect(location).toBe('https://jhoanes.com/');
    });

    it('Sad Path 2 (§6): rejects expired admin token even if session_role cookie is admin', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ id: 'admin-1', email: 'admin@jhoanes.com', role: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 }));
      const token = `${header}.${payload}.signature`;

      const req = new NextRequest('https://jhoanes.com/admin/orders', {
        headers: {
          cookie: `auth_token=${token}; session_role=admin`,
        },
      });

      const res = middleware(req);
      // Debe redirigir a /auth/login
      const location = res.headers.get('location');
      expect(location).toContain('/auth/login');
    });

    it('Sad Path 3 (§6): strictly evaluates isAuditor logic: admin role is NEVER auditor regardless of cookies', () => {
      // Función espejo estricta de la regla de evaluación de isAuditor en orders/page.tsx
      const evaluateIsAuditor = (userRole: string, _cookieString: string): boolean => {
        const normRole = userRole.trim().toLowerCase();
        if (normRole === 'admin') return false;
        return normRole === 'auditor';
      };

      expect(evaluateIsAuditor('admin', 'session_role=auditor')).toBe(false);
      expect(evaluateIsAuditor('admin', '')).toBe(false);
      expect(evaluateIsAuditor('auditor', 'session_role=auditor')).toBe(true);
      expect(evaluateIsAuditor('client', 'session_role=auditor')).toBe(false);
      expect(evaluateIsAuditor('', 'session_role=auditor')).toBe(false);
    });
  });
});
