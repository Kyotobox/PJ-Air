"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var VisionValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionValidationService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tax_exceptions_1 = require("./tax.exceptions");
let VisionValidationService = VisionValidationService_1 = class VisionValidationService {
    logger = new common_1.Logger(VisionValidationService_1.name);
    normalizeTaxId(taxId) {
        if (!taxId)
            return '';
        return taxId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
    normalizeCompanyName(name) {
        if (!name)
            return '';
        return name
            .toLowerCase()
            .replace(/\b(llc|inc|corp|co|ltd|bakery|shop|panaderia|panadería)\b/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }
    resolveFilePath(documentPath) {
        if (fs.existsSync(documentPath)) {
            return documentPath;
        }
        const cleanPath = documentPath.startsWith('/') ? documentPath.slice(1) : documentPath;
        const baseUploads = path.resolve(process.cwd(), cleanPath);
        if (fs.existsSync(baseUploads)) {
            return baseUploads;
        }
        const parentUploads = path.resolve(process.cwd(), '..', cleanPath);
        if (fs.existsSync(parentUploads)) {
            return parentUploads;
        }
        const uploadsDir = path.resolve(process.cwd(), 'uploads', path.basename(documentPath));
        if (fs.existsSync(uploadsDir)) {
            return uploadsDir;
        }
        const st120UploadsDir = path.resolve(process.cwd(), 'uploads', 'st120', path.basename(documentPath));
        if (fs.existsSync(st120UploadsDir)) {
            return st120UploadsDir;
        }
        return documentPath;
    }
    async callGeminiVisionApi(fileBuffer, mimeType) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('[UNAVAILABLE_EXTERNAL_PROVIDER] Gemini API Key not configured. Deferring to manual audit.');
            return {
                isValidST120Format: false,
                extractedTaxId: null,
                extractedCompanyName: null,
                hasPhysicalSignature: false,
                isBlurryOrUnreadable: false,
                confidenceScore: 0.0,
                notes: '[UNAVAILABLE_EXTERNAL_PROVIDER] API key is missing. Manual administrator review required.',
            };
        }
        try {
            const base64Data = fileBuffer.toString('base64');
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const prompt = `You are an expert tax auditor for the New York State Department of Taxation and Finance (NYS DTF).
Analyze this uploaded document. Check carefully:
1. Is this document an official Form ST-120 (New York State and Local Sales and Use Tax Resale Certificate)?
2. Extract the Certificate of Authority number / Tax Identification Number (TIN / Tax ID).
3. Extract the Purchaser's legal name or trade name (Company Name).
4. Check if there is a physical handwritten or digital legal signature in the signature area.
5. Check if the image/document is blurry, unreadable, cut off, or corrupted.

Return ONLY a valid JSON object without markdown formatting, matching this exact schema:
{
  "isValidST120Format": boolean,
  "extractedTaxId": string | null,
  "extractedCompanyName": string | null,
  "hasPhysicalSignature": boolean,
  "isBlurryOrUnreadable": boolean,
  "confidenceScore": number,
  "notes": string
}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: mimeType || 'application/pdf',
                                        data: base64Data,
                                    },
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'application/json',
                    },
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`Gemini Vision API error (${response.status}): ${errorText}`);
                throw new Error(`Gemini Vision API error: ${response.statusText}`);
            }
            const data = await response.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawJson) {
                throw new Error('Empty response from Gemini Vision API');
            }
            const parsed = JSON.parse(rawJson);
            return {
                isValidST120Format: Boolean(parsed.isValidST120Format),
                extractedTaxId: parsed.extractedTaxId ? String(parsed.extractedTaxId).trim() : null,
                extractedCompanyName: parsed.extractedCompanyName ? String(parsed.extractedCompanyName).trim() : null,
                hasPhysicalSignature: Boolean(parsed.hasPhysicalSignature),
                isBlurryOrUnreadable: Boolean(parsed.isBlurryOrUnreadable),
                confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
                notes: parsed.notes ? String(parsed.notes) : '',
            };
        }
        catch (err) {
            this.logger.error(`Error during Gemini Vision execution: ${err.message}`);
            throw err;
        }
    }
    compareExtractionWithUser(extraction, user) {
        const userTaxId = user.tax_id || null;
        const userCompanyName = user.company_name || null;
        const normExtractedTax = this.normalizeTaxId(extraction.extractedTaxId);
        const normUserTax = this.normalizeTaxId(userTaxId);
        const taxIdMatch = normExtractedTax !== '' && normUserTax !== '' && normExtractedTax === normUserTax;
        const normExtractedComp = this.normalizeCompanyName(extraction.extractedCompanyName);
        const normUserComp = this.normalizeCompanyName(userCompanyName);
        const companyNameMatch = normExtractedComp !== '' &&
            normUserComp !== '' &&
            (normExtractedComp.includes(normUserComp) || normUserComp.includes(normExtractedComp));
        let verdict = 'NEEDS_REVIEW';
        let reason = '';
        const confidenceScore = extraction.confidenceScore ?? 0.8;
        if (extraction.isBlurryOrUnreadable) {
            verdict = 'NEEDS_REVIEW';
            reason = 'Document is blurry, illegible or low quality. Manual audit required.';
        }
        else if (!extraction.isValidST120Format) {
            verdict = 'MISMATCH';
            reason = 'Document is not a valid NY Form ST-120 (Resale Certificate).';
        }
        else if (!extraction.extractedTaxId || !taxIdMatch) {
            verdict = 'MISMATCH';
            reason = `Tax ID on document (${extraction.extractedTaxId || 'None'}) does not match registered user Tax ID (${userTaxId || 'None'}).`;
        }
        else if (!extraction.hasPhysicalSignature) {
            verdict = 'NEEDS_REVIEW';
            reason = 'Form ST-120 is missing required physical or authorized legal signature.';
        }
        else if (taxIdMatch && extraction.hasPhysicalSignature && extraction.isValidST120Format) {
            verdict = 'MATCH';
            reason = 'Valid Form ST-120 verified: Tax ID matches user records and authorized signature is present.';
        }
        else {
            verdict = 'NEEDS_REVIEW';
            reason = 'Partial match detected; requires administrator manual review.';
        }
        return {
            verdict,
            isValidST120Format: extraction.isValidST120Format,
            extractedTaxId: extraction.extractedTaxId,
            extractedCompanyName: extraction.extractedCompanyName,
            hasPhysicalSignature: extraction.hasPhysicalSignature,
            confidenceScore,
            reason,
            comparisonDetails: {
                taxIdMatch,
                companyNameMatch,
                userTaxId,
                userCompanyName,
            },
            notes: extraction.notes,
        };
    }
    async analyzeDocument(documentPath, user) {
        const resolvedPath = this.resolveFilePath(documentPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new common_1.NotFoundException(`ST-120 document file not found at path: ${documentPath}`);
        }
        const fileBuffer = fs.readFileSync(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
        const extraction = await this.callGeminiVisionApi(fileBuffer, mimeType);
        return this.compareExtractionWithUser(extraction, user);
    }
    async validateAndAssertST120(documentPath, user) {
        const result = await this.analyzeDocument(documentPath, user);
        if (result.verdict === 'MISMATCH') {
            throw new tax_exceptions_1.ValidationException(result.reason, result);
        }
        if (result.verdict === 'NEEDS_REVIEW') {
            throw new tax_exceptions_1.ValidationException(result.reason, result);
        }
        return result;
    }
};
exports.VisionValidationService = VisionValidationService;
exports.VisionValidationService = VisionValidationService = VisionValidationService_1 = __decorate([
    (0, common_1.Injectable)()
], VisionValidationService);
//# sourceMappingURL=vision-validation.service.js.map