import { AddressesService } from './addresses.service';
import { AddressValidationService } from './address-validation.service';
export declare class AddressesController {
    private readonly addressesService;
    private readonly addressValidationService?;
    constructor(addressesService: AddressesService, addressValidationService?: AddressValidationService | undefined);
    uploadPhoto(file: Express.Multer.File): Promise<{
        url: string;
    }>;
    validateAddress(body: any): Promise<{
        valid: boolean;
        address: any;
    } | {
        address: string;
        formatted_address: string;
        lat: number;
        lng: number;
        city?: string;
        state?: string;
        zip?: string;
        cached: boolean;
        valid: boolean;
    }>;
    create(body: any, req: any): Promise<import("./address.entity").Address[]>;
    findByUser(userId: string, req: any): Promise<import("./address.entity").Address[]>;
    update(id: string, body: any, req: any): Promise<import("./address.entity").Address>;
    delete(id: string, req: any): Promise<import("./address.entity").Address>;
}
