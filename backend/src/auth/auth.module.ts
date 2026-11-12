import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersModule } from '../users/users.module';
import { SmsModule } from '../sms/sms.module';
import { MailModule } from '../mail/mail.module';
import { TaxModule } from '../tax/tax.module';
import { SystemConfig } from '../system-configs/system-config.entity';
import { Address } from '../addresses/address.entity';

@Module({
  imports: [
    UsersModule,
    SmsModule,
    MailModule,
    TaxModule,
    TypeOrmModule.forFeature([SystemConfig, Address]),
  ],
  providers: [AuthService, AuthGuard, RolesGuard, Reflector],
  controllers: [AuthController],
  exports: [AuthService, AuthGuard, RolesGuard, Reflector],
})
export class AuthModule {}

