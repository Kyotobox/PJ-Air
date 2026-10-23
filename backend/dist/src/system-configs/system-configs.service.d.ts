import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';
export declare class SystemConfigsService implements OnModuleInit {
    private readonly repo;
    constructor(repo: Repository<SystemConfig>);
    onModuleInit(): Promise<void>;
    get(key: string, defaultValue?: string): Promise<string>;
    update(key: string, value: string): Promise<SystemConfig>;
}
