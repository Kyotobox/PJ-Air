import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const targetClass = typeof context.getClass === 'function' ? context.getClass() : null;

    let roles: string[] | undefined;
    if (targetClass && typeof this.reflector.getAllAndOverride === 'function') {
      roles = this.reflector.getAllAndOverride<string[]>('roles', [handler, targetClass]);
    }
    if (!roles) {
      roles = this.reflector.get<string[]>('roles', handler);
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;
    const method = (request?.method || 'GET').toUpperCase();

    const userRole = user?.role ? String(user.role).trim().toLowerCase() : '';

    // Regla de oro de seguridad (Read-Only SoD - Segregación de Funciones):
    // Un usuario con rol 'auditor' queda terminantemente bloqueado para peticiones
    // HTTP POST, PUT, PATCH, DELETE en endpoints operativos (retornar 403 Forbidden).
    // Solo tiene permitido GET a consultas contables y de auditoría.
    if (userRole === 'auditor') {
      const mutativeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (mutativeMethods.includes(method)) {
        throw new ForbiddenException('Access denied: auditor role is strictly read-only (SoD). Mutations are forbidden.');
      }

      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        throw new ForbiddenException('Access denied: auditor role is strictly read-only.');
      }
    }

    if (!roles || roles.length === 0) return true;

    if (!user || !userRole) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    // Soporte nativo para rol 'auditor' en consultas GET contables y de auditoría
    if (userRole === 'auditor') {
      if (roles.includes('auditor')) {
        return true;
      }

      if (roles.includes('admin')) {
        const url = (request.originalUrl || request.url || '').toLowerCase();

        // Bloqueo explícito de endpoints operativos y de configuración
        const blockedPatterns = [
          '/zones',
          '/banners',
          '/settings',
          '/produccion',
          '/delivery',
          '/routes',
          '/dispatch',
          '/categories',
        ];

        const isBlocked = blockedPatterns.some((pattern) => url.includes(pattern));
        if (isBlocked) {
          throw new ForbiddenException('Access denied: auditor role cannot access operational or configuration endpoints');
        }

        // Consultas contables y de auditoría permitidas
        const allowedPatterns = [
          '/orders',
          '/reports',
          '/finance',
          '/tax',
          '/payments',
          '/check-payments',
          '/delivery-incidents',
          '/admin-actions',
          '/audit',
          '/clients',
          '/users',
        ];

        const isAllowed = allowedPatterns.length === 0 || allowedPatterns.some((pattern) => url.includes(pattern));
        if (isAllowed) {
          return true;
        }

        throw new ForbiddenException('Access denied: auditor role is restricted to accounting and audit queries');
      }

      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
