import { AddressesService } from './addresses.service';
import { AddressValidationService } from './address-validation.service';
import { FacadeVisionService } from './facade-vision.service';
export declare class AddressesController {
    private readonly addressesService;
    private readonly addressValidationService?;
    private readonly facadeVisionService?;
    constructor(addressesService: AddressesService, addressValidationService?: AddressValidationService | undefined, facadeVisionService?: FacadeVisionService | undefined);
    uploadPhoto(file: Express.Multer.File): Promise<{
        url: string;
    }>;
    uploadFacade(file: Express.Multer.File): Promise<{
        url: string;
    }>;
    validateFacade(file?: Express.Multer.File, body?: any): Promise<{
        success: boolean;
        isValid: boolean;
        category: string;
        confidence: number;
        status: string;
        message: string;
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
