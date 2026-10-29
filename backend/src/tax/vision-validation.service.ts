import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationException } from './tax.exceptions';

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

@Injectable()
export class VisionValidationService {
  private readonly logger = new Logger(VisionValidationService.name);

  /**
   * Normalizes Tax ID strings (removes hyphens, spaces, and forces uppercase)
   */
  normalizeTaxId(taxId?: string | null): string {
    if (!taxId) return '';
    return taxId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  /**
   * Normalizes business names for loose comparison
   */
  normalizeCompanyName(name?: string | null): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b(llc|inc|corp|co|ltd|bakery|shop|panaderia|panadería)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Resolves physical file path from relative or upload URL
   */
  resolveFilePath(documentPath: string): string {
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

  /**
   * Performs external inference using Google Gemini Flash Vision API
   */
  async callGeminiVisionApi(fileBuffer: Buffer, mimeType: string): Promise<ST120Extraction> {
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
    } catch (err: any) {
      this.logger.error(`Error during Gemini Vision execution: ${err.message}`);
      throw err;
    }
  }

  /**
   * Compares extracted document data with user business registration
   */
  compareExtractionWithUser(
    extraction: ST120Extraction,
    user: { tax_id?: string | null; company_name?: string | null },
  ): VisionValidationResult {
    const userTaxId = user.tax_id || null;
    const userCompanyName = user.company_name || null;

    const normExtractedTax = this.normalizeTaxId(extraction.extractedTaxId);
    const normUserTax = this.normalizeTaxId(userTaxId);

    const taxIdMatch = normExtractedTax !== '' && normUserTax !== '' && normExtractedTax === normUserTax;

    const normExtractedComp = this.normalizeCompanyName(extraction.extractedCompanyName);
    const normUserComp = this.normalizeCompanyName(userCompanyName);

    const companyNameMatch =
      normExtractedComp !== '' &&
      normUserComp !== '' &&
      (normExtractedComp.includes(normUserComp) || normUserComp.includes(normExtractedComp));

    let verdict: VisionVerdict = 'NEEDS_REVIEW';
    let reason = '';
    const confidenceScore = extraction.confidenceScore ?? 0.8;

    if (extraction.isBlurryOrUnreadable) {
      verdict = 'NEEDS_REVIEW';
      reason = 'Document is blurry, illegible or low quality. Manual audit required.';
    } else if (!extraction.isValidST120Format) {
      verdict = 'MISMATCH';
      reason = 'Document is not a valid NY Form ST-120 (Resale Certificate).';
    } else if (!extraction.extractedTaxId || !taxIdMatch) {
      verdict = 'MISMATCH';
      reason = `Tax ID on document (${extraction.extractedTaxId || 'None'}) does not match registered user Tax ID (${userTaxId || 'None'}).`;
    } else if (!extraction.hasPhysicalSignature) {
      verdict = 'NEEDS_REVIEW';
      reason = 'Form ST-120 is missing required physical or authorized legal signature.';
    } else if (taxIdMatch && extraction.hasPhysicalSignature && extraction.isValidST120Format) {
      verdict = 'MATCH';
      reason = 'Valid Form ST-120 verified: Tax ID matches user records and authorized signature is present.';
    } else {
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

  /**
   * Main entrypoint to analyze an ST-120 document from file path
   */
  async analyzeDocument(
    documentPath: string,
    user: { tax_id?: string | null; company_name?: string | null },
  ): Promise<VisionValidationResult> {
    const resolvedPath = this.resolveFilePath(documentPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException(`ST-120 document file not found at path: ${documentPath}`);
    }

    const fileBuffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

    const extraction = await this.callGeminiVisionApi(fileBuffer, mimeType);
    return this.compareExtractionWithUser(extraction, user);
  }

  /**
   * Validates document and throws ValidationException on sad paths (§6)
   */
  async validateAndAssertST120(
    documentPath: string,
    user: { tax_id?: string | null; company_name?: string | null },
  ): Promise<VisionValidationResult> {
    const result = await this.analyzeDocument(documentPath, user);

    if (result.verdict === 'MISMATCH') {
      throw new ValidationException(result.reason, result);
    }

    if (result.verdict === 'NEEDS_REVIEW') {
      throw new ValidationException(result.reason, result);
    }

    return result;
  }
}
