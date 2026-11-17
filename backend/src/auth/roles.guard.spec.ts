import { RolesGuard } from './roles.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('Happy Paths: Standard Roles & Auditor Read-Only Access', () => {
    it('should allow access when user roles match required roles', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'admin' },
            method: 'GET',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow auditor access to endpoints explicitly tagged with auditor role', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['auditor']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow auditor GET access to admin accounting endpoints (/admin/orders)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin/orders',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow auditor GET access to admin reports endpoints (/admin/reports)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin/reports/sales-tax',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow auditor GET access to finance and audit logs (/admin-actions/audit-logs)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin-actions/audit-logs',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow access when no roles are required', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
          }),
        }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Sad Paths: Security & Read-Only Separation of Duties (SoD) Rejections (§6)', () => {
    it('should throw ForbiddenException when auditor attempts POST mutation (SoD)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'auditor']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'POST',
            url: '/admin/orders',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts PUT mutation (SoD)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'PUT',
            url: '/admin/orders/123',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts PATCH mutation (SoD)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'PATCH',
            url: '/admin/orders/123/status',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts DELETE mutation (SoD)', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'DELETE',
            url: '/admin/orders/123',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts GET on operational zones endpoint', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin/zones',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts GET on operational banners endpoint', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin/banners',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when auditor attempts GET on settings endpoint', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'auditor' },
            method: 'GET',
            url: '/admin/settings',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user roles do not match required roles', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: 'client' },
            method: 'GET',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is missing or role is missing', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
      const mockExecutionContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: null,
            method: 'GET',
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });
});
