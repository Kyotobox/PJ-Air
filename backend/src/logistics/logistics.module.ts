import { Module, forwardRef } from '@nestjs/common';
import { MileageFreightService } from './mileage-freight.service';
import { LogisticsController } from './logistics.controller';
import { AddressesModule } from '../addresses/addresses.module';

@Module({
  imports: [forwardRef(() => AddressesModule)],
  controllers: [LogisticsController],
  providers: [MileageFreightService],
  exports: [MileageFreightService],
})
export class LogisticsModule {}
