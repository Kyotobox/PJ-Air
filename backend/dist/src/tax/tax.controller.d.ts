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
        st120PdfUrl: string | null;
        taxExempt: boolean;
        taxLegend: string | null;
    }>;
    generateDigitalST120(req: any, body?: any): Promise<{
        success: boolean;
        documentUrl: string;
        st120_pdf_url: string;
        auditHash?: string;
        user: import("../users/user.entity").User;
    }>;
    signST120(req: any, body: any): Promise<{
        success: boolean;
        documentUrl: string;
        st120_pdf_url: string;
        user: import("../users/user.entity").User;
    }>;
    uploadST120(req: any, file: Express.Multer.File, bodyUserId?: string, taxId?: string, status?: string): Promise<{
        success: boolean;
        url: string;
        documentUrl: string;
        st120_pdf_url: string;
        user: import("../users/user.entity").User;
    }>;
    getSt120Pdf(paramUserId: string, req: any, res: any): Promise<void>;
    backfillAll(): Promise<{
        success: boolean;
        processedCount: number;
        totalPending: number;
        errors: any[];
    }>;
}
