import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from './banner.entity';

@Injectable()
export class BannersService {
    constructor(
        @InjectRepository(Banner)
        private readonly bannerRepository: Repository<Banner>,
    ) {}

    async findPublic(): Promise<Banner[]> {
        return this.bannerRepository.find({
            where: { is_active: true },
            order: { display_order: 'ASC', id: 'ASC' },
        });
    }

    async findAll(): Promise<Banner[]> {
        return this.bannerRepository.find({
            order: { display_order: 'ASC', id: 'ASC' },
        });
    }

    async findOne(id: number): Promise<Banner> {
        if (!id || isNaN(id)) {
            throw new BadRequestException('Invalid banner ID');
        }
        const banner = await this.bannerRepository.findOne({ where: { id } });
        if (!banner) {
            throw new NotFoundException(`Banner with ID ${id} not found`);
        }
        return banner;
    }

    async create(data: Partial<Banner>): Promise<Banner> {
        if (!data || !data.title || typeof data.title !== 'string' || !data.title.trim()) {
            throw new BadRequestException('Title is required');
        }
        if (!data.image_url || typeof data.image_url !== 'string' || !data.image_url.trim()) {
            throw new BadRequestException('Image URL is required');
        }

        const banner = this.bannerRepository.create({
            title: data.title.trim(),
            title_en: data.title_en?.trim(),
            subtitle: data.subtitle?.trim(),
            subtitle_en: data.subtitle_en?.trim(),
            badge: data.badge?.trim(),
            badge_en: data.badge_en?.trim(),
            tag: data.tag?.trim(),
            tag_en: data.tag_en?.trim(),
            image_url: data.image_url.trim(),
            link_url: data.link_url?.trim() || '#catalogo',
            button_text: data.button_text?.trim() || 'Ver Productos',
            button_text_en: data.button_text_en?.trim() || 'Browse Catalog',
            display_order: data.display_order !== undefined ? Number(data.display_order) : 0,
            is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        });

        return this.bannerRepository.save(banner);
    }

    async update(id: number, data: Partial<Banner>): Promise<Banner> {
        const banner = await this.findOne(id);

        if (data.title !== undefined) {
            if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
                throw new BadRequestException('Title cannot be empty');
            }
            banner.title = data.title.trim();
        }
        if (data.image_url !== undefined) {
            if (!data.image_url || typeof data.image_url !== 'string' || !data.image_url.trim()) {
                throw new BadRequestException('Image URL cannot be empty');
            }
            banner.image_url = data.image_url.trim();
        }
        if (data.title_en !== undefined) banner.title_en = data.title_en?.trim();
        if (data.subtitle !== undefined) banner.subtitle = data.subtitle?.trim();
        if (data.subtitle_en !== undefined) banner.subtitle_en = data.subtitle_en?.trim();
        if (data.badge !== undefined) banner.badge = data.badge?.trim();
        if (data.badge_en !== undefined) banner.badge_en = data.badge_en?.trim();
        if (data.tag !== undefined) banner.tag = data.tag?.trim();
        if (data.tag_en !== undefined) banner.tag_en = data.tag_en?.trim();
        if (data.link_url !== undefined) banner.link_url = data.link_url?.trim();
        if (data.button_text !== undefined) banner.button_text = data.button_text?.trim();
        if (data.button_text_en !== undefined) banner.button_text_en = data.button_text_en?.trim();
        if (data.display_order !== undefined) banner.display_order = Number(data.display_order);
        if (data.is_active !== undefined) banner.is_active = Boolean(data.is_active);

        return this.bannerRepository.save(banner);
    }

    async delete(id: number): Promise<{ message: string }> {
        const banner = await this.findOne(id);
        await this.bannerRepository.remove(banner);
        return { message: `Banner #${id} deleted successfully` };
    }
}
