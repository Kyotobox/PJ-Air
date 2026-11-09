export type FacadeCategory = 'STOREFRONT' | 'FOOD_PRODUCT' | 'DOCUMENT' | 'SELFIE_PERSON' | 'OTHER';
export interface FacadeAnalysisResult {
    isValid: boolean;
    category: FacadeCategory;
    confidence: number;
    reason?: string;
    status: 'VERIFIED' | 'REJECTED' | 'PENDING_AUDIT';
    description?: string;
}
export declare class FacadeVisionService {
    private readonly logger;
    validateFacade(fileBuffer: Buffer, mimeType: string): Promise<FacadeAnalysisResult>;
    resolveBufferFromUrlOrPath(imageUrl: string): {
        buffer: Buffer;
        mimeType: string;
    };
}
