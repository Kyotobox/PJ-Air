import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';
export declare class SystemConfigsService implements OnModuleInit {
    private readonly repo;
    private cachedSchedule;
    constructor(repo: Repository<SystemConfig>);
    onModuleInit(): Promise<void>;
    getCachedDeliverySchedule(): {
        workingDays: number[];
        holidays: Array<{
            date: string;
            name: string;
        }>;
        exceptionalDays: Array<{
            date: string;
            name: string;
        }>;
        cutoffHour: number;
    } | null;
    getDeliverySchedule(): Promise<{
        workingDays: number[];
        holidays: Array<{
            date: string;
            name: string;
        }>;
        exceptionalDays: Array<{
            date: string;
            name: string;
        }>;
        cutoffHour: number;
    }>;
    updateDeliverySchedule(data: {
        workingDays?: number[];
        holidays?: Array<{
            date: string;
            name: string;
        }>;
        exceptionalDays?: Array<{
            date: string;
            name: string;
        }>;
    }): Promise<{
        workingDays: number[];
        holidays: Array<{
            date: string;
            name: string;
        }>;
        exceptionalDays: Array<{
            date: string;
            name: string;
        }>;
        cutoffHour: number;
    }>;
    getStoreDiscount(): Promise<{
        reason: string;
        percentage: number;
        valid_until: string;
        is_active: boolean;
    }>;
    updateStoreDiscount(data: {
        reason?: string;
        percentage: number;
        valid_until: string;
        is_active: boolean;
    }): Promise<{
        reason: string;
        percentage: number;
        valid_until: string;
        is_active: boolean;
    }>;
    get(key: string, defaultValue?: string): Promise<string>;
    update(key: string, value: string): Promise<SystemConfig>;
}
