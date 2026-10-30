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
