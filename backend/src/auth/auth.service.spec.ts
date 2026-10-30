import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { hashPassword, verifyJwt } from './crypto.util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SystemConfig } from '../system-configs/system-config.entity';

jest.mock('nodemailer');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findByIdentifier: jest.fn(),
    findByEmailWithRole: jest.fn(),
    create: jest.fn(),
    createProfile: jest.fn(),
    findOne: jest.fn(),
    updatePassword: jest.fn(),
    updateProfile: jest.fn(),
  };

  const mockSystemConfigRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: getRepositoryToken(SystemConfig), useValue: mockSystemConfigRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should throw BadRequestException if tax_id is missing or empty (Sad Path - TASK-49-01)', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
        tax_id: '',
      })).rejects.toThrow(new BadRequestException('El Tax ID / NY Resale Certificate # es obligatorio para registros mayoristas'));

      await expect(service.register({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      })).rejects.toThrow(new BadRequestException('El Tax ID / NY Resale Certificate # es obligatorio para registros mayoristas'));
    });

    it('should throw BadRequestException if phone number is missing or invalid for wholesale registration', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '123',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone is not verified', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if idToken is invalid', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'invalid-token',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if email already registered', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1' });
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      })).rejects.toThrow(ConflictException);
    });

    it('should create user and profile and return session with mandatory Tax ID (Happy Path - TASK-49-01)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: '1', email: 'test@example.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      const result = await service.signup({
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      });
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(mockUsersService.createProfile).toHaveBeenCalled();
      expect(result).toHaveProperty('session');
      expect(verifyJwt(result.session.access_token)).not.toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValue(null);
      mockUsersService.findByIdentifier.mockResolvedValue(null);
      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    });

    it('should return session on successful login with plain-text migration', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValue({ id: '1', email: 'test@example.com', password: 'password' });
      const result = await service.login('test@example.com', 'password');
      expect(result).toHaveProperty('session');
      expect(verifyJwt(result.session.access_token)).not.toBeNull();
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
    });

    it('should return session on successful login with hashed password', async () => {
      const hashedPassword = hashPassword('password');
      mockUsersService.findByEmailWithRole.mockResolvedValue({ id: '1', email: 'test@example.com', password: hashedPassword });
      const result = await service.login('test@example.com', 'password');
      expect(result).toHaveProperty('session');
      expect(verifyJwt(result.session.access_token)).not.toBeNull();
    });
  });

  describe('recoverPassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findByIdentifier.mockResolvedValue(null);
      await expect(service.recoverPassword('test@example.com')).rejects.toThrow(UnauthorizedException);
    });

    it('should trigger recovery email with temporary password and update it in DB', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', email: 'test@example.com', password: 'mypassword' });
      
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: '123' });
      const mockVerify = jest.fn().mockResolvedValue(true);
      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        verify: mockVerify,
        sendMail: mockSendMail,
      });

      const result = await service.recoverPassword('test@example.com');
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalled();
      
      // The email should contain a temporary password (which is a 12-char hex string)
      const emailText = mockSendMail.mock.calls[0][0].text;
      expect(emailText).toContain('nueva contraseña temporal');
      expect(result).toHaveProperty('message');
    });
  });

  describe('changePassword', () => {
    it('should throw UnauthorizedException if current password is wrong', async () => {
      const hashedPassword = hashPassword('oldpassword');
      mockUsersService.findOne.mockResolvedValue({ id: '1', email: 'test@example.com', password: hashedPassword });
      mockUsersService.findByEmailWithRole.mockResolvedValue({ id: '1', email: 'test@example.com', password: hashedPassword });
      await expect(service.changePassword('1', 'wrongpassword', 'newpassword')).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and return success message', async () => {
      const hashedPassword = hashPassword('oldpassword');
      mockUsersService.findOne.mockResolvedValue({ id: '1', email: 'test@example.com', password: hashedPassword });
      mockUsersService.findByEmailWithRole.mockResolvedValue({ id: '1', email: 'test@example.com', password: hashedPassword });
      mockUsersService.updatePassword.mockResolvedValue(true);
      const result = await service.changePassword('1', 'oldpassword', 'newpassword');
      expect(mockUsersService.updatePassword).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Password updated successfully' });
    });
  });

  describe('verifyPhone', () => {
    it('should successfully verify phone with valid code (123456)', async () => {
      mockUsersService.updateProfile.mockResolvedValue({
        id: 'user-1',
        phone: '+13055550100',
        phone_verified: true,
      });

      const result = await service.verifyPhone('user-1', {
        phone: '+13055550100',
        verificationCode: '123456',
      });

      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-1', {
        phone: '+13055550100',
        phone_verified: true,
      });
      expect(result).toEqual({
        success: true,
        phone_verified: true,
        phone: '+13055550100',
      });
    });

    it('should throw BadRequestException if code is invalid', async () => {
      await expect(
        service.verifyPhone('user-1', {
          phone: '+13055550100',
          verificationCode: '999999',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone format is invalid', async () => {
      await expect(
        service.verifyPhone('user-1', {
          phone: '12345',
          verificationCode: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone is missing or empty', async () => {
      await expect(
        service.verifyPhone('user-1', {
          phone: '',
          verificationCode: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if userId is missing', async () => {
      await expect(
        service.verifyPhone('', {
          phone: '+13055550100',
          verificationCode: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should verify with valid mock Firebase ID token', async () => {
      mockUsersService.updateProfile.mockResolvedValue({
        id: 'user-1',
        phone: '+13055550100',
        phone_verified: true,
      });

      const result = await service.verifyPhone('user-1', {
        phone: '+13055550100',
        idToken: 'mock-valid-firebase-token',
      });

      expect(result.success).toBe(true);
      expect(result.phone_verified).toBe(true);
    });

    it('should throw BadRequestException with invalid Firebase ID token', async () => {
      await expect(
        service.verifyPhone('user-1', {
          phone: '+13055550100',
          idToken: 'invalid-token',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

