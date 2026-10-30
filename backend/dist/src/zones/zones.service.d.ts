import { Repository } from 'typeorm';
import { DeliveryZone } from './delivery-zone.entity';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';
export declare class ZonesService {
    private readonly zoneRepository;
    constructor(zoneRepository: Repository<DeliveryZone>);
    findAll(): Promise<DeliveryZone[]>;
    findOne(id: string): Promise<DeliveryZone>;
    create(dto: CreateZoneDto): Promise<DeliveryZone>;
    update(id: string, dto: UpdateZoneDto): Promise<DeliveryZone>;
    delete(id: string): Promise<void>;
    resolveZip(zip: string): Promise<DeliveryZone | null>;
}
