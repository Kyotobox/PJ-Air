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

    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role || !roles.includes(user.role)) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
