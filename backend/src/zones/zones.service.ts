import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryZone } from './delivery-zone.entity';
import { CreateZoneDto, UpdateZoneDto } from './dto/create-zone.dto';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(DeliveryZone)
    private readonly zoneRepository: Repository<DeliveryZone>,
  ) {}

  async findAll(): Promise<DeliveryZone[]> {
    return this.zoneRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DeliveryZone> {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException(`Delivery zone with ID "${id}" not found`);
    }
    return zone;
  }

  async create(dto: CreateZoneDto): Promise<DeliveryZone> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('El nombre de la zona es obligatorio');
    }
    if (!dto.zip_codes || !dto.zip_codes.trim()) {
      throw new BadRequestException('Debe especificar al menos un código postal');
    }

    const zone = this.zoneRepository.create({
      name: dto.name.trim(),
      zip_codes: dto.zip_codes.trim(),
      base_fee: dto.base_fee !== undefined && dto.base_fee !== null ? Number(dto.base_fee) : 0,
      min_free_delivery_amount:
        dto.min_free_delivery_amount !== undefined && dto.min_free_delivery_amount !== null && Number(dto.min_free_delivery_amount) > 0
          ? Number(dto.min_free_delivery_amount)
          : null,
      is_active: dto.is_active !== undefined ? Boolean(dto.is_active) : true,
    });

    return this.zoneRepository.save(zone);
  }

  async update(id: string, dto: UpdateZoneDto): Promise<DeliveryZone> {
    const zone = await this.findOne(id);

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('El nombre de la zona no puede estar vacío');
      zone.name = dto.name.trim();
    }
    if (dto.zip_codes !== undefined) {
      if (!dto.zip_codes.trim()) throw new BadRequestException('Los códigos postales no pueden estar vacíos');
      zone.zip_codes = dto.zip_codes.trim();
    }
    if (dto.base_fee !== undefined) {
      zone.base_fee = Number(dto.base_fee) || 0;
    }
    if (dto.min_free_delivery_amount !== undefined) {
      zone.min_free_delivery_amount =
        dto.min_free_delivery_amount !== null && Number(dto.min_free_delivery_amount) > 0
          ? Number(dto.min_free_delivery_amount)
          : null;
    }
    if (dto.is_active !== undefined) {
      zone.is_active = Boolean(dto.is_active);
    }

    return this.zoneRepository.save(zone);
  }

  async delete(id: string): Promise<void> {
    const zone = await this.findOne(id);
    await this.zoneRepository.remove(zone);
  }

  async resolveZip(zip: string): Promise<DeliveryZone | null> {
    if (!zip) return null;
    const raw = String(zip).trim();
    const match = raw.match(/\b\d{5}\b/);
    const cleanZip = match ? match[0] : raw;

    const activeZones = await this.zoneRepository.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });

    for (const zone of activeZones) {
      const codes = zone.zip_codes
        .split(/[\s,]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (codes.includes(cleanZip)) {
        return zone;
      }
    }

    return null;
  }
}
