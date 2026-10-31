import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { Address } from './address.entity';
import { AddressGeocache } from './address-geocache.entity';
import { AddressValidationService } from './address-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Address, AddressGeocache])],
  controllers: [AddressesController],
  providers: [AddressesService, AddressValidationService],
  exports: [AddressesService, AddressValidationService, TypeOrmModule],
})
export class AddressesModule {}
