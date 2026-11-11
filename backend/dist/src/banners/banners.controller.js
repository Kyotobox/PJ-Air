"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const banners_service_1 = require("./banners.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const config_1 = require("../config");
let BannersController = class BannersController {
    bannersService;
    constructor(bannersService) {
        this.bannersService = bannersService;
    }
    async getPublic() {
        return this.bannersService.findPublic();
    }
    async getGallery(overridePath) {
        let seasonalDir;
        if (overridePath) {
            seasonalDir = fs.existsSync(overridePath) ? overridePath : undefined;
        }
        else {
            const candidatePaths = [
                (0, path_1.resolve)(process.cwd(), config_1.UPLOAD_PATH, 'banners', 'seasonal'),
                (0, path_1.resolve)(process.cwd(), 'uploads', 'banners', 'seasonal'),
                (0, path_1.resolve)(__dirname, '..', '..', 'uploads', 'banners', 'seasonal'),
                (0, path_1.resolve)(__dirname, '..', '..', '..', 'uploads', 'banners', 'seasonal'),
                '/var/www/pj-air-testing/backend/uploads/banners/seasonal',
                '/var/www/pj-air/backend/uploads/banners/seasonal',
            ];
            seasonalDir = candidatePaths.find(p => fs.existsSync(p));
        }
        if (!seasonalDir) {
            return [];
        }
        const friendlyNames = {
            'seasonal_hero_flatlay_table.jpg': {
                name: 'Mesa Completa de Bollería & Postres (Fotografía Oficial)',
                orientation: 'landscape',
                category: 'hero'
            },
            'seasonal_hero_pastries_assorted.jpg': {
                name: 'Selección de Tartas Finas y Postres',
                orientation: 'landscape',
                category: 'hero'
            },
            'seasonal_hero_catering_spread.jpg': {
                name: 'Banquete de Despacho Mayorista',
                orientation: 'landscape',
                category: 'hero'
            },
            'seasonal_croissants_butter_golden.jpg': {
                name: 'Croissants de Mantequilla Dorada',
                orientation: 'square',
                category: 'viennoiserie'
            },
            'seasonal_danish_berries_cream.jpg': {
                name: 'Hojaldre Danés de Frutos del Bosque',
                orientation: 'square',
                category: 'pastry'
            },
            'seasonal_brioche_fruit_tart.jpg': {
                name: 'Brioche de Frutas & Tartaleta Especial',
                orientation: 'square',
                category: 'pastry'
            },
            'seasonal_pastry_showcase_01.jpg': {
                name: 'Vitrina de Pastelería 01 (Móvil)',
                orientation: 'portrait',
                category: 'showcase'
            },
            'seasonal_pastry_showcase_02.jpg': {
                name: 'Vitrina de Pastelería 02 (Móvil)',
                orientation: 'portrait',
                category: 'showcase'
            },
            'seasonal_pastry_showcase_03.jpg': {
                name: 'Vitrina de Pastelería 03 (Móvil)',
                orientation: 'portrait',
                category: 'showcase'
            },
            'seasonal_artisan_loaf_rustic.jpg': {
                name: 'Pan Rústico de Masa Madre',
                orientation: 'portrait',
                category: 'bread'
            }
        };
        const files = fs.readdirSync(seasonalDir);
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        return files
            .filter(file => validExtensions.includes((0, path_1.extname)(file).toLowerCase()))
            .map(file => {
            const meta = friendlyNames[file] || {
                name: file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
                orientation: 'landscape',
                category: 'seasonal'
            };
            return {
                id: file.replace(/\.[^/.]+$/, ''),
                name: meta.name,
                filename: file,
                url: `/uploads/banners/seasonal/${file}`,
                fallback_url: `/images/banners/seasonal/${file}`,
                orientation: meta.orientation,
                category: meta.category
            };
        });
    }
    async getAll() {
        return this.bannersService.findAll();
    }
    async create(body) {
        return this.bannersService.create(body);
    }
    async update(id, body) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new common_1.BadRequestException('Invalid banner ID');
        }
        return this.bannersService.update(parsedId, body);
    }
    async delete(id) {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new common_1.BadRequestException('Invalid banner ID');
        }
        return this.bannersService.delete(parsedId);
    }
    async uploadBannerImage(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        return { url: `/uploads/banners/${file.filename}` };
    }
};
exports.BannersController = BannersController;
__decorate([
    (0, common_1.Get)('public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "getPublic", null);
__decorate([
    (0, common_1.Get)('gallery'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "getGallery", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "getAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadDir = (0, path_1.resolve)(process.cwd(), config_1.UPLOAD_PATH, 'banners');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const randomName = Array(32)
                    .fill(null)
                    .map(() => Math.round(Math.random() * 16).toString(16))
                    .join('');
                cb(null, `${randomName}${(0, path_1.extname)(file.originalname).toLowerCase()}`);
            },
        }),
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
            const allowedMimeTypes = [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/gif',
                'image/svg+xml',
            ];
            const ext = (0, path_1.extname)(file.originalname).toLowerCase();
            const mime = file.mimetype;
            if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
                return cb(new common_1.BadRequestException('Only image files (.jpg, .jpeg, .png, .webp, .gif, .svg) are allowed'), false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BannersController.prototype, "uploadBannerImage", null);
exports.BannersController = BannersController = __decorate([
    (0, common_1.Controller)('banners'),
    __metadata("design:paramtypes", [banners_service_1.BannersService])
], BannersController);
//# sourceMappingURL=banners.controller.js.map