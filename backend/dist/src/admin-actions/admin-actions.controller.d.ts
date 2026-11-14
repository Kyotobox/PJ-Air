import { AdminActionsService } from './admin-actions.service';
export declare class AdminActionsController {
    private readonly adminActionsService;
    constructor(adminActionsService: AdminActionsService);
    getAuditLogs(page?: string, limit?: string, action?: string, targetEntity?: string, targetEntityCamel?: string, targetId?: string, targetIdCamel?: string, adminId?: string, adminIdCamel?: string, actorRole?: string, actorRoleCamel?: string, search?: string, startDate?: string, endDate?: string): Promise<{
        logs: import("./admin-audit-log.entity").AdminAuditLog[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    resetPassword(id: string, body: {
        newPassword?: string;
    }, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    changePassword(body: {
        currentPassword?: string;
        newPassword?: string;
    }, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
