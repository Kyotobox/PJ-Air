import { MileageFreightService, DeliveryServiceType } from './mileage-freight.service';
export declare class FreightQuoteDto {
    miles?: number;
    destLat?: number;
    destLng?: number;
    serviceType?: DeliveryServiceType;
    destinationAddress?: string;
}
export declare class LogisticsController {
    private readonly freightService;
    constructor(freightService: MileageFreightService);
    getOrigin(): import("./mileage-freight.service").LocationPoint;
    calculateQuote(body: any): import("./mileage-freight.service").FreightQuoteResult;
}
