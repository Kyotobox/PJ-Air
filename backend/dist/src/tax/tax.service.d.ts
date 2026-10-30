import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { VisionValidationService, VisionValidationResult } from './vision-validation.service';
export interface TaxCalculationResult {
    tax_amount: number;
    tax_rate: number;
    tax_exempt: boolean;
    tax_legend: string | null;
}
export declare const NYS_DTF_LEGEND_PREFIX = "Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business.";
export declare class TaxService {
    private userRepository;
    private profileRepository;
    private visionValidationService;
    private readonly logger;
    static readonly NY_STANDARD_SALES_TAX_RATE = 8.875;
    constructor(userRepository: Repository<User>, profileRepository: Repository<Profile>, visionValidationService: VisionValidationService);
    getOfficialNysDtfLegend(taxId?: string | null): string;
    calculateOrderTax(user: {
        tax_exempt?: boolean | null;
        tax_id?: string | null;
        profile?: {
            tax_exempt?: boolean | null;
            tax_id?: string | null;
        };
    }, subtotal: number): TaxCalculationResult;
    auditUserST120(userId: string): Promise<VisionValidationResult>;
    approveExemption(userId: string): Promise<{
        success: boolean;
        user: User;
    }>;
    rejectExemption(userId: string, reason?: string): Promise<{
        success: boolean;
        user: User;
    }>;
}
