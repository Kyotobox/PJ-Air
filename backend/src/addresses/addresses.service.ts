import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './address.entity';
import { AddressValidationService } from './address-validation.service';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @Optional()
    private addressValidationService?: AddressValidationService,
  ) {}

  async findAll() {
    return this.addressRepository.find();
  }

  async findByUser(userId: string) {
    return this.addressRepository.find({
      where: { user_id: userId, is_temporary: false },
    });
  }

  async findOne(id: string) {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(userId: string, addressData: any) {
    if (this.addressValidationService && addressData.address) {
      const geo = await this.addressValidationService.validateAndGeocode(
        addressData.address,
        addressData.lat,
        addressData.lng,
      );
      addressData.lat = geo.lat;
      addressData.lng = geo.lng;
      if (!addressData.city && geo.city) addressData.city = geo.city;
      if (geo.formatted_address) addressData.address = geo.formatted_address;
    }

    const address = this.addressRepository.create({
      ...addressData,
      user_id: userId,
    });
    return this.addressRepository.save(address);
  }

  async update(id: string, addressData: any) {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');

    if (this.addressValidationService && addressData.address) {
      const geo = await this.addressValidationService.validateAndGeocode(
        addressData.address,
        addressData.lat,
        addressData.lng,
      );
      addressData.lat = geo.lat;
      addressData.lng = geo.lng;
      if (!addressData.city && geo.city) addressData.city = geo.city;
      if (geo.formatted_address) addressData.address = geo.formatted_address;
    }

    Object.assign(address, addressData);
    return this.addressRepository.save(address);
  }

  async delete(id: string) {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    return this.addressRepository.remove(address);
  }
}
