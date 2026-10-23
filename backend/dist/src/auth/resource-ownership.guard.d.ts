import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class ResourceOwnershipGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
