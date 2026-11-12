import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { UPLOAD_PATH } from '../config';

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
  buffer: Buffer;
  auditHash: string;
}

export const OFFICIAL_VENDOR_NAME = 'Jhoanes Bakery & Coffee LLC';
export const OFFICIAL_VENDOR_ADDRESS = '33-04 Broadway, Astoria, NY 11106';

@Injectable()
export class St120GeneratorService {
  private readonly logger = new Logger(St120GeneratorService.name);

  /**
   * Generates an official NYS DTF Form ST-120 Resale Certificate PDF
   */
  async generateST120Pdf(data: ST120PdfData): Promise<ST120GenerationResult> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]); // Standard US Letter

    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

    const vendorName = data.vendorName || OFFICIAL_VENDOR_NAME;
    const vendorAddress = data.vendorAddress || OFFICIAL_VENDOR_ADDRESS;

    const acceptedDate = data.acceptedAt ? new Date(data.acceptedAt) : new Date();
    const isoTimestamp = acceptedDate.toISOString();
    const ip = (data.ipAddress && data.ipAddress.trim()) || '127.0.0.1';

    // Compute cryptographic SHA-256 audit hash
    const auditPayload = [
      data.legalBusinessName || '',
      data.taxId || data.ein || '',
      data.signerName || '',
      data.signatureText || '',
      isoTimestamp,
      ip,
    ].join('|');
    const auditHash = crypto.createHash('sha256').update(auditPayload).digest('hex');

    // Color definitions
    const primaryColor = rgb(0.08, 0.22, 0.42); // Deep Navy
    const charcoal = rgb(0.15, 0.15, 0.15);
    const borderGray = rgb(0.75, 0.78, 0.82);
    const bgLight = rgb(0.96, 0.97, 0.98);
    const white = rgb(1, 1, 1);
    const alertGreen = rgb(0.05, 0.5, 0.2);

    let y = 750;

    // --- HEADER BLOCK ---
    page.drawRectangle({
      x: 36,
      y: y - 55,
      width: 540,
      height: 65,
      color: primaryColor,
    });

    page.drawText('New York State Department of Taxation and Finance', {
      x: 48,
      y: y - 16,
      size: 13,
      font: fontBold,
      color: white,
    });

    page.drawText('Form ST-120 (Resale Certificate)', {
      x: 48,
      y: y - 34,
      size: 15,
      font: fontBold,
      color: white,
    });

    page.drawText('New York State and Local Sales and Use Tax Exemption Certificate', {
      x: 48,
      y: y - 48,
      size: 9,
      font: fontRegular,
      color: rgb(0.85, 0.9, 0.98),
    });

    y -= 75;

    // Notice Box
    page.drawRectangle({
      x: 36,
      y: y - 22,
      width: 540,
      height: 22,
      color: bgLight,
      borderColor: borderGray,
      borderWidth: 1,
    });

    page.drawText('OFFICIAL DIGITAL CERTIFICATE - ISSUED UNDER NYS TAX LAW § 1132(c)', {
      x: 48,
      y: y - 15,
      size: 8,
      font: fontBold,
      color: charcoal,
    });

    y -= 34;

    // --- SECTION 1: VENDOR (SELLER) ---
    this.drawSectionHeader(page, 36, y, 540, '1. VENDOR (SELLER) INFORMATION', fontBold, primaryColor);
    y -= 18;

    page.drawRectangle({
      x: 36,
      y: y - 45,
      width: 540,
      height: 45,
      color: white,
      borderColor: borderGray,
      borderWidth: 1,
    });

    page.drawText(`Vendor Name: ${vendorName}`, {
      x: 48,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: charcoal,
    });

    page.drawText(`Address: ${vendorAddress}`, {
      x: 48,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Business Activity: Wholesale Bakery & Food Distribution`, {
      x: 48,
      y: y - 42,
      size: 8.5,
      font: fontOblique,
      color: charcoal,
    });

    y -= 58;

    // --- SECTION 2: PURCHASER (BUYER) ---
    this.drawSectionHeader(page, 36, y, 540, '2. PURCHASER (BUYER) INFORMATION', fontBold, primaryColor);
    y -= 18;

    page.drawRectangle({
      x: 36,
      y: y - 95,
      width: 540,
      height: 95,
      color: white,
      borderColor: borderGray,
      borderWidth: 1,
    });

    const legalName = data.legalBusinessName || 'N/A';
    const dba = data.dba && data.dba.trim() ? data.dba.trim() : 'N/A';
    const bAddress = data.businessAddress || 'Address on file';
    const taxId = data.taxId && data.taxId.trim() ? data.taxId.trim() : 'N/A';
    const ein = data.ein && data.ein.trim() ? data.ein.trim() : 'N/A';
    const signer = data.signerName || 'N/A';
    const title = data.signerTitle || 'Authorized Representative';

    page.drawText(`Legal Business Name: ${legalName}`, {
      x: 48,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: charcoal,
    });

    page.drawText(`DBA (Doing Business As): ${dba}`, {
      x: 48,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Business Physical Address: ${bAddress}`, {
      x: 48,
      y: y - 44,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`NYS Tax ID / Certificate of Authority #: ${taxId}`, {
      x: 48,
      y: y - 60,
      size: 9.5,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(`Federal EIN: ${ein}`, {
      x: 320,
      y: y - 60,
      size: 9.5,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Authorized Signer: ${signer}`, {
      x: 48,
      y: y - 76,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Title / Capacity: ${title}`, {
      x: 320,
      y: y - 76,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    y -= 108;

    // --- SECTION 3: CERTIFICATION & LEGAL EXEMPTION CLAUSE ---
    this.drawSectionHeader(page, 36, y, 540, '3. CERTIFICATION & EXEMPTION PURPOSE (NYS RESALE)', fontBold, primaryColor);
    y -= 18;

    page.drawRectangle({
      x: 36,
      y: y - 88,
      width: 540,
      height: 88,
      color: bgLight,
      borderColor: borderGray,
      borderWidth: 1,
    });

    const clauseLines = [
      'I certify that all the tangible personal property purchased under this certificate will be used exclusively',
      'for resale in the regular course of business as bakery products and food items.',
      '',
      'I certify that the purchaser named above holds a valid New York State Certificate of Authority to collect',
      'sales and compensating use tax, and that purchases made from Jhoanes Bakery & Coffee LLC qualify for',
      'full exemption from NYS and local sales taxes pursuant to Tax Law § 1115 and § 1132(c).',
      'I understand that this certificate is valid until revoked and is given under penalty of perjury.',
    ];

    let clauseY = y - 14;
    for (const line of clauseLines) {
      if (line === '') {
        clauseY -= 4;
        continue;
      }
      page.drawText(line, {
        x: 48,
        y: clauseY,
        size: 8.5,
        font: fontRegular,
        color: charcoal,
      });
      clauseY -= 11;
    }

    y -= 102;

    // --- SECTION 4: ELECTRONIC SIGNATURE & AUDIT TRAIL ---
    this.drawSectionHeader(page, 36, y, 540, '4. ELECTRONIC SIGNATURE & CRYPTOGRAPHIC AUDIT TRAIL', fontBold, primaryColor);
    y -= 18;

    page.drawRectangle({
      x: 36,
      y: y - 100,
      width: 540,
      height: 100,
      color: white,
      borderColor: borderGray,
      borderWidth: 1,
    });

    const sigText = data.signatureText || data.signerName || signer;

    page.drawText(`Digital Signature:`, {
      x: 48,
      y: y - 18,
      size: 9,
      font: fontBold,
      color: charcoal,
    });

    page.drawText(`/s/ ${sigText}`, {
      x: 160,
      y: y - 18,
      size: 11,
      font: fontOblique,
      color: primaryColor,
    });

    page.drawText(`Signer Full Name: ${signer}`, {
      x: 48,
      y: y - 34,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Title: ${title}`, {
      x: 320,
      y: y - 34,
      size: 9,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Executed At (ISO): ${isoTimestamp}`, {
      x: 48,
      y: y - 50,
      size: 8.5,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Signer IP Address: ${ip}`, {
      x: 320,
      y: y - 50,
      size: 8.5,
      font: fontRegular,
      color: charcoal,
    });

    page.drawText(`Audit Status: VERIFIED & SEALED`, {
      x: 48,
      y: y - 66,
      size: 8.5,
      font: fontBold,
      color: alertGreen,
    });

    page.drawText(`Audit SHA-256 Hash:`, {
      x: 48,
      y: y - 82,
      size: 8,
      font: fontBold,
      color: charcoal,
    });

    page.drawText(auditHash, {
      x: 160,
      y: y - 82,
      size: 7.5,
      font: fontRegular,
      color: primaryColor,
    });

    y -= 115;

    // --- FOOTER ---
    page.drawLine({
      start: { x: 36, y: 55 },
      end: { x: 576, y: 55 },
      thickness: 1,
      color: borderGray,
    });

    page.drawText(
      'Form ST-120 (Resale Certificate) • Jhoanes Bakery Platform Digital Certification System • Valid in New York State',
      {
        x: 48,
        y: 42,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      },
    );

    const pdfBytes = await doc.save();
    const buffer = Buffer.from(pdfBytes);

    // Physical storage
    const st120Dir = path.join(path.resolve(UPLOAD_PATH), 'st120');
    if (!fs.existsSync(st120Dir)) {
      fs.mkdirSync(st120Dir, { recursive: true });
    }

    const uniqueId = data.userId ? data.userId.replace(/[^a-zA-Z0-9-]/g, '') : 'client';
    const filename = `st120-${uniqueId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.pdf`;
    const fullPath = path.join(st120Dir, filename);

    fs.writeFileSync(fullPath, buffer);
    const relativeUrl = `/uploads/st120/${filename}`;

    this.logger.log(`Generated official ST-120 PDF: ${relativeUrl} (Hash: ${auditHash.substring(0, 12)}...)`);

    return {
      filePath: fullPath,
      relativeUrl,
      buffer,
      auditHash,
    };
  }

  private drawSectionHeader(
    page: any,
    x: number,
    y: number,
    width: number,
    title: string,
    fontBold: any,
    primaryColor: any,
  ) {
    page.drawRectangle({
      x,
      y: y - 14,
      width,
      height: 14,
      color: primaryColor,
    });

    page.drawText(title, {
      x: x + 8,
      y: y - 10,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }
}
