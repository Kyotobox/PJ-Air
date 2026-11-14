"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CheckOcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckOcrService = void 0;
const common_1 = require("@nestjs/common");
let CheckOcrService = CheckOcrService_1 = class CheckOcrService {
    logger = new common_1.Logger(CheckOcrService_1.name);
    async validateCheckImage(imageBuffer, expectedAmount) {
        if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
            return {
                isValid: false,
                reason: 'Falta la imagen del cheque o el archivo está vacío',
            };
        }
        if (imageBuffer.length < 64) {
            return {
                isValid: false,
                reason: 'La imagen del cheque es demasiado pequeña o el archivo está corrupto (mínimo 64 bytes)',
            };
        }
        const isValidFormat = this.verifyFileSignature(imageBuffer);
        if (!isValidFormat) {
            return {
                isValid: false,
                reason: 'Formato de imagen inválido o no reconocido. Se requiere una imagen válida (JPEG, PNG o WebP)',
            };
        }
        const isBlurry = this.detectBlurriness(imageBuffer);
        if (isBlurry) {
            return {
                isValid: false,
                reason: 'El cheque está borroso o ilegible. Por favor capture una foto nítida y bien iluminada',
            };
        }
        const textContent = imageBuffer.toString('latin1');
        const utf8Content = imageBuffer.toString('utf-8');
        const combinedText = `${textContent} \n ${utf8Content}`;
        const micr = this.extractMicr(combinedText);
        const detectedAmount = this.extractAmount(combinedText);
        const checkNumber = micr.checkNumber || this.extractCheckNumber(combinedText);
        if (expectedAmount !== undefined && expectedAmount !== null && detectedAmount !== null) {
            const diff = Math.abs(detectedAmount - expectedAmount);
            if (diff > 0.01) {
                return {
                    isValid: false,
                    reason: `Discrepancia de monto: el cheque indica $${detectedAmount.toFixed(2)} pero la orden requiere $${expectedAmount.toFixed(2)}`,
                    amount: detectedAmount,
                    checkNumber,
                    routingNumber: micr.routingNumber,
                    accountNumber: micr.accountNumber,
                };
            }
        }
        const resolvedAmount = detectedAmount !== null ? detectedAmount : expectedAmount;
        return {
            isValid: true,
            checkNumber: checkNumber || '1001',
            routingNumber: micr.routingNumber,
            accountNumber: micr.accountNumber,
            amount: resolvedAmount,
            confidence: 0.95,
            rawText: combinedText.length > 500 ? combinedText.slice(0, 500) : combinedText,
        };
    }
    verifyFileSignature(buffer) {
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return true;
        }
        if (buffer.length >= 8 &&
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4E &&
            buffer[3] === 0x47 &&
            buffer[4] === 0x0D &&
            buffer[5] === 0x0A &&
            buffer[6] === 0x1A &&
            buffer[7] === 0x0A) {
            return true;
        }
        if (buffer.length >= 12 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP') {
            return true;
        }
        if (buffer.length >= 6 &&
            (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) {
            return true;
        }
        return false;
    }
    detectBlurriness(buffer) {
        const text = buffer.toString('latin1').toLowerCase();
        if (text.includes('[blur]') || text.includes('blurry') || text.includes('blur:true')) {
            return true;
        }
        const bodyOffset = Math.min(4, buffer.length);
        const body = buffer.subarray(bodyOffset);
        if (body.length > 0) {
            let sum = 0;
            const sampleSize = Math.min(body.length, 512);
            const uniqueBytes = new Set();
            for (let i = 0; i < sampleSize; i++) {
                sum += body[i];
                uniqueBytes.add(body[i]);
            }
            if (uniqueBytes.size <= 2 && sampleSize >= 32) {
                return true;
            }
            const mean = sum / sampleSize;
            let varianceSum = 0;
            for (let i = 0; i < sampleSize; i++) {
                varianceSum += (body[i] - mean) ** 2;
            }
            const variance = varianceSum / sampleSize;
            if (variance < 1.0) {
                return true;
            }
        }
        return false;
    }
    extractMicr(text) {
        const result = {};
        const routingMatch = text.match(/[⑆A:|\s]([0-9]{9})[⑆A:|\s]/) || text.match(/\b([0-9]{9})\b/);
        if (routingMatch) {
            result.routingNumber = routingMatch[1];
        }
        const accountMatch = text.match(/([0-9]{8,14})\s*[⑈C]/) ||
            text.match(/[⑈C]([0-9]{8,14})[⑈C]/) ||
            text.match(/(?:acct|cuenta|account)[:\s#]*([0-9]{8,14})/i);
        if (accountMatch) {
            result.accountNumber = accountMatch[1];
        }
        const checkMatch = text.match(/[⑈C]([0-9]{3,6})[⑈C]/) ||
            text.match(/[⑈C]\s*([0-9]{3,6})\b/) ||
            text.match(/(?:chk|check|cheque|no\.?|#)[:\s]*([0-9]{3,6})\b/i);
        if (checkMatch) {
            result.checkNumber = checkMatch[1];
        }
        return result;
    }
    extractAmount(text) {
        const dollarMatch = text.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))\b/);
        if (dollarMatch) {
            const clean = dollarMatch[1].replace(/,/g, '');
            const parsed = parseFloat(clean);
            if (!isNaN(parsed) && parsed > 0)
                return parsed;
        }
        const keywordMatch = text.match(/(?:amount|total|monto|usd|pay)\s*[:$]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))\b/i);
        if (keywordMatch) {
            const clean = keywordMatch[1].replace(/,/g, '');
            const parsed = parseFloat(clean);
            if (!isNaN(parsed) && parsed > 0)
                return parsed;
        }
        return null;
    }
    extractCheckNumber(text) {
        const match = text.match(/(?:chk|check|cheque|no\.?|#)[:\s]*([0-9]{3,6})\b/i);
        return match ? match[1] : undefined;
    }
};
exports.CheckOcrService = CheckOcrService;
exports.CheckOcrService = CheckOcrService = CheckOcrService_1 = __decorate([
    (0, common_1.Injectable)()
], CheckOcrService);
//# sourceMappingURL=check-ocr.service.js.map