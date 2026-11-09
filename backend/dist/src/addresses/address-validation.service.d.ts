import { Repository } from 'typeorm';
import { AddressGeocache } from './address-geocache.entity';
export interface ValidatedAddressResult {
    address: string;
    formatted_address: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    zip?: string;
    cached: boolean;
}
export declare class AddressValidationService {
    private readonly geocacheRepo?;
    private readonly logger;
    constructor(geocacheRepo?: Repository<AddressGeocache> | undefined);
    computeHash(rawAddress: string): string;
    extractZip(text: string): string | undefined;
    isTriState(state?: string): boolean;
    validateAndGeocode(rawAddress: string, providedLat?: number, providedLng?: number): Promise<ValidatedAddressResult>;
    private fetchGoogleGeocode;
    private resolveFallback;
    private persistCache;
}
