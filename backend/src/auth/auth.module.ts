import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { UsersModule } from '../users/users.module';
import { SystemConfig } from '../system-configs/system-config.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([SystemConfig]),
  ],
  providers: [AuthService, AuthGuard, RolesGuard, Reflector],
  controllers: [AuthController],
  exports: [AuthService, AuthGuard, RolesGuard, Reflector],
})
export class AuthModule {}
