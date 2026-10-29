import { Module } from '@nestjs/common';
import { MileageFreightService } from './mileage-freight.service';
import { LogisticsController } from './logistics.controller';

@Module({
  controllers: [LogisticsController],
  providers: [MileageFreightService],
  exports: [MileageFreightService],
})
export class LogisticsModule {}
