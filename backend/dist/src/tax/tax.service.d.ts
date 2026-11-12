import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Profile } from '../users/profile.entity';
import { VisionValidationService, VisionValidationResult } from './vision-validation.service';
import { St120GeneratorService } from './st120-generator.service';
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
    private st120GeneratorService?;
    private readonly logger;
    static readonly NY_STANDARD_SALES_TAX_RATE = 8.875;
    constructor(userRepository: Repository<User>, profileRepository: Repository<Profile>, visionValidationService: VisionValidationService, st120GeneratorService?: St120GeneratorService | undefined);
    private getGenerator;
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
    generateDigitalST120(userId: string, requestingUser?: {
        id: string;
        role?: string;
    }, dto?: {
        legal_business_name?: string;
        legalBusinessName?: string;
        ein?: string;
        signer_name?: string;
        signerName?: string;
        signer_title?: string;
        signerTitle?: string;
        signature_text?: string;
        signatureText?: string;
        dba?: string;
        business_address?: string;
        businessAddress?: string;
        tax_id?: string;
        taxId?: string;
    }): Promise<{
        success: boolean;
        documentUrl: string;
        st120_pdf_url: string;
        auditHash?: string;
        user: User;
    }>;
    signST120(userId: string, signData: {
        signature_text: string;
        signer_name: string;
        signer_title?: string;
        legal_business_name?: string;
        dba?: string;
        business_address?: string;
        tax_id?: string;
        ein?: string;
    }, clientIp?: string, requestingUser?: {
        id: string;
        role?: string;
    }): Promise<{
        success: boolean;
        documentUrl: string;
        st120_pdf_url: string;
        user: User;
    }>;
    uploadST120(userId: string, file: Express.Multer.File, taxId?: string, requestingUser?: {
        id: string;
        role?: string;
    }, status?: string): Promise<{
        success: boolean;
        url: string;
        documentUrl: string;
        st120_pdf_url: string;
        user: User;
    }>;
    getSt120Pdf(userId: string): Promise<{
        filePath: string;
        buffer: Buffer;
        filename: string;
        mimeType: string;
    }>;
    backfillAllPending(): Promise<{
        success: boolean;
        processedCount: number;
        totalPending: number;
        errors: any[];
    }>;
}
