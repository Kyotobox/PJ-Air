import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';
export declare class ZonesController {
    private readonly zonesService;
    constructor(zonesService: ZonesService);
    resolve(zip: string, orFail?: string): Promise<import("./delivery-zone.entity").DeliveryZone | null>;
    findAll(): Promise<import("./delivery-zone.entity").DeliveryZone[]>;
    findOne(id: string): Promise<import("./delivery-zone.entity").DeliveryZone>;
    create(dto: CreateZoneDto): Promise<import("./delivery-zone.entity").DeliveryZone>;
    updatePut(id: string, dto: UpdateZoneDto): Promise<import("./delivery-zone.entity").DeliveryZone>;
    updatePatch(id: string, dto: UpdateZoneDto): Promise<import("./delivery-zone.entity").DeliveryZone>;
    delete(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
