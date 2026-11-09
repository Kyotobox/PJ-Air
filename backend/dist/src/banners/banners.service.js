"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const banner_entity_1 = require("./banner.entity");
let BannersService = class BannersService {
    bannerRepository;
    constructor(bannerRepository) {
        this.bannerRepository = bannerRepository;
    }
    async findPublic() {
        return this.bannerRepository.find({
            where: { is_active: true },
            order: { display_order: 'ASC', id: 'ASC' },
        });
    }
    async findAll() {
        return this.bannerRepository.find({
            order: { display_order: 'ASC', id: 'ASC' },
        });
    }
    async findOne(id) {
        if (!id || isNaN(id)) {
            throw new common_1.BadRequestException('Invalid banner ID');
        }
        const banner = await this.bannerRepository.findOne({ where: { id } });
        if (!banner) {
            throw new common_1.NotFoundException(`Banner with ID ${id} not found`);
        }
        return banner;
    }
    async create(data) {
        if (!data || !data.title || typeof data.title !== 'string' || !data.title.trim()) {
            throw new common_1.BadRequestException('Title is required');
        }
        if (!data.image_url || typeof data.image_url !== 'string' || !data.image_url.trim()) {
            throw new common_1.BadRequestException('Image URL is required');
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
            secondary_button_text: data.secondary_button_text?.trim(),
            secondary_button_text_en: data.secondary_button_text_en?.trim(),
            secondary_link_url: data.secondary_link_url?.trim(),
            display_order: data.display_order !== undefined ? Number(data.display_order) : 0,
            is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
        });
        return this.bannerRepository.save(banner);
    }
    async update(id, data) {
        const banner = await this.findOne(id);
        if (data.title !== undefined) {
            if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
                throw new common_1.BadRequestException('Title cannot be empty');
            }
            banner.title = data.title.trim();
        }
        if (data.image_url !== undefined) {
            if (!data.image_url || typeof data.image_url !== 'string' || !data.image_url.trim()) {
                throw new common_1.BadRequestException('Image URL cannot be empty');
            }
            banner.image_url = data.image_url.trim();
        }
        if (data.title_en !== undefined)
            banner.title_en = data.title_en?.trim();
        if (data.subtitle !== undefined)
            banner.subtitle = data.subtitle?.trim();
        if (data.subtitle_en !== undefined)
            banner.subtitle_en = data.subtitle_en?.trim();
        if (data.badge !== undefined)
            banner.badge = data.badge?.trim();
        if (data.badge_en !== undefined)
            banner.badge_en = data.badge_en?.trim();
        if (data.tag !== undefined)
            banner.tag = data.tag?.trim();
        if (data.tag_en !== undefined)
            banner.tag_en = data.tag_en?.trim();
        if (data.link_url !== undefined)
            banner.link_url = data.link_url?.trim();
        if (data.button_text !== undefined)
            banner.button_text = data.button_text?.trim();
        if (data.button_text_en !== undefined)
            banner.button_text_en = data.button_text_en?.trim();
        if (data.secondary_button_text !== undefined)
            banner.secondary_button_text = data.secondary_button_text?.trim();
        if (data.secondary_button_text_en !== undefined)
            banner.secondary_button_text_en = data.secondary_button_text_en?.trim();
        if (data.secondary_link_url !== undefined)
            banner.secondary_link_url = data.secondary_link_url?.trim();
        if (data.display_order !== undefined)
            banner.display_order = Number(data.display_order);
        if (data.is_active !== undefined)
            banner.is_active = Boolean(data.is_active);
        return this.bannerRepository.save(banner);
    }
    async delete(id) {
        const banner = await this.findOne(id);
        await this.bannerRepository.remove(banner);
        return { message: `Banner #${id} deleted successfully` };
    }
};
exports.BannersService = BannersService;
exports.BannersService = BannersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(banner_entity_1.Banner)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BannersService);
//# sourceMappingURL=banners.service.js.map