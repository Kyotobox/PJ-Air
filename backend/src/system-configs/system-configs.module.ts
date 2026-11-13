import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from './system-config.entity';
import { SystemConfigsService } from './system-configs.service';
import { SystemConfigsController } from './system-configs.controller';
import { AdminActionsModule } from '../admin-actions/admin-actions.module';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig]), AdminActionsModule],
  providers: [SystemConfigsService],
  controllers: [SystemConfigsController],
  exports: [SystemConfigsService],
})
export class SystemConfigsModule {}
