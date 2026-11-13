import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { AdminAuditLog } from './admin-audit-log.entity';
import { AdminActionsController } from './admin-actions.controller';
import { AdminActionsService } from './admin-actions.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, SystemConfig, AdminAuditLog])],
  controllers: [AdminActionsController],
  providers: [AdminActionsService],
  exports: [AdminActionsService],
})
export class AdminActionsModule {}
