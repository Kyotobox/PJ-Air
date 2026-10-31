import { Repository } from 'typeorm';
import { Address } from './address.entity';
import { AddressValidationService } from './address-validation.service';
export declare class AddressesService {
    private addressRepository;
    private addressValidationService?;
    constructor(addressRepository: Repository<Address>, addressValidationService?: AddressValidationService | undefined);
    findAll(): Promise<Address[]>;
    findByUser(userId: string): Promise<Address[]>;
    findOne(id: string): Promise<Address>;
    create(userId: string, addressData: any): Promise<Address[]>;
    update(id: string, addressData: any): Promise<Address>;
    delete(id: string): Promise<Address>;
}
