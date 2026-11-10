import { SystemConfigsService } from './system-configs.service';
export declare class SystemConfigsController {
    private readonly configsService;
    constructor(configsService: SystemConfigsService);
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
    updateDeliverySchedule(body: any, req: any): Promise<{
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
    get(key: string): Promise<{
        key: string;
        value: string;
    }>;
    update(key: string, value: string, req: any): Promise<import("./system-config.entity").SystemConfig>;
}
