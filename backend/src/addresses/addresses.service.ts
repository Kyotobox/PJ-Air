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
      ...(addressData.access_code !== undefined ? { access_code: addressData.access_code } : {}),
      ...(addressData.has_key !== undefined ? { has_key: Boolean(addressData.has_key) } : {}),
      ...(addressData.key_location !== undefined ? { key_location: addressData.key_location } : {}),
      ...(addressData.fridge_access_required !== undefined ? { fridge_access_required: Boolean(addressData.fridge_access_required) } : {}),
      ...(addressData.notes !== undefined ? { notes: addressData.notes } : {}),
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

    if (addressData.has_key !== undefined) {
      addressData.has_key = Boolean(addressData.has_key);
    }
    if (addressData.fridge_access_required !== undefined) {
      addressData.fridge_access_required = Boolean(addressData.fridge_access_required);
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
