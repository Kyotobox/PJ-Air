import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { TaxService } from './tax.service';
import { VisionValidationService } from './vision-validation.service';
import { TaxController } from './tax.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile])],
  controllers: [TaxController],
  providers: [TaxService, VisionValidationService],
  exports: [TaxService, VisionValidationService],
})
export class TaxModule {}
