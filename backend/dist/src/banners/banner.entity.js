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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Banner = void 0;
const typeorm_1 = require("typeorm");
let Banner = class Banner {
    id;
    title;
    title_en;
    subtitle;
    subtitle_en;
    badge;
    badge_en;
    tag;
    tag_en;
    image_url;
    link_url;
    button_text;
    button_text_en;
    secondary_button_text;
    secondary_button_text_en;
    secondary_link_url;
    display_order;
    is_active;
    created_at;
    updated_at;
};
exports.Banner = Banner;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Banner.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Banner.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "title_en", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "subtitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "subtitle_en", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "badge", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "badge_en", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "tag", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "tag_en", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Banner.prototype, "image_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: '#catalogo' }),
    __metadata("design:type", String)
], Banner.prototype, "link_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: 'Ver Productos' }),
    __metadata("design:type", String)
], Banner.prototype, "button_text", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: 'Browse Catalog' }),
    __metadata("design:type", String)
], Banner.prototype, "button_text_en", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "secondary_button_text", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "secondary_button_text_en", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Banner.prototype, "secondary_link_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Banner.prototype, "display_order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Banner.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Banner.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Banner.prototype, "updated_at", void 0);
exports.Banner = Banner = __decorate([
    (0, typeorm_1.Entity)('banners')
], Banner);
//# sourceMappingURL=banner.entity.js.map