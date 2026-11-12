export interface ST120PdfData {
    userId?: string;
    vendorName?: string;
    vendorAddress?: string;
    legalBusinessName: string;
    dba?: string | null;
    businessAddress: string;
    taxId?: string | null;
    ein?: string | null;
    signerName: string;
    signerTitle?: string | null;
    signatureText?: string | null;
    acceptedAt?: Date | string | null;
    ipAddress?: string | null;
}
export interface ST120GenerationResult {
    filePath: string;
    relativeUrl: string;
    relativePath: string;
    buffer: Buffer;
    auditHash: string;
    forensicHash: string;
}
export declare const OFFICIAL_VENDOR_NAME = "Jhoanes Bakery & Coffee LLC";
export declare const OFFICIAL_VENDOR_ADDRESS = "33-04 Broadway, Astoria, NY 11106";
export declare class St120GeneratorService {
    private readonly logger;
    generateDigitalSt120Pdf(data: ST120PdfData): Promise<ST120GenerationResult>;
    generateST120Pdf(data: ST120PdfData): Promise<ST120GenerationResult>;
    private drawSectionHeader;
}
