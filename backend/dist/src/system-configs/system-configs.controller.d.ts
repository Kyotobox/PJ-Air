import { SystemConfigsService } from './system-configs.service';
export declare class SystemConfigsController {
    private readonly configsService;
    constructor(configsService: SystemConfigsService);
    get(key: string): Promise<{
        key: string;
        value: string;
    }>;
    update(key: string, value: string, req: any): Promise<import("./system-config.entity").SystemConfig>;
}
