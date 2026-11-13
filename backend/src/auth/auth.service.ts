import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { Address } from '../addresses/address.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { SmsService } from '../sms/sms.service';
import { MailService } from '../mail/mail.service';
import { St120GeneratorService } from '../tax/st120-generator.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { SITE_URL, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } from '../config';
import { hashPassword, verifyPassword, signJwt } from './crypto.util';
import { getFirebaseAdmin } from './firebase-admin.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private otpStore = new Map<string, { code: string; expiresAt: number; verificationId: string }>();

  constructor(
    private usersService: UsersService,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    @Optional()
    private mailService?: MailService,
    @Optional()
    private smsService?: SmsService,
    @Optional()
    @InjectRepository(Address)
    private addressRepository?: Repository<Address>,
    @Optional()
    private st120GeneratorService?: St120GeneratorService,
  ) {}

  async signup(body: any) {
    const {
      email,
      password,
      full_name,
      username,
      phone,
      company_name,
      role,
      phone_verified,
      idToken,
      tax_id,
      st120_declared,
      business_address,
      address_lat,
      address_lng,
      address_city,
      facade_image_url,
      access_code,
      has_key,
      key_location,
      fridge_access_required,
      notes,
      delivery_notes,
      st120_document_url,
      st120_auto_generate,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
    } = body;

    const userRole = role || 'client';
    const cleanCompany = (company_name || '').trim();
    if (userRole === 'client' && !cleanCompany) {
      throw new BadRequestException('Company or store name is required for wholesale registration');
    }

    if (userRole === 'client') {
      const cleanTax = tax_id && typeof tax_id === 'string' ? tax_id.trim() : '';
      if (!cleanTax) {
        throw new BadRequestException('El Tax ID / NY Resale Certificate # es obligatorio para registros mayoristas');
      }

      if (!phone || typeof phone !== 'string') {
        throw new BadRequestException('Phone number is required for wholesale registration');
      }

      const cleanDigits = phone.replace(/\D/g, '');
      const phoneFormatRegex = /^[+]?[\d\s\-()]{10,25}$/;
      if (!phoneFormatRegex.test(phone.trim()) || cleanDigits.length < 10 || cleanDigits.length > 15) {
        throw new BadRequestException('Invalid phone number format or length (must contain 10 to 15 digits)');
      }
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) throw new ConflictException('Email already registered');

    const cleanTaxId = tax_id && typeof tax_id === 'string' ? tax_id.trim() : undefined;
    const shouldAutoGenerateSt120 = Boolean(st120_auto_generate);
    const initialSt120Status = shouldAutoGenerateSt120
      ? 'APPROVED'
      : (st120_declared || cleanTaxId || st120_document_url ? 'PENDING' : 'NONE');
    const initialTaxExempt = shouldAutoGenerateSt120 ? true : false;
    const cleanSt120DocUrl = st120_document_url && typeof st120_document_url === 'string' ? st120_document_url.trim() : undefined;

    // Create user with hashed password
    const hashedPassword = hashPassword(password);
    const userResult = await this.usersService.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: userRole,
      tax_id: cleanTaxId,
      st120_status: initialSt120Status,
      tax_exempt: initialTaxExempt,
      ...(cleanSt120DocUrl ? { st120_document_url: cleanSt120DocUrl } : {}),
      ...(body.legal_business_name ? { legal_business_name: body.legal_business_name } : {}),
      ...(body.dba ? { dba: body.dba } : {}),
      ...(body.ein ? { ein: body.ein } : {}),
      ...(body.business_address ? { business_address: body.business_address } : {}),
      ...(body.signer_name ? { signer_name: body.signer_name } : {}),
      ...(body.signer_title ? { signer_title: body.signer_title } : {}),
      ...(body.signer_phone ? { signer_phone: body.signer_phone } : {}),
      ...(body.signer_email ? { signer_email: body.signer_email } : {}),
      ...(body.terms_version ? { terms_version: body.terms_version } : {}),
      ...(body.accepted_at ? { accepted_at: new Date(body.accepted_at) } : (body.signature_text ? { accepted_at: new Date() } : {})),
      ...(body.ip_address ? { ip_address: body.ip_address } : {}),
      ...(body.signature_text ? { signature_text: body.signature_text } : {}),
      ...(body.card_last4 ? { card_last4: body.card_last4 } : {}),
      ...(body.stripe_payment_method_id ? { stripe_payment_method_id: body.stripe_payment_method_id } : {}),
      ...(body.check_enabled !== undefined ? { check_enabled: Boolean(body.check_enabled) } : {}),
      ...(body.ach_enabled !== undefined ? { ach_enabled: Boolean(body.ach_enabled) } : {}),
      ...(utm_source ? { utm_source: String(utm_source).trim().slice(0, 100) } : (body.utm_source ? { utm_source: String(body.utm_source).trim().slice(0, 100) } : {})),
      ...(utm_medium ? { utm_medium: String(utm_medium).trim().slice(0, 100) } : (body.utm_medium ? { utm_medium: String(body.utm_medium).trim().slice(0, 100) } : {})),
      ...(utm_campaign ? { utm_campaign: String(utm_campaign).trim().slice(0, 100) } : (body.utm_campaign ? { utm_campaign: String(body.utm_campaign).trim().slice(0, 100) } : {})),
      ...(utm_content ? { utm_content: String(utm_content).trim().slice(0, 100) } : (body.utm_content ? { utm_content: String(body.utm_content).trim().slice(0, 100) } : {})),
      account_status: userRole === 'admin' ? 'APPROVED' : (body.account_status || 'PENDING_APPROVAL'),
    });
    const user = Array.isArray(userResult) ? userResult[0] : userResult;

    // Create profile
    await this.usersService.createProfile({
      id: user.id,
      full_name,
      username: username || email.split('@')[0],
      phone,
      company_name: cleanCompany,
      phone_verified: Boolean(phone_verified),
      tax_id: cleanTaxId,
      st120_status: initialSt120Status,
      tax_exempt: initialTaxExempt,
      ...(cleanSt120DocUrl ? { st120_document_url: cleanSt120DocUrl } : {}),
    });

    const cleanBusinessAddress = business_address && typeof business_address === 'string' ? business_address.trim() : '';

    // TASK-79-01 / TASK-79-02: Auto-generación de ST-120 digital si fue solicitada en signup
    if (shouldAutoGenerateSt120) {
      try {
        const generator = this.st120GeneratorService || new St120GeneratorService();
        const genResult = await generator.generateST120Pdf({
          userId: user.id,
          legalBusinessName: body.legal_business_name || cleanCompany,
          dba: body.dba || cleanCompany,
          businessAddress: body.business_address || cleanBusinessAddress || 'Address on file',
          taxId: cleanTaxId,
          ein: body.ein,
          signerName: body.signer_name || full_name || user.email,
          signerTitle: body.signer_title || 'Authorized Representative',
          signatureText: body.signature_text || body.signer_name || full_name || 'Authorized Signer',
          acceptedAt: body.accepted_at ? new Date(body.accepted_at) : new Date(),
          ipAddress: body.ip_address || '127.0.0.1',
        });

        user.st120_document_url = genResult.relativeUrl;
        user.st120_status = 'APPROVED';
        user.tax_exempt = true;

        if (this.usersService['userRepository']) {
          await this.usersService['userRepository'].update(user.id, {
            st120_document_url: genResult.relativeUrl,
            st120_status: 'APPROVED',
            tax_exempt: true,
          });
        }
        await this.usersService.updateProfile(user.id, {
          st120_document_url: genResult.relativeUrl,
          st120_status: 'APPROVED',
          tax_exempt: true,
        });
      } catch (err: any) {
        this.logger.error(`Error auto-generating ST-120 in signup: ${err.message}`);
      }
    }

    // TASK-65-04 / TASK-79-02: Creación Atómica de Dirección Principal con Credenciales de Acceso Nocturno
    let createdAddress: Address | null = null;
    if (cleanBusinessAddress && this.addressRepository) {
      const cleanCity = address_city && typeof address_city === 'string' && address_city.trim() ? address_city.trim() : 'New York';
      const latNum = typeof address_lat === 'number' ? address_lat : (address_lat !== null && address_lat !== undefined && !isNaN(parseFloat(address_lat)) ? parseFloat(address_lat) : null);
      const lngNum = typeof address_lng === 'number' ? address_lng : (address_lng !== null && address_lng !== undefined && !isNaN(parseFloat(address_lng)) ? parseFloat(address_lng) : null);

      let deliveryPhotosJson: string | null = null;
      if (facade_image_url && typeof facade_image_url === 'string' && facade_image_url.trim()) {
        deliveryPhotosJson = JSON.stringify([facade_image_url.trim()]);
      }

      const effectiveNotes = notes || delivery_notes;

      const addressEntity = this.addressRepository.create({
        user_id: user.id,
        alias: 'Principal / Facturación',
        address: cleanBusinessAddress,
        city: cleanCity,
        lat: latNum !== null && !isNaN(latNum) ? latNum : undefined,
        lng: lngNum !== null && !isNaN(lngNum) ? lngNum : undefined,
        is_default: true,
        is_temporary: false,
        ...(deliveryPhotosJson ? { delivery_photos_json: deliveryPhotosJson } : {}),
        ...(access_code !== undefined && access_code !== null ? { access_code: String(access_code).trim() } : {}),
        ...(has_key !== undefined ? { has_key: Boolean(has_key) } : {}),
        ...(key_location !== undefined && key_location !== null ? { key_location: String(key_location).trim() } : {}),
        ...(fridge_access_required !== undefined ? { fridge_access_required: Boolean(fridge_access_required) } : {}),
        ...(effectiveNotes !== undefined && effectiveNotes !== null ? { notes: String(effectiveNotes).trim() } : {}),
      });

      createdAddress = await this.addressRepository.save(addressEntity);
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const access_token = signJwt(payload);

    // Return session for auto-login
    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        app_metadata: {},
        user_metadata: { full_name: full_name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      session: {
        access_token,
        refresh_token: signJwt(payload, 7 * 24 * 3600),
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: user.id, email: user.email },
      },
      ...(createdAddress ? { address: createdAddress } : {}),
    };
  }

  async register(body: any) {
    return this.signup(body);
  }

  async login(identifierInput: string, password: string) {
    const identifier = identifierInput.trim().toLowerCase();
    
    // Search by email or find by username
    const user = await this.usersService.findByEmailWithRole(identifier) ||
                 await this.usersService.findByIdentifier(identifier);
    
    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (user.is_active === false) {
      throw new UnauthorizedException('Tu cuenta ha sido inhabilitada. Por favor, contacta a soporte.');
    }

    const clientRole = (user as any).role || 'client';
    if (clientRole === 'client' && user.account_status === 'PENDING_APPROVAL') {
      throw new UnauthorizedException('ACCOUNT_PENDING_APPROVAL: Su cuenta comercial B2B está pendiente de revisión y aprobación administrativa.');
    }

    let isMatch = false;
    if (user.password && user.password.includes(':')) {
      isMatch = verifyPassword(password, user.password);
    } else if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'))) {
      // Support bcrypt hashes (e.g. from Supabase or legacy system)
      const bcrypt = require('bcryptjs');
      const hashToCompare = user.password.startsWith('$2y$')
        ? user.password.replace(/^\$2y\$/, '$2a$')
        : user.password;
      if (bcrypt.compareSync(password, hashToCompare)) {
        isMatch = true;
        // Migrate to the new PBKDF2 format
        const hashedPassword = hashPassword(password);
        await this.usersService.updatePassword(user.id, hashedPassword);
        user.password = hashedPassword;
      }
    } else {
      // Fallback and migration for plain-text passwords
      if (user.password === password) {
        isMatch = true;
        const hashedPassword = hashPassword(password);
        await this.usersService.updatePassword(user.id, hashedPassword);
        user.password = hashedPassword;
      }
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const role = (user as any).role || 'client';
    const payload = { id: user.id, email: user.email, role };
    const access_token = signJwt(payload);

    const forcePwdChange = await this.systemConfigRepository.findOne({
      where: { key: `force_pwd_change:${user.id}` }
    });

    const response: any = {
      user: {
        id: user.id,
        email: user.email,
        app_metadata: {},
        user_metadata: { 
          full_name: user.profile?.full_name,
          role,
        },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      session: {
        access_token,
        refresh_token: signJwt(payload, 7 * 24 * 3600),
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: user.id, email: user.email },
      }
    };

    if (forcePwdChange && forcePwdChange.value === 'true') {
      response.require_password_change = true;
    }

    return response;
  }

  async recoverPassword(identifier: string) {
    const cleanId = (identifier || '').trim().toLowerCase();
    const user = await this.usersService.findByEmail(cleanId) ||
                 await this.usersService.findByIdentifier(cleanId);
                 
    if (!user) {
      throw new UnauthorizedException(
        `No hemos conseguido un usuario o email que coincida con: ${identifier}`
      );
    }

    // Generate secure 64-char hex token with 1-hour expiration
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.usersService.setResetPasswordToken(user.id, resetToken, expires);

    // Send email via dedicated MailService (connected to Postfix SMTP)
    const clientName = user.profile?.full_name || user.signer_name || user.legal_business_name || undefined;
    if (this.mailService) {
      await this.mailService.sendPasswordResetEmail(user.email, resetToken, clientName);
    } else {
      this.logger.warn(`MailService not available, cannot send reset link to ${user.email}`);
    }

    return {
      success: true,
      message: `Hemos enviado un enlace a ${user.email} para restablecer tu contraseña. El enlace es válido por 1 hora.`,
      email: user.email,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Token de restablecimiento inválido o ausente');
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const user = await this.usersService.findByResetPasswordToken(token);
    if (!user) {
      throw new BadRequestException('El enlace de restablecimiento es inválido o no existe');
    }

    if (!user.reset_password_expires || new Date(user.reset_password_expires).getTime() < Date.now()) {
      throw new BadRequestException('El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo');
    }

    const hashedPassword = hashPassword(newPassword);
    await this.usersService.updatePassword(user.id, hashedPassword);
    await this.usersService.clearResetPasswordToken(user.id);

    return {
      success: true,
      message: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva clave.',
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const tempUser = await this.usersService.findOne(userId);
    const user = await this.usersService.findByEmailWithRole(tempUser.email);
    if (!user) {
      throw new UnauthorizedException('Invalid current password');
    }

    let isMatch = false;
    if (user.password && user.password.includes(':')) {
      isMatch = verifyPassword(currentPassword, user.password);
    } else {
      isMatch = user.password === currentPassword;
    }

    if (!isMatch) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = hashPassword(newPassword);
    await this.usersService.updatePassword(userId, hashedPassword);
    return { message: 'Password updated successfully' };
  }

  async verifyFirebasePhoneToken(phone: string, idToken?: string): Promise<boolean> {
    if (!idToken || typeof idToken !== 'string') {
      return false;
    }

    if (process.env.NODE_ENV === 'test' && (idToken === 'mock-valid-firebase-token' || idToken.startsWith('valid-test-token'))) {
      return true;
    }

    const adminSdk = getFirebaseAdmin();
    if (adminSdk && adminSdk.apps.length > 0) {
      try {
        const decoded = await adminSdk.auth().verifyIdToken(idToken);
        if (!decoded) {
          return false;
        }

        if (decoded.phone_number && phone) {
          const decodedDigits = decoded.phone_number.replace(/\D/g, '');
          const inputDigits = phone.replace(/\D/g, '');
          if (decodedDigits !== inputDigits && !decodedDigits.endsWith(inputDigits) && !inputDigits.endsWith(decodedDigits)) {
            return false;
          }
        }

        return true;
      } catch (err: any) {
        return false;
      }
    }

    return false;
  }

  async verifyPhone(userId: string, body: { phone: string; verificationCode?: string; idToken?: string }) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { phone, verificationCode, idToken } = body;
    if (!phone || typeof phone !== 'string') {
      throw new BadRequestException('Valid phone number is required');
    }

    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    // Validate format: 10 digits US or 10-15 digits E.164
    const isE164 = cleanPhone.startsWith('+');
    if (isE164) {
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        throw new BadRequestException('Invalid phone number format');
      }
    } else {
      if (digitsOnly.length !== 10 && !(digitsOnly.length === 11 && digitsOnly.startsWith('1'))) {
        throw new BadRequestException('Invalid phone number format');
      }
    }

    let verified = false;

    if (verificationCode) {
      const e164 = cleanPhone.startsWith('+') ? `+${digitsOnly}` : (digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`);
      const stored = this.otpStore.get(e164) || this.otpStore.get(cleanPhone);
      if (stored && stored.code === verificationCode.trim() && Date.now() <= stored.expiresAt) {
        verified = true;
        this.otpStore.delete(e164);
        this.otpStore.delete(cleanPhone);
      } else {
        throw new BadRequestException('Invalid or expired verification code');
      }
    } else if (idToken) {
      const isValid = await this.verifyFirebasePhoneToken(cleanPhone, idToken);
      if (isValid) {
        verified = true;
      } else {
        throw new BadRequestException('Invalid or expired verification code');
      }
    } else {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (!verified) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersService.updateProfile(userId, {
      phone: cleanPhone,
      phone_verified: true,
    });

    return {
      success: true,
      phone_verified: true,
      phone: cleanPhone,
    };
  }

  async sendSmsOtp(input: string | { phone: string }): Promise<{ success: boolean; verificationId: string; phone: string; message: string }> {
    const rawPhone = typeof input === 'string' ? input : input?.phone;
    if (!rawPhone || typeof rawPhone !== 'string') {
      throw new BadRequestException('El número de teléfono es obligatorio');
    }
    const cleanPhone = rawPhone.trim();
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new BadRequestException('Número de teléfono inválido (mínimo 10 dígitos)');
    }
    const e164 = cleanPhone.startsWith('+') ? `+${digits}` : (digits.length === 10 ? `+1${digits}` : `+${digits}`);

    // Generate non-deterministic 6-digit real random code (100000 - 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    this.otpStore.set(e164, { code, expiresAt, verificationId });
    this.logger.log(`[SMS_OTP] Código OTP generado para ${e164}: ${code} (válido por 10 min)`);

    if (this.smsService) {
      try {
        await this.smsService.sendSms(e164, `Tu código de verificación de Jhoanes Bakery es: ${code}`);
      } catch (err: any) {
        this.logger.warn(`[AuthService] SMS dispatch notice: ${err?.message || err}`);
      }
    }

    return {
      success: true,
      verificationId,
      phone: e164,
      message: 'Código de verificación enviado exitosamente',
    };
  }

  async verifySmsOtp(body: { phone: string; code: string; verificationId?: string }): Promise<{ success: boolean; idToken: string; phone: string }> {
    const { phone, code } = body || {};
    if (!phone || !code) {
      throw new BadRequestException('Teléfono y código de verificación requeridos');
    }
    const cleanPhone = phone.trim();
    const digits = cleanPhone.replace(/\D/g, '');
    const e164 = cleanPhone.startsWith('+') ? `+${digits}` : (digits.length === 10 ? `+1${digits}` : `+${digits}`);

    const stored = this.otpStore.get(e164);
    if (!stored || stored.code !== code.trim() || Date.now() > stored.expiresAt) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    this.otpStore.delete(e164);

    const idToken = `valid-test-token-otp-${Date.now()}`;
    return {
      success: true,
      idToken,
      phone: e164,
    };
  }
}

