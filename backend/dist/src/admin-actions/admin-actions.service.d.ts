import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { AdminAuditLog } from './admin-audit-log.entity';
export declare class AdminActionsService {
    private readonly userRepository;
    private readonly systemConfigRepository;
    private readonly adminAuditLogRepository;
    constructor(userRepository: Repository<User>, systemConfigRepository: Repository<SystemConfig>, adminAuditLogRepository: Repository<AdminAuditLog>);
    resetPassword(targetUserId: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    logAction(adminId: string, adminName: string, action: string, targetEntity: string, targetId: string, prevState?: any, newState?: any, notes?: string, ip?: string, actorRole?: string): Promise<AdminAuditLog>;
    getAuditLogs(options?: {
        page?: number;
        limit?: number;
        action?: string;
        targetEntity?: string;
        targetId?: string;
        adminId?: string;
        actorRole?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        logs: AdminAuditLog[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
