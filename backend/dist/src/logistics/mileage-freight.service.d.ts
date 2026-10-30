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
    readonly origin: LocationPoint;
    calculateDistanceMiles(destLat: number, destLng: number, applyRoadFactor?: boolean): number;
    calculateFreight(miles: number, serviceType?: DeliveryServiceType): FreightQuoteResult;
    quoteByCoordinates(destLat: number, destLng: number, serviceType?: DeliveryServiceType, destinationAddress?: string): FreightQuoteResult;
}
