import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';
import { Banner } from './banner.entity';

describe('BannersController', () => {
    let controller: BannersController;
    let service: any;

    const mockBanner: Banner = {
        id: 1,
        title: 'Croissants de Mantequilla',
        title_en: 'Butter Croissants',
        subtitle: 'Bollería fina para cafeterías',
        subtitle_en: 'Fine pastry for cafes',
        badge: 'Bestseller',
        badge_en: 'Bestseller',
        tag: 'Bollería Francesa',
        tag_en: 'French Pastry',
        image_url: '/uploads/banners/croissant.jpg',
        link_url: '#catalogo',
        button_text: 'Ver Productos',
        button_text_en: 'Browse Catalog',
        display_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    };

    beforeEach(async () => {
        service = {
            findPublic: jest.fn().mockResolvedValue([mockBanner]),
            findAll: jest.fn().mockResolvedValue([mockBanner]),
            findOne: jest.fn().mockResolvedValue(mockBanner),
            create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
            update: jest.fn().mockImplementation((id, dto) => Promise.resolve({ ...mockBanner, ...dto })),
            delete: jest.fn().mockResolvedValue({ message: 'Banner #1 deleted successfully' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [BannersController],
            providers: [{ provide: BannersService, useValue: service }],
        }).compile();

        controller = module.get<BannersController>(BannersController);
    });

    describe('getPublic', () => {
        it('should return active banners from service', async () => {
            const res = await controller.getPublic();
            expect(res).toEqual([mockBanner]);
            expect(service.findPublic).toHaveBeenCalled();
        });
    });

    describe('getAll', () => {
        it('should return all banners for admin', async () => {
            const res = await controller.getAll();
            expect(res).toEqual([mockBanner]);
            expect(service.findAll).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('should create banner', async () => {
            const res = await controller.create({
                title: 'New Banner',
                image_url: '/img.jpg',
            });
            expect(res.title).toBe('New Banner');
            expect(service.create).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should update banner with valid id', async () => {
            const res = await controller.update('1', { is_active: false });
            expect(res.is_active).toBe(false);
            expect(service.update).toHaveBeenCalledWith(1, { is_active: false });
        });

        it('should throw BadRequestException if id is not a number', async () => {
            await expect(controller.update('invalid-id', { is_active: false })).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('delete', () => {
        it('should delete banner with valid id', async () => {
            const res = await controller.delete('1');
            expect(res.message).toContain('deleted successfully');
            expect(service.delete).toHaveBeenCalledWith(1);
        });

        it('should throw BadRequestException if id is not a number', async () => {
            await expect(controller.delete('abc')).rejects.toThrow(BadRequestException);
        });
    });

    describe('uploadBannerImage', () => {
        it('should return url for uploaded file', async () => {
            const mockFile = {
                filename: 'banner-123.jpg',
            } as Express.Multer.File;

            const res = await controller.uploadBannerImage(mockFile);
            expect(res.url).toBe('/uploads/banners/banner-123.jpg');
        });

        it('should throw BadRequestException if file is missing', async () => {
            await expect(controller.uploadBannerImage(undefined as any)).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
