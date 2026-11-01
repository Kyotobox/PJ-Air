import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import * as fs from 'fs';
import { BannersService } from './banners.service';
import { Banner } from './banner.entity';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UPLOAD_PATH } from '../config';

@Controller('banners')
export class BannersController {
    constructor(private readonly bannersService: BannersService) {}

    @Get('public')
    async getPublic(): Promise<Banner[]> {
        return this.bannersService.findPublic();
    }

    @Get('gallery')
    async getGallery(overridePath?: string): Promise<{
        id: string;
        name: string;
        filename: string;
        url: string;
        fallback_url: string;
        orientation: 'landscape' | 'portrait' | 'square';
        category: string;
    }[]> {
        let seasonalDir: string | undefined;
        if (overridePath) {
            seasonalDir = fs.existsSync(overridePath) ? overridePath : undefined;
        } else {
            const candidatePaths = [
                resolve(process.cwd(), UPLOAD_PATH, 'banners', 'seasonal'),
                resolve(process.cwd(), 'uploads', 'banners', 'seasonal'),
                resolve(__dirname, '..', '..', 'uploads', 'banners', 'seasonal'),
                resolve(__dirname, '..', '..', '..', 'uploads', 'banners', 'seasonal'),
                '/var/www/pj-air-testing/backend/uploads/banners/seasonal',
                '/var/www/pj-air/backend/uploads/banners/seasonal',
            ];
            seasonalDir = candidatePaths.find(p => fs.existsSync(p));
        }

        if (!seasonalDir) {
            return [];
        }

        const friendlyNames: Record<string, { name: string; orientation: 'landscape' | 'portrait' | 'square'; category: string }> = {
            'seasonal_hero_flatlay_table.jpg': {
                name: 'Mesa Completa de Bollería & Postres (Mockup Oficial)',
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
            .filter(file => validExtensions.includes(extname(file).toLowerCase()))
            .map(file => {
                const meta = friendlyNames[file] || {
                    name: file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
                    orientation: 'landscape' as const,
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

    @Get()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin')
    async getAll(): Promise<Banner[]> {
        return this.bannersService.findAll();
    }

    @Post()
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin')
    async create(@Body() body: Partial<Banner>): Promise<Banner> {
        return this.bannersService.create(body);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin')
    async update(
        @Param('id') id: string,
        @Body() body: Partial<Banner>,
    ): Promise<Banner> {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new BadRequestException('Invalid banner ID');
        }
        return this.bannersService.update(parsedId, body);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin')
    async delete(@Param('id') id: string): Promise<{ message: string }> {
        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new BadRequestException('Invalid banner ID');
        }
        return this.bannersService.delete(parsedId);
    }

    @Post('upload')
    @UseGuards(AuthGuard, RolesGuard)
    @Roles('admin')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (req, file, cb) => {
                    const uploadDir = resolve(process.cwd(), UPLOAD_PATH, 'banners');
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
                    cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
                },
            }),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB
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

                const ext = extname(file.originalname).toLowerCase();
                const mime = file.mimetype;

                if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
                    return cb(
                        new BadRequestException(
                            'Only image files (.jpg, .jpeg, .png, .webp, .gif, .svg) are allowed',
                        ),
                        false,
                    );
                }
                cb(null, true);
            },
        }),
    )
    async uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return { url: `/uploads/banners/${file.filename}` };
    }
}
