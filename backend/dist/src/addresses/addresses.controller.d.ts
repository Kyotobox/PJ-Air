import { AddressesService } from './addresses.service';
export declare class AddressesController {
    private readonly addressesService;
    constructor(addressesService: AddressesService);
    create(body: any, req: any): Promise<import("./address.entity").Address[]>;
    findByUser(userId: string, req: any): Promise<import("./address.entity").Address[]>;
    update(id: string, body: any, req: any): Promise<import("./address.entity").Address>;
    delete(id: string, req: any): Promise<import("./address.entity").Address>;
}
