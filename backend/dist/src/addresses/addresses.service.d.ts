import { Repository } from 'typeorm';
import { Address } from './address.entity';
export declare class AddressesService {
    private addressRepository;
    constructor(addressRepository: Repository<Address>);
    findAll(): Promise<Address[]>;
    findByUser(userId: string): Promise<Address[]>;
    findOne(id: string): Promise<Address>;
    create(userId: string, addressData: any): Promise<Address[]>;
    update(id: string, addressData: any): Promise<Address>;
    delete(id: string): Promise<Address>;
}
