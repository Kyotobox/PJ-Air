import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
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
    const address = this.addressRepository.create({
      ...addressData,
      user_id: userId,
    });
    return this.addressRepository.save(address);
  }

  async update(id: string, addressData: any) {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    Object.assign(address, addressData);
    return this.addressRepository.save(address);
  }

  async delete(id: string) {
    const address = await this.addressRepository.findOne({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    return this.addressRepository.remove(address);
  }
}
