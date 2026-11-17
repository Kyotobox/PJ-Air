import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class ResourceOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    // Admins have universal access; auditors have read-only access for GET queries
    if (user.role === 'admin' || (user.role === 'auditor' && (request.method || 'GET').toUpperCase() === 'GET')) {
      return true;
    }

    // Check param userId if present
    if (request.params && request.params.userId) {
      if (request.params.userId !== user.id) {
        throw new ForbiddenException('Cannot access resources belonging to other users');
      }
    }

    return true;
  }
}
