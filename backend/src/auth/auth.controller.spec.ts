import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const mockAuthService = {
      signup: jest.fn(),
      login: jest.fn(),
      recoverPassword: jest.fn(),
      changePassword: jest.fn(),
      verifyPhone: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    it('should call authService.signup and return result', async () => {
      const body = { email: 'test@example.com', password: 'password' };
      const expectedResult = { message: 'User registered successfully', user: {} as any, session: {} as any };
      jest.spyOn(authService, 'signup').mockResolvedValue(expectedResult);

      const result = await controller.signup(body);
      expect(authService.signup).toHaveBeenCalledWith(body);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException if authService.signup throws', async () => {
      const body = { email: 'test@example.com', password: 'password' };
      jest.spyOn(authService, 'signup').mockRejectedValue(new Error('Conflict Error'));

      await expect(controller.signup(body)).rejects.toThrow(BadRequestException);
      await expect(controller.signup(body)).rejects.toThrow('Conflict Error');
    });
  });

  describe('login', () => {
    it('should throw BadRequestException if email or password are missing', async () => {
      await expect(controller.login({ email: 'test@example.com' })).rejects.toThrow(BadRequestException);
      await expect(controller.login({ password: 'password' })).rejects.toThrow(BadRequestException);
    });

    it('should call authService.login and return result', async () => {
      const expectedResult = { user: {} as any, session: {} as any };
      jest.spyOn(authService, 'login').mockResolvedValue(expectedResult);

      const result = await controller.login({ email: 'test@example.com', password: 'password' });
      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('recoverPassword', () => {
    it('should throw BadRequestException if identifier is missing', async () => {
      await expect(controller.recoverPassword({ identifier: '' })).rejects.toThrow(BadRequestException);
    });

    it('should call authService.recoverPassword and return result', async () => {
      const expectedResult = { message: 'Success', email: 'test@example.com' };
      jest.spyOn(authService, 'recoverPassword').mockResolvedValue(expectedResult);

      const result = await controller.recoverPassword({ identifier: 'test@example.com' });
      expect(authService.recoverPassword).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestException if fields are missing', async () => {
      await expect(controller.changePassword({ userId: '1', currentPassword: 'password' })).rejects.toThrow(BadRequestException);
    });

    it('should call authService.changePassword and return result', async () => {
      const expectedResult = { message: 'Password updated successfully' };
      jest.spyOn(authService, 'changePassword').mockResolvedValue(expectedResult);

      const result = await controller.changePassword({ userId: '1', currentPassword: 'old', newPassword: 'new' });
      expect(authService.changePassword).toHaveBeenCalledWith('1', 'old', 'new');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyPhone', () => {
    it('should call authService.verifyPhone with userId and body', async () => {
      const mockResult = { success: true, phone_verified: true, phone: '+13055550100' };
      (authService.verifyPhone as jest.Mock).mockResolvedValue(mockResult);

      const req = { user: { id: 'user-123' } };
      const body = { phone: '+13055550100', verificationCode: '123456' };

      const result = await controller.verifyPhone(req, body);
      expect(authService.verifyPhone).toHaveBeenCalledWith('user-123', body);
      expect(result).toEqual(mockResult);
    });

    it('should support verifyPhoneToken endpoint as well', async () => {
      const mockResult = { success: true, phone_verified: true, phone: '+13055550100' };
      (authService.verifyPhone as jest.Mock).mockResolvedValue(mockResult);

      const req = { user: { id: 'user-123' } };
      const body = { phone: '+13055550100', idToken: 'mock-valid-firebase-token' };

      const result = await controller.verifyPhoneToken(req, body);
      expect(authService.verifyPhone).toHaveBeenCalledWith('user-123', body);
      expect(result).toEqual(mockResult);
    });
  });
});
