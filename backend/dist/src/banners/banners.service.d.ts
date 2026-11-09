import { Repository } from 'typeorm';
import { Banner } from './banner.entity';
export declare class BannersService {
    private readonly bannerRepository;
    constructor(bannerRepository: Repository<Banner>);
    findPublic(): Promise<Banner[]>;
    findAll(): Promise<Banner[]>;
    findOne(id: number): Promise<Banner>;
    create(data: Partial<Banner>): Promise<Banner>;
    update(id: number, data: Partial<Banner>): Promise<Banner>;
    delete(id: number): Promise<{
        message: string;
    }>;
}
