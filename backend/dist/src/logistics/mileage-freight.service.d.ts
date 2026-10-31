import { AddressValidationService } from '../addresses/address-validation.service';
export interface LocationPoint {
    address: string;
    lat: number;
    lng: number;
    zip?: string;
}
export declare const ASTORIA_ORIGIN: LocationPoint;
export type DeliveryServiceType = 'shared' | 'exclusive' | 'pickup';
export interface FreightQuoteResult {
    origin: LocationPoint;
    destination?: {
        lat?: number;
        lng?: number;
        address?: string;
    };
    serviceType: DeliveryServiceType;
    miles: number;
    cost: number;
    requiresSpecialQuote: boolean;
    notes?: string;
}
export declare class MileageFreightService {
    private readonly addressValidationService?;
    readonly origin: LocationPoint;
    constructor(addressValidationService?: AddressValidationService | undefined);
    resolveCoordinatesFromAddress(address: string): Promise<{
        lat: number;
        lng: number;
        formatted_address?: string;
        zip?: string;
    } | null>;
    calculateDistanceByAddress(address: string, applyRoadFactor?: boolean): Promise<number>;
    quoteByAddress(address: string, serviceType?: DeliveryServiceType): Promise<FreightQuoteResult>;
    calculateDistanceMiles(destLat: number, destLng: number, applyRoadFactor?: boolean): number;
    calculateFreight(miles: number, serviceType?: DeliveryServiceType): FreightQuoteResult;
    quoteByCoordinates(destLat: number, destLng: number, serviceType?: DeliveryServiceType, destinationAddress?: string): FreightQuoteResult;
}
