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
var St120GeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.St120GeneratorService = exports.OFFICIAL_VENDOR_ADDRESS = exports.OFFICIAL_VENDOR_NAME = void 0;
const common_1 = require("@nestjs/common");
const pdf_lib_1 = require("pdf-lib");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const config_1 = require("../config");
exports.OFFICIAL_VENDOR_NAME = 'Jhoanes Bakery & Coffee LLC';
exports.OFFICIAL_VENDOR_ADDRESS = '33-04 Broadway, Astoria, NY 11106';
let St120GeneratorService = St120GeneratorService_1 = class St120GeneratorService {
    logger = new common_1.Logger(St120GeneratorService_1.name);
    async generateST120Pdf(data) {
        const doc = await pdf_lib_1.PDFDocument.create();
        const page = doc.addPage([612, 792]);
        const fontRegular = await doc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
        const fontBold = await doc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
        const fontOblique = await doc.embedFont(pdf_lib_1.StandardFonts.HelveticaOblique);
        const vendorName = data.vendorName || exports.OFFICIAL_VENDOR_NAME;
        const vendorAddress = data.vendorAddress || exports.OFFICIAL_VENDOR_ADDRESS;
        const acceptedDate = data.acceptedAt ? new Date(data.acceptedAt) : new Date();
        const isoTimestamp = acceptedDate.toISOString();
        const ip = (data.ipAddress && data.ipAddress.trim()) || '127.0.0.1';
        const auditPayload = [
            data.legalBusinessName || '',
            data.taxId || data.ein || '',
            data.signerName || '',
            data.signatureText || '',
            isoTimestamp,
            ip,
        ].join('|');
        const auditHash = crypto.createHash('sha256').update(auditPayload).digest('hex');
        const primaryColor = (0, pdf_lib_1.rgb)(0.08, 0.22, 0.42);
        const charcoal = (0, pdf_lib_1.rgb)(0.15, 0.15, 0.15);
        const borderGray = (0, pdf_lib_1.rgb)(0.75, 0.78, 0.82);
        const bgLight = (0, pdf_lib_1.rgb)(0.96, 0.97, 0.98);
        const white = (0, pdf_lib_1.rgb)(1, 1, 1);
        const alertGreen = (0, pdf_lib_1.rgb)(0.05, 0.5, 0.2);
        let y = 750;
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
            color: (0, pdf_lib_1.rgb)(0.85, 0.9, 0.98),
        });
        y -= 75;
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
        page.drawLine({
            start: { x: 36, y: 55 },
            end: { x: 576, y: 55 },
            thickness: 1,
            color: borderGray,
        });
        page.drawText('Form ST-120 (Resale Certificate) • Jhoanes Bakery Platform Digital Certification System • Valid in New York State', {
            x: 48,
            y: 42,
            size: 7.5,
            font: fontRegular,
            color: (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4),
        });
        const pdfBytes = await doc.save();
        const buffer = Buffer.from(pdfBytes);
        const st120Dir = path.join(path.resolve(config_1.UPLOAD_PATH), 'st120');
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
    drawSectionHeader(page, x, y, width, title, fontBold, primaryColor) {
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
            color: (0, pdf_lib_1.rgb)(1, 1, 1),
        });
    }
};
exports.St120GeneratorService = St120GeneratorService;
exports.St120GeneratorService = St120GeneratorService = St120GeneratorService_1 = __decorate([
    (0, common_1.Injectable)()
], St120GeneratorService);
//# sourceMappingURL=st120-generator.service.js.map