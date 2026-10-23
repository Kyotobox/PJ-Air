import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
export declare class AdminActionsService {
    private readonly userRepository;
    private readonly systemConfigRepository;
    constructor(userRepository: Repository<User>, systemConfigRepository: Repository<SystemConfig>);
    resetPassword(targetUserId: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
