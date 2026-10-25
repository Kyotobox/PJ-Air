import { Controller, Post, Body, UnauthorizedException, BadRequestException, Patch, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: any) {
    try {
      return await this.authService.signup(body);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.authService.login(email, password);
  }

  @Post('recover-password')
  async recoverPassword(@Body() body: { identifier: string }) {
    if (!body.identifier) {
      throw new BadRequestException('Identifier is required');
    }
    return this.authService.recoverPassword(body.identifier);
  }

  @Patch('change-password')
  async changePassword(@Body() body: any) {
    const { userId, currentPassword, newPassword } = body;
    if (!userId || !currentPassword || !newPassword) {
      throw new BadRequestException('All fields are required');
    }
    return this.authService.changePassword(userId, currentPassword, newPassword);
  }

  @UseGuards(AuthGuard)
  @Post('verify-phone')
  async verifyPhone(@Request() req: any, @Body() body: { phone: string; verificationCode?: string; idToken?: string }) {
    const userId = req.user?.id;
    return this.authService.verifyPhone(userId, body);
  }

  @UseGuards(AuthGuard)
  @Post('verify-phone-token')
  async verifyPhoneToken(@Request() req: any, @Body() body: { phone: string; verificationCode?: string; idToken?: string }) {
    const userId = req.user?.id;
    return this.authService.verifyPhone(userId, body);
  }
}
