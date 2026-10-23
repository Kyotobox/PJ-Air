import { AdminActionsService } from './admin-actions.service';
export declare class AdminActionsController {
    private readonly adminActionsService;
    constructor(adminActionsService: AdminActionsService);
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
