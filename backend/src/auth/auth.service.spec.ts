import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { St120GeneratorService } from '../tax/st120-generator.service';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { hashPassword, verifyJwt } from './crypto.util';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SystemConfig } from '../system-configs/system-config.entity';
import { Address } from '../addresses/address.entity';

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
    setResetPasswordToken: jest.fn().mockResolvedValue(true),
    findByResetPasswordToken: jest.fn(),
    clearResetPasswordToken: jest.fn().mockResolvedValue(true),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  const mockSystemConfigRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  };

  const mockAddressRepository = {
    create: jest.fn((dto) => ({ id: 'addr-uuid-123', ...dto })),
    save: jest.fn((entity) => Promise.resolve({ id: 'addr-uuid-123', ...entity })),
    findOne: jest.fn(),
  };

  const mockSt120GeneratorService = {
    generateST120Pdf: jest.fn().mockResolvedValue({
      filePath: '/tmp/auto-st120.pdf',
      relativeUrl: '/uploads/st120/auto-st120.pdf',
      buffer: Buffer.from('pdf'),
      auditHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: MailService, useValue: mockMailService },
        { provide: getRepositoryToken(SystemConfig), useValue: mockSystemConfigRepository },
        { provide: getRepositoryToken(Address), useValue: mockAddressRepository },
        { provide: St120GeneratorService, useValue: mockSt120GeneratorService },
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

    it('should throw BadRequestException if phone has invalid characters', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+1305abc0100',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone has more than 15 digits', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100999999',
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone has fewer than 10 digits', async () => {
      await expect(service.signup({
        email: 'test@example.com',
        company_name: 'Test Bakery',
        tax_id: '12-3456789',
        phone: '123456789',
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

    it('should atomically create primary Address with coordinates, city, and facade photo JSON when business_address is provided (TASK-65-04 Happy Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid-99', email: 'wholesale@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      const result = await service.signup({
        email: 'wholesale@bakery.com',
        password: 'password',
        full_name: 'Wholesale Baker',
        company_name: 'Sunset Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
        business_address: '74-12 Metropolitan Ave',
        address_lat: 40.7135,
        address_lng: -73.8821,
        address_city: 'Middle Village',
        facade_image_url: 'https://cdn.example.com/facade.jpg',
      });

      expect(mockAddressRepository.create).toHaveBeenCalledWith({
        user_id: 'user-uuid-99',
        alias: 'Principal / Facturación',
        address: '74-12 Metropolitan Ave',
        city: 'Middle Village',
        lat: 40.7135,
        lng: -73.8821,
        is_default: true,
        is_temporary: false,
        delivery_photos_json: JSON.stringify(['https://cdn.example.com/facade.jpg']),
      });
      expect(mockAddressRepository.save).toHaveBeenCalled();
      expect(result.address).toBeDefined();
      expect(result.address?.alias).toBe('Principal / Facturación');
      expect(result.address?.city).toBe('Middle Village');
    });

    it('should reject signup if addressRepository.save fails (TASK-65-04 Sad Path - Atomic DB failure)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid-99', email: 'fail@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});
      mockAddressRepository.save.mockRejectedValueOnce(new Error('Database disk error during address creation'));

      await expect(service.signup({
        email: 'fail@bakery.com',
        password: 'password',
        full_name: 'Wholesale Baker',
        company_name: 'Sunset Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
        business_address: '74-12 Metropolitan Ave',
      })).rejects.toThrow('Database disk error during address creation');
    });

    it('should fallback city to New York and omit delivery_photos_json when optional fields are missing (TASK-65-04 Boundary Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid-88', email: 'defaultcity@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      await service.signup({
        email: 'defaultcity@bakery.com',
        password: 'password',
        full_name: 'Default City Baker',
        company_name: 'Default Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
        business_address: '100 Main St',
      });

      expect(mockAddressRepository.create).toHaveBeenCalledWith({
        user_id: 'user-uuid-88',
        alias: 'Principal / Facturación',
        address: '100 Main St',
        city: 'New York',
        lat: undefined,
        lng: undefined,
        is_default: true,
        is_temporary: false,
      });
    });

    it('should persist night security access credentials (access_code, has_key, key_location, fridge_access_required, notes) in primary address during signup (TASK-79-02 Happy Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-night-1', email: 'night@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      const result = await service.signup({
        email: 'night@bakery.com',
        password: 'password123',
        full_name: 'Night Owl Baker',
        company_name: 'Midnight Bagels',
        tax_id: '12-9876543',
        phone: '+13055550199',
        business_address: '500 5th Ave',
        access_code: '#9876*',
        has_key: true,
        key_location: 'Under blue flowerpot next to back alley',
        fridge_access_required: true,
        delivery_notes: 'Leave boxes in walk-in fridge on left shelf',
      });

      expect(mockAddressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-night-1',
          address: '500 5th Ave',
          access_code: '#9876*',
          has_key: true,
          key_location: 'Under blue flowerpot next to back alley',
          fridge_access_required: true,
          notes: 'Leave boxes in walk-in fridge on left shelf',
        }),
      );
      expect(result.address).toBeDefined();
    });

    it('should persist st120_document_url on user and profile when provided in signup (TASK-79-02)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-doc-1', email: 'doc@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      await service.signup({
        email: 'doc@bakery.com',
        password: 'password123',
        full_name: 'Doc Baker',
        company_name: 'Doc Pastries',
        tax_id: '12-9876543',
        phone: '+13055550199',
        st120_document_url: '/uploads/st120/manual-scan.pdf',
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          st120_document_url: '/uploads/st120/manual-scan.pdf',
          st120_status: 'PENDING',
        }),
      );
      expect(mockUsersService.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          st120_document_url: '/uploads/st120/manual-scan.pdf',
          st120_status: 'PENDING',
        }),
      );
    });

    it('should auto-generate official digital ST-120 and set user to APPROVED and tax_exempt = true when st120_auto_generate is true (TASK-79-01 / TASK-79-02 Happy Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-auto-1', email: 'auto@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});

      const result = await service.signup({
        email: 'auto@bakery.com',
        password: 'password123',
        full_name: 'Auto Baker',
        company_name: 'Auto Dough Corp',
        tax_id: '12-1112223',
        phone: '+13055550199',
        business_address: '100 Broadway, NY',
        legal_business_name: 'Auto Dough Corporation',
        signature_text: 'Auto Baker',
        st120_auto_generate: true,
      });

      expect(mockSt120GeneratorService.generateST120Pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-auto-1',
          legalBusinessName: 'Auto Dough Corporation',
          taxId: '12-1112223',
          signerName: 'Auto Baker',
        }),
      );
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        'user-auto-1',
        expect.objectContaining({
          st120_status: 'APPROVED',
          tax_exempt: true,
          st120_document_url: '/uploads/st120/auto-st120.pdf',
        }),
      );
    });

    it('should gracefully handle generator failure when st120_auto_generate is true without aborting signup (TASK-79-01 Sad Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-fail-1', email: 'failst@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});
      mockSt120GeneratorService.generateST120Pdf.mockRejectedValueOnce(new Error('PDF generator timeout'));

      const result = await service.signup({
        email: 'failst@bakery.com',
        password: 'password123',
        full_name: 'Fail Safe Baker',
        company_name: 'Resilient Bakery',
        tax_id: '12-1112223',
        phone: '+13055550199',
        st120_auto_generate: true,
      });

      expect(result).toHaveProperty('session');
      expect(result.message).toBe('User registered successfully');
    });

    it('should pass UTM attribution fields to usersService.create upon signup (TASK-84-03 Happy Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockImplementation(async (u: any) => ({ id: 'u-utm-auth-1', ...u }));
      mockUsersService.createProfile.mockResolvedValue({});

      const result = await service.signup({
        email: 'utm_signup@bakery.com',
        password: 'password123',
        company_name: 'UTM Croissant Cafe',
        tax_id: '12-9876543',
        phone: '+13055550188',
        utm_source: 'meta_instagram',
        utm_medium: 'paid_feed',
        utm_campaign: 'black_friday_2026',
        utm_content: 'carousel_ad',
      });

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          utm_source: 'meta_instagram',
          utm_medium: 'paid_feed',
          utm_campaign: 'black_friday_2026',
          utm_content: 'carousel_ad',
        }),
      );
      expect(result).toHaveProperty('session');
    });

    it('should not invoke addressRepository if business_address is not provided (TASK-65-04 Omitted Address)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 'user-uuid-77', email: 'noaddr@bakery.com' });
      mockUsersService.createProfile.mockResolvedValue({});
      mockAddressRepository.create.mockClear();

      const result = await service.signup({
        email: 'noaddr@bakery.com',
        password: 'password',
        full_name: 'No Address Baker',
        company_name: 'No Address Bakery',
        tax_id: '12-3456789',
        phone: '+13055550100',
        phone_verified: true,
        idToken: 'mock-valid-firebase-token',
      });

      expect(mockAddressRepository.create).not.toHaveBeenCalled();
      expect(result.address).toBeUndefined();
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

    it('should throw UnauthorizedException when user account is disabled (is_active === false)', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValue({
        id: 'user-disabled',
        email: 'disabled@example.com',
        password: hashPassword('password123'),
        is_active: false,
      });

      await expect(service.login('disabled@example.com', 'password123')).rejects.toThrow(
        new UnauthorizedException('Tu cuenta ha sido inhabilitada. Por favor, contacta a soporte.')
      );
    });
  });

  describe('recoverPassword', () => {
    it('should throw UnauthorizedException if user not found (Sad Path)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.findByIdentifier.mockResolvedValue(null);
      await expect(service.recoverPassword('test@example.com')).rejects.toThrow(UnauthorizedException);
    });

    it('Happy Path: should generate 64-char hex reset token, persist it with expiration, and send email via MailService without mutating password', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'client@example.com',
        signer_name: 'John Doe',
      });

      const result = await service.recoverPassword('client@example.com');
      
      expect(mockUsersService.setResetPasswordToken).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        expect.any(Date),
      );
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'client@example.com',
        expect.stringMatching(/^[a-f0-9]{64}$/),
        'John Doe',
      );
      // Ensure password was NOT modified
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hemos enviado un enlace a client@example.com');
    });
  });

  describe('resetPassword', () => {
    it('Happy Path: should successfully reset password when token is valid and unexpired', async () => {
      const validToken = 'valid-token-64-chars';
      mockUsersService.findByResetPasswordToken.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'client@example.com',
        reset_password_token: validToken,
        reset_password_expires: new Date(Date.now() + 1800000), // 30 min future
      });

      const result = await service.resetPassword(validToken, 'NewSecurePassword123!');
      
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith('user-uuid-1', expect.any(String));
      expect(mockUsersService.clearResetPasswordToken).toHaveBeenCalledWith('user-uuid-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Tu contraseña ha sido restablecida');
    });

    it('Sad Path 1: should throw BadRequestException if token is missing or empty', async () => {
      await expect(service.resetPassword('', 'ValidPassword123!')).rejects.toThrow(
        new BadRequestException('Token de restablecimiento inválido o ausente')
      );
    });

    it('Sad Path 2: should throw BadRequestException if new password is too short (< 8 chars)', async () => {
      await expect(service.resetPassword('some-token', 'short')).rejects.toThrow(
        new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres')
      );
    });

    it('Sad Path 3: should throw BadRequestException if token is not found in database', async () => {
      mockUsersService.findByResetPasswordToken.mockResolvedValue(null);
      await expect(service.resetPassword('unknown-token', 'ValidPassword123!')).rejects.toThrow(
        new BadRequestException('El enlace de restablecimiento es inválido o no existe')
      );
    });

    it('Sad Path 4: should throw BadRequestException if token has expired', async () => {
      mockUsersService.findByResetPasswordToken.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'client@example.com',
        reset_password_token: 'expired-token',
        reset_password_expires: new Date(Date.now() - 5000), // expired 5 seconds ago
      });

      await expect(service.resetPassword('expired-token', 'ValidPassword123!')).rejects.toThrow(
        new BadRequestException('El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo')
      );
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
    it('should successfully verify phone with valid generated OTP code', async () => {
      mockUsersService.updateProfile.mockResolvedValue({
        id: 'user-1',
        phone: '+13055550100',
        phone_verified: true,
      });

      await service.sendSmsOtp({ phone: '+13055550100' });
      const stored = (service as any).otpStore.get('+13055550100');
      expect(stored).toBeDefined();
      expect(stored.code).toMatch(/^\d{6}$/);

      const result = await service.verifyPhone('user-1', {
        phone: '+13055550100',
        verificationCode: stored.code,
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

    it('should throw BadRequestException if code is invalid or hardcoded 123456', async () => {
      await service.sendSmsOtp({ phone: '+13055550100' });
      const stored = (service as any).otpStore.get('+13055550100');
      if (stored.code === '123456') stored.code = '654321';

      await expect(
        service.verifyPhone('user-1', {
          phone: '+13055550100',
          verificationCode: '123456',
        }),
      ).rejects.toThrow(BadRequestException);

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
          verificationCode: '849201',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if phone is missing or empty', async () => {
      await expect(
        service.verifyPhone('user-1', {
          phone: '',
          verificationCode: '849201',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if userId is missing', async () => {
      await expect(
        service.verifyPhone('', {
          phone: '+13055550100',
          verificationCode: '849201',
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

  describe('sendSmsOtp and verifySmsOtp (TASK-63-02)', () => {
    it('dispatches SMS OTP successfully and returns confirmation (Happy Path)', async () => {
      const res = await service.sendSmsOtp({ phone: '+13055550199' });
      expect(res.success).toBe(true);
      expect(res.message).toBe('Código de verificación enviado exitosamente');
    });

    it('verifies real generated OTP code and returns valid idToken (Happy Path)', async () => {
      await service.sendSmsOtp({ phone: '+13055550199' });
      const stored = (service as any).otpStore.get('+13055550199');
      expect(stored).toBeDefined();
      expect(stored.code).toMatch(/^\d{6}$/);

      const res = await service.verifySmsOtp({ phone: '+13055550199', code: stored.code });

      expect(res.success).toBe(true);
      expect(res.phone).toBe('+13055550199');
      expect(res.idToken).toMatch(/^valid-test-token-otp-/);
    });

    it('throws BadRequestException when verifying with obsolete hardcoded 123456 or invalid code (Sad Path §6)', async () => {
      await service.sendSmsOtp({ phone: '+13055550199' });
      const stored = (service as any).otpStore.get('+13055550199');
      if (stored.code === '123456') stored.code = '654321';

      await expect(service.verifySmsOtp({ phone: '+13055550199', code: '123456' })).rejects.toThrow(BadRequestException);
      await expect(service.verifySmsOtp({ phone: '+13055550199', code: '999999' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when phone is missing in sendSmsOtp (Sad Path §6)', async () => {
      await expect(service.sendSmsOtp({ phone: '' })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when phone or code is missing in verifySmsOtp (Sad Path §6)', async () => {
      await expect(service.verifySmsOtp({ phone: '', code: '849201' })).rejects.toThrow(BadRequestException);
      await expect(service.verifySmsOtp({ phone: '+13055550199', code: '' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('B2B Wholesale Approval Gate (TASK-85-01)', () => {
    it('throws UnauthorizedException when client account is PENDING_APPROVAL (Sad Path §6)', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValueOnce({
        id: 'user-pending-1',
        email: 'pending@b2b.com',
        password: 'plainpassword',
        role: 'client',
        is_active: true,
        account_status: 'PENDING_APPROVAL',
      });

      await expect(service.login('pending@b2b.com', 'plainpassword')).rejects.toThrow(
        /ACCOUNT_PENDING_APPROVAL/,
      );
    });

    it('allows client login when account_status is APPROVED (Happy Path)', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValueOnce({
        id: 'user-approved-1',
        email: 'approved@b2b.com',
        password: 'plainpassword',
        role: 'client',
        is_active: true,
        account_status: 'APPROVED',
      });
      mockUsersService.updatePassword.mockResolvedValueOnce(true);

      const res = await service.login('approved@b2b.com', 'plainpassword');
      expect(res.user.email).toBe('approved@b2b.com');
      expect(res.session.access_token).toBeDefined();
    });

    it('allows admin login regardless of account_status (Happy Path)', async () => {
      mockUsersService.findByEmailWithRole.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@b2b.com',
        password: 'plainpassword',
        role: 'admin',
        is_active: true,
        account_status: 'PENDING_APPROVAL',
      });
      mockUsersService.updatePassword.mockResolvedValueOnce(true);

      const res = await service.login('admin@b2b.com', 'plainpassword');
      expect(res.user.email).toBe('admin@b2b.com');
      expect(res.user.user_metadata.role).toBe('admin');
    });
  });
});

