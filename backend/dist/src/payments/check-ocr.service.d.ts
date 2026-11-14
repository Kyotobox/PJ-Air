export interface CheckOcrResult {
    isValid: boolean;
    reason?: string;
    checkNumber?: string;
    routingNumber?: string;
    accountNumber?: string;
    amount?: number;
    confidence?: number;
    rawText?: string;
}
export declare class CheckOcrService {
    private readonly logger;
    validateCheckImage(imageBuffer: Buffer, expectedAmount?: number): Promise<CheckOcrResult>;
    private verifyFileSignature;
    private detectBlurriness;
    private extractMicr;
    private extractAmount;
    private extractCheckNumber;
}
