import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { SITE_URL, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } from '../config';
import { hashPassword, verifyPassword, signJwt } from './crypto.util';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
  ) {}

  async signup(body: any) {
    const { email, password, full_name, username, phone, company_name, role } = body;

    const userRole = role || 'client';
    const cleanCompany = (company_name || '').trim();
    if (userRole === 'client' && !cleanCompany) {
      throw new BadRequestException('Company or store name is required for wholesale registration');
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) throw new ConflictException('Email already registered');

    // Create user with hashed password
    const hashedPassword = hashPassword(password);
    const userResult = await this.usersService.create({
      email,
      password: hashedPassword,
      role: userRole,
    });
    const user = Array.isArray(userResult) ? userResult[0] : userResult;

    // Create profile
    await this.usersService.createProfile({
      id: user.id,
      full_name,
      username: username || email.split('@')[0],
      phone,
      company_name: cleanCompany,
    });

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
      }
    };
  }

  async login(identifierInput: string, password: string) {
    const identifier = identifierInput.trim().toLowerCase();
    
    // Search by email or find by username
    const user = await this.usersService.findByEmailWithRole(identifier) ||
                 await this.usersService.findByIdentifier(identifier);
    
    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
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
    const user = await this.usersService.findByEmail(identifier) ||
                 await this.usersService.findByIdentifier(identifier);
                 
    if (!user) {
      throw new UnauthorizedException(
        `No hemos conseguido un usuario o email que coincida con: ${identifier}`
      );
    }

    const siteUrl = SITE_URL;

    // Generate a secure temporary password, hash it and save it
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12 characters
    const hashedPassword = hashPassword(tempPassword);
    await this.usersService.updatePassword(user.id, hashedPassword);

    try {
      // SMTP configuration - use env vars if available, fallback to Ethereal for dev
      let transporterParams: any;

      if (SMTP_HOST) {
        transporterParams = {
          host: SMTP_HOST,
          port: parseInt(SMTP_PORT),
          secure: SMTP_SECURE,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        };
      } else {
        // Fallback to Ethereal for local development
        transporterParams = {
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: 'mckenna.beier@ethereal.email',
            pass: 'JSF9re7Xh3bTzH4JUK',
          },
          tls: {
            rejectUnauthorized: false
          }
        };
      }

      let transporter: any = nodemailer.createTransport(transporterParams);

      try {
        await transporter.verify();
      } catch (e) {
        console.log("SMTP verify failed, creating dynamic Ethereal test account...");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
          tls: {
            rejectUnauthorized: false
          }
        });
      }

      const info = await transporter.sendMail({
        from: SMTP_USER ? `"Jhoanes Bakery, Order System" <${SMTP_USER}>` : '"Jhoanes Bakery, Order System" <noresponder@jhpanesbakery.com>',
        to: user.email,
        subject: "Password Recovery - Temporary Password",
        text: `Estimado cliente, su nueva contraseña temporal es: ${tempPassword}\n\nPor seguridad, cambie su contraseña una vez inicie sesión.\n\nIr a la tienda: ${siteUrl}/auth/login`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Password Recovery</h2>
            <p>Estimado cliente, su nueva contraseña temporal es: <strong>${tempPassword}</strong></p>
            <p style="color: #666; font-size: 14px;">Por seguridad, le recomendamos cambiar su contraseña una vez que inicie sesión.</p>
            <br/>
            <p>
              <a href="${siteUrl}/auth/login" 
                 style="display: inline-block; background-color: #b8860b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Ir a la tienda
              </a>
            </p>
          </div>`,
      });

      console.log("Message sent: %s", info.messageId);
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info as any));

      return {
        message: `Gracias, su nueva contraseña temporal se ha enviado al correo ${user.email}`,
        email: user.email,
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new InternalServerErrorException('Error al enviar el correo de recuperación');
    }
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
}

