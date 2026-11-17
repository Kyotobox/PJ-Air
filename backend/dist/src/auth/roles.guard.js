"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
let RolesGuard = class RolesGuard {
    reflector;
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const handler = context.getHandler();
        const targetClass = typeof context.getClass === 'function' ? context.getClass() : null;
        let roles;
        if (targetClass && typeof this.reflector.getAllAndOverride === 'function') {
            roles = this.reflector.getAllAndOverride('roles', [handler, targetClass]);
        }
        if (!roles) {
            roles = this.reflector.get('roles', handler);
        }
        const request = context.switchToHttp().getRequest();
        const user = request?.user;
        const method = (request?.method || 'GET').toUpperCase();
        const userRole = user?.role ? String(user.role).trim().toLowerCase() : '';
        if (userRole === 'auditor') {
            const mutativeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
            if (mutativeMethods.includes(method)) {
                throw new common_1.ForbiddenException('Access denied: auditor role is strictly read-only (SoD). Mutations are forbidden.');
            }
            if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
                throw new common_1.ForbiddenException('Access denied: auditor role is strictly read-only.');
            }
        }
        if (!roles || roles.length === 0)
            return true;
        if (!user || !userRole) {
            throw new common_1.ForbiddenException('Access denied: insufficient permissions');
        }
        if (userRole === 'auditor') {
            if (roles.includes('auditor')) {
                return true;
            }
            if (roles.includes('admin')) {
                const url = (request.originalUrl || request.url || '').toLowerCase();
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
                    throw new common_1.ForbiddenException('Access denied: auditor role cannot access operational or configuration endpoints');
                }
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
                throw new common_1.ForbiddenException('Access denied: auditor role is restricted to accounting and audit queries');
            }
            throw new common_1.ForbiddenException('Access denied: insufficient permissions');
        }
        if (!roles.includes(user.role)) {
            throw new common_1.ForbiddenException('Access denied: insufficient permissions');
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
//# sourceMappingURL=roles.guard.js.map