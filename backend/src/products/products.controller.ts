import { Controller, Post, Get, Body, Param, Patch, Delete, UseInterceptors, UploadedFiles, UploadedFile, BadRequestException } from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { ProductsService } from './products.service';
import { UPLOAD_PATH } from '../config';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    async findAll() {
        return this.productsService.findAll();
    }

    @Get('category/:category')
    async findByCategory(@Param('category') category: string) {
        return this.productsService.findByCategory(category);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            throw new BadRequestException('Invalid product ID');
        }
        return this.productsService.findOne(parsedId);
    }

    @Post()
    async create(@Body() body: any) {
        return this.productsService.create(body);
    }

    /** Batch-update a category's settings (name, EN name, min quantity) across all its products */
    @Patch('rename-category')
    async updateCategory(@Body() body: { oldName: string; newName: string; newNameEn: string; minQty?: number }) {
        return this.productsService.updateCategory(body.oldName, { 
            newName: body.newName, 
            newNameEn: body.newNameEn, 
            minQty: body.minQty 
        });
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            throw new BadRequestException('Invalid product ID');
        }
        return this.productsService.update(parsedId, body);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        const parsedId = parseInt(id);
        if (isNaN(parsedId)) {
            throw new BadRequestException('Invalid product ID');
        }
        return this.productsService.delete(parsedId);
    }

    @Post('upload-image')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = join(resolve(UPLOAD_PATH), 'products');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const randomName = Array(24).fill(null).map(() => Math.round(Math.random() * 16).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname).toLowerCase()}`);
            },
        }),
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
        },
        fileFilter: (req, file, cb) => {
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            
            const ext = extname(file.originalname).toLowerCase();
            const mime = file.mimetype;

            if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
                return cb(new BadRequestException('Only image files (.jpg, .jpeg, .png, .webp, .gif) are allowed'), false);
            }
            cb(null, true);
        }
    }))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file uploaded');
        return { url: `/uploads/products/${file.filename}` };
    }

    @Post('upload')
    @UseInterceptors(FilesInterceptor('files', 10, {
        limits: {
            fileSize: 2 * 1024 * 1024, // 2MB
        },
        fileFilter: (req, file, cb) => {
            const ext = extname(file.originalname).toLowerCase();
            const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
            
            if (ext !== '.csv' || !allowedMimeTypes.includes(file.mimetype)) {
                return cb(new BadRequestException('Only CSV files (.csv) are allowed'), false);
            }
            cb(null, true);
        }
    }))
    async uploadProducts(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: any
    ) {
        if (!files || files.length === 0) {
            return { message: 'Upload processed successfully' };
        }
        const csvFile = files.find(f => f.originalname.toLowerCase().endsWith('.csv'));
        if (csvFile) {
            await this.productsService.processCSV(csvFile);
        }
        return { message: 'Upload processed successfully' };
    }
}
