export type VisionVerdict = 'MATCH' | 'MISMATCH' | 'NEEDS_REVIEW';
export interface ST120Extraction {
    isValidST120Format: boolean;
    extractedTaxId: string | null;
    extractedCompanyName: string | null;
    hasPhysicalSignature: boolean;
    isBlurryOrUnreadable?: boolean;
    confidenceScore?: number;
    notes?: string;
}
export interface VisionValidationResult {
    verdict: VisionVerdict;
    isValidST120Format: boolean;
    extractedTaxId: string | null;
    extractedCompanyName: string | null;
    hasPhysicalSignature: boolean;
    confidenceScore: number;
    reason: string;
    comparisonDetails: {
        taxIdMatch: boolean;
        companyNameMatch: boolean;
        userTaxId: string | null;
        userCompanyName: string | null;
    };
    notes?: string;
}
export declare class VisionValidationService {
    private readonly logger;
    normalizeTaxId(taxId?: string | null): string;
    normalizeCompanyName(name?: string | null): string;
    resolveFilePath(documentPath: string): string;
    callGeminiVisionApi(fileBuffer: Buffer, mimeType: string): Promise<ST120Extraction>;
    compareExtractionWithUser(extraction: ST120Extraction, user: {
        tax_id?: string | null;
        company_name?: string | null;
    }): VisionValidationResult;
    analyzeDocument(documentPath: string, user: {
        tax_id?: string | null;
        company_name?: string | null;
    }): Promise<VisionValidationResult>;
    validateAndAssertST120(documentPath: string, user: {
        tax_id?: string | null;
        company_name?: string | null;
    }): Promise<VisionValidationResult>;
}
