import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BannersService } from './banners.service';
import { Banner } from './banner.entity';

describe('BannersService', () => {
    let service: BannersService;
    let bannerRepo: any;

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
        bannerRepo = {
            create: jest.fn().mockImplementation((dto) => ({
                id: 1,
                created_at: new Date(),
                updated_at: new Date(),
                ...dto,
            })),
            save: jest.fn().mockImplementation(async (item) => ({ ...item })),
            find: jest.fn().mockResolvedValue([mockBanner]),
            findOne: jest.fn().mockImplementation(async ({ where: { id } }) => {
                if (id === 1) return { ...mockBanner };
                return null;
            }),
            remove: jest.fn().mockResolvedValue(mockBanner),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BannersService,
                { provide: getRepositoryToken(Banner), useValue: bannerRepo },
            ],
        }).compile();

        service = module.get<BannersService>(BannersService);
    });

    describe('create - Happy Path', () => {
        it('should successfully create a banner with all fields', async () => {
            const result = await service.create({
                title: 'Especial de Navidad',
                title_en: 'Christmas Special',
                subtitle: 'Panettones y troncos navideños',
                subtitle_en: 'Panettones and yule logs',
                badge: 'Temporada',
                badge_en: 'Seasonal',
                tag: 'Edición Limitada',
                tag_en: 'Limited Edition',
                image_url: '/uploads/banners/navidad.jpg',
                link_url: '/catalog/seasonal',
                button_text: 'Ordenar Ahora',
                button_text_en: 'Order Now',
                display_order: 2,
                is_active: true,
            });

            expect(result.title).toBe('Especial de Navidad');
            expect(result.image_url).toBe('/uploads/banners/navidad.jpg');
            expect(result.display_order).toBe(2);
            expect(result.is_active).toBe(true);
            expect(bannerRepo.create).toHaveBeenCalled();
            expect(bannerRepo.save).toHaveBeenCalled();
        });

        it('should assign default values for link_url, button_text and is_active', async () => {
            const result = await service.create({
                title: 'Pan Rústico',
                image_url: '/uploads/banners/pan.jpg',
            });

            expect(result.title).toBe('Pan Rústico');
            expect(result.link_url).toBe('#catalogo');
            expect(result.button_text).toBe('Ver Productos');
            expect(result.button_text_en).toBe('Browse Catalog');
            expect(result.is_active).toBe(true);
            expect(result.display_order).toBe(0);
        });
    });

    describe('create - Sad Path (§6)', () => {
        it('should throw BadRequestException if title is missing', async () => {
            await expect(
                service.create({
                    image_url: '/uploads/banners/no-title.jpg',
                } as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if title is empty or only whitespace', async () => {
            await expect(
                service.create({
                    title: '   ',
                    image_url: '/uploads/banners/whitespace.jpg',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if image_url is missing', async () => {
            await expect(
                service.create({
                    title: 'Banner sin imagen',
                } as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if image_url is empty or only whitespace', async () => {
            await expect(
                service.create({
                    title: 'Banner con imagen vacía',
                    image_url: '   ',
                }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('findPublic - Happy Path', () => {
        it('should query only active banners ordered by display_order ASC', async () => {
            bannerRepo.find.mockResolvedValueOnce([mockBanner]);

            const banners = await service.findPublic();

            expect(bannerRepo.find).toHaveBeenCalledWith({
                where: { is_active: true },
                order: { display_order: 'ASC', id: 'ASC' },
            });
            expect(banners).toHaveLength(1);
            expect(banners[0].is_active).toBe(true);
        });
    });

    describe('findAll - Happy Path', () => {
        it('should query all banners ordered by display_order ASC', async () => {
            bannerRepo.find.mockResolvedValueOnce([
                mockBanner,
                { ...mockBanner, id: 2, is_active: false },
            ]);

            const banners = await service.findAll();

            expect(bannerRepo.find).toHaveBeenCalledWith({
                order: { display_order: 'ASC', id: 'ASC' },
            });
            expect(banners).toHaveLength(2);
        });
    });

    describe('findOne - Happy & Sad Path (§6)', () => {
        it('should return the banner if found', async () => {
            const banner = await service.findOne(1);
            expect(banner).toBeDefined();
            expect(banner.id).toBe(1);
        });

        it('should throw BadRequestException for invalid id (NaN or 0)', async () => {
            await expect(service.findOne(NaN)).rejects.toThrow(BadRequestException);
            await expect(service.findOne(0)).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if banner does not exist', async () => {
            await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        });
    });

    describe('update - Happy & Sad Path (§6)', () => {
        it('should update banner fields and active status', async () => {
            const updated = await service.update(1, {
                title: 'Croissants Horneados de Mantequilla',
                is_active: false,
                display_order: 5,
            });

            expect(updated.title).toBe('Croissants Horneados de Mantequilla');
            expect(updated.is_active).toBe(false);
            expect(updated.display_order).toBe(5);
            expect(bannerRepo.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when updating non-existent banner', async () => {
            await expect(service.update(999, { is_active: false })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw BadRequestException when updating title with empty string', async () => {
            await expect(service.update(1, { title: '  ' })).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException when updating image_url with empty string', async () => {
            await expect(service.update(1, { image_url: '  ' })).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('delete - Happy & Sad Path (§6)', () => {
        it('should delete existing banner successfully', async () => {
            const res = await service.delete(1);
            expect(res.message).toContain('Banner #1 deleted successfully');
            expect(bannerRepo.remove).toHaveBeenCalled();
        });

        it('should throw NotFoundException when deleting non-existent banner', async () => {
            await expect(service.delete(999)).rejects.toThrow(NotFoundException);
        });
    });
});
