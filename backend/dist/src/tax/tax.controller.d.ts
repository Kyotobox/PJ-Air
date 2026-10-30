import { TaxService } from './tax.service';
export declare class TaxController {
    private readonly taxService;
    constructor(taxService: TaxService);
    validateST120(userId: string): Promise<import("./vision-validation.service").VisionValidationResult>;
    approveExemption(userId: string): Promise<{
        success: boolean;
        user: import("../users/user.entity").User;
    }>;
    rejectExemption(userId: string, reason?: string): Promise<{
        success: boolean;
        user: import("../users/user.entity").User;
    }>;
    getStatus(userId: string): Promise<{
        userId: string;
        taxId: string | null;
        st120Status: string;
        st120DocumentUrl: string | null;
        taxExempt: boolean;
        taxLegend: string | null;
    }>;
}
