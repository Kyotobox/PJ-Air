import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authToken = request.cookies.get('auth_token')?.value;
  const cookieRole = request.cookies.get('session_role')?.value;

  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);

  // If no auth token is found, redirect to login without FOUC
  if (!authToken) {
    return NextResponse.redirect(loginUrl);
  }

  // Parse JWT payload to verify expiry and role
  const jwtPayload = decodeJwtPayload(authToken);
  if (jwtPayload?.exp && Date.now() >= jwtPayload.exp * 1000) {
    // Token expired
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    response.cookies.delete('session_role');
    return response;
  }

  // TASK-102-01: Prioridad estricta a jwtPayload?.role sobre cookieRole
  const tokenRole = jwtPayload?.role ? String(jwtPayload.role).trim().toLowerCase() : null;
  const cookieRoleNorm = cookieRole ? String(cookieRole).trim().toLowerCase() : null;
  const role = tokenRole || cookieRoleNorm || 'client';

  // Saneamiento de cookie residual si tokenRole difiere de cookieRole
  const syncResidualCookie = (res: NextResponse) => {
    if (tokenRole && cookieRoleNorm && cookieRoleNorm !== tokenRole) {
      res.cookies.set('session_role', tokenRole, {
        path: '/',
        maxAge: 604800,
        sameSite: 'lax',
      });
    }
    return res;
  };

  // Role-based access control para 'auditor'
  if (role === 'auditor') {
    // Rutas permitidas: /admin/orders (modo solo lectura contable), /admin/reports, /admin/finance
    const isAllowedAuditorPath =
      pathname.startsWith('/admin/orders') ||
      pathname.startsWith('/admin/reports') ||
      pathname.startsWith('/admin/finance');

    // Rutas terminantemente bloqueadas (/produccion/*, /delivery/*, /admin/zones, /admin/banners, /admin/settings, etc.)
    if (!isAllowedAuditorPath) {
      const redirectUrl = new URL('/admin/orders', request.url);
      redirectUrl.searchParams.set('notice', 'unauthorized_auditor_route');
      redirectUrl.searchParams.set('warning', 'Acceso no autorizado para el perfil de auditor.');
      return redirectUrl ? syncResidualCookie(NextResponse.redirect(redirectUrl)) : NextResponse.redirect(redirectUrl);
    }

    return syncResidualCookie(NextResponse.next());
  }

  // Role-based access control para resto de roles
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else if (pathname.startsWith('/delivery')) {
    if (role !== 'delivery' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  } else if (pathname.startsWith('/produccion')) {
    if (role !== 'produccion' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
  // /orders and /profile only require valid authentication (checked above)

  return syncResidualCookie(NextResponse.next());
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/delivery/:path*',
    '/produccion/:path*',
  ],
};
