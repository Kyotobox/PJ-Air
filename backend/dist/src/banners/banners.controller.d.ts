import { BannersService } from './banners.service';
import { Banner } from './banner.entity';
export declare class BannersController {
    private readonly bannersService;
    constructor(bannersService: BannersService);
    getPublic(): Promise<Banner[]>;
    getGallery(overridePath?: string): Promise<{
        id: string;
        name: string;
        filename: string;
        url: string;
        fallback_url: string;
        orientation: 'landscape' | 'portrait' | 'square';
        category: string;
    }[]>;
    getAll(): Promise<Banner[]>;
    create(body: Partial<Banner>): Promise<Banner>;
    update(id: string, body: Partial<Banner>): Promise<Banner>;
    delete(id: string): Promise<{
        message: string;
    }>;
    uploadBannerImage(file: Express.Multer.File): Promise<{
        url: string;
    }>;
}
