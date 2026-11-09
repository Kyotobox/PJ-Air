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
var FacadeVisionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacadeVisionService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
let FacadeVisionService = FacadeVisionService_1 = class FacadeVisionService {
    logger = new common_1.Logger(FacadeVisionService_1.name);
    async validateFacade(fileBuffer, mimeType) {
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new common_1.BadRequestException('El archivo de imagen es obligatorio para la validación.');
        }
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            this.logger.warn('[UNAVAILABLE_EXTERNAL_PROVIDER] Gemini API Key no configurada. Degradando a modo heurístico PENDING_AUDIT (§45).');
            return {
                isValid: true,
                category: 'STOREFRONT',
                confidence: 0.5,
                status: 'PENDING_AUDIT',
                reason: 'Verificación encolada para auditoría manual (Proveedor de IA no disponible)',
            };
        }
        try {
            const base64Data = fileBuffer.toString('base64');
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const prompt = `You are an expert visual AI auditor for commercial delivery addresses and B2B merchant verification.
Analyze the provided image and classify it into EXACTLY ONE of the following categories:
- STOREFRONT: Commercial building facade, store exterior entrance, storefront sign, display window, street-level entrance of a commercial establishment/business.
- FOOD_PRODUCT: Bread, pastries, baked goods, food items, plates of food, ingredients, trays/baskets of bread, restaurant meals (PAN, FACTURAS, BOLLERÍA, COMIDA).
- DOCUMENT: Invoices, receipts, tax certificates, utility bills, business licenses, letters, printed or handwritten documents, sheets of paper.
- SELFIE_PERSON: Close-up selfie, personal portrait, photo of people where a person is the main subject and not the exterior building facade.
- OTHER: Vehicles, cars, interior furniture, nature landscapes, animals, irrelevant or non-commercial images.

CRITICAL INSTRUCTIONS:
- You must strictly detect and REJECT food items (bread, pastries, etc.), documents, and personal selfies.
- If the image contains bread, pastries, dough, bakery food, or prepared meals, the category MUST be "FOOD_PRODUCT".

Return ONLY a valid JSON object matching this schema:
{
  "category": "STOREFRONT" | "FOOD_PRODUCT" | "DOCUMENT" | "SELFIE_PERSON" | "OTHER",
  "confidence": number, // between 0.0 and 1.0
  "description": string // short explanation in Spanish of what you detected
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
                                        mimeType: mimeType || 'image/jpeg',
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
            const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            const rawCategory = String(parsed.category || '').toUpperCase().trim();
            let category = 'OTHER';
            if (rawCategory === 'STOREFRONT') {
                category = 'STOREFRONT';
            }
            else if (rawCategory === 'FOOD_PRODUCT' || rawCategory.includes('FOOD') || rawCategory.includes('BREAD') || rawCategory.includes('PAN')) {
                category = 'FOOD_PRODUCT';
            }
            else if (rawCategory === 'DOCUMENT' || rawCategory.includes('DOC') || rawCategory.includes('INVOICE') || rawCategory.includes('BILL')) {
                category = 'DOCUMENT';
            }
            else if (rawCategory === 'SELFIE_PERSON' || rawCategory.includes('SELFIE') || rawCategory.includes('PERSON') || rawCategory.includes('PORTRAIT')) {
                category = 'SELFIE_PERSON';
            }
            else {
                category = 'OTHER';
            }
            switch (category) {
                case 'STOREFRONT':
                    return {
                        isValid: true,
                        category: 'STOREFRONT',
                        confidence: typeof parsed.confidence === 'number' && parsed.confidence > 0 ? parsed.confidence : 0.95,
                        status: 'VERIFIED',
                        reason: 'Fachada comercial verificada correctamente.',
                        description: parsed.description,
                    };
                case 'FOOD_PRODUCT':
                    return {
                        isValid: false,
                        category: 'FOOD_PRODUCT',
                        confidence: typeof parsed.confidence === 'number' && parsed.confidence > 0 ? parsed.confidence : 0.98,
                        status: 'REJECTED',
                        reason: 'Detectamos un producto alimenticio (pan/pastelería) en lugar de la fachada exterior de su local comercial.',
                        description: parsed.description,
                    };
                case 'DOCUMENT':
                    return {
                        isValid: false,
                        category: 'DOCUMENT',
                        confidence: typeof parsed.confidence === 'number' && parsed.confidence > 0 ? parsed.confidence : 0.95,
                        status: 'REJECTED',
                        reason: 'La imagen corresponde a un documento y no a la fachada del negocio.',
                        description: parsed.description,
                    };
                case 'SELFIE_PERSON':
                    return {
                        isValid: false,
                        category: 'SELFIE_PERSON',
                        confidence: typeof parsed.confidence === 'number' && parsed.confidence > 0 ? parsed.confidence : 0.95,
                        status: 'REJECTED',
                        reason: 'La imagen es un retrato personal. Por favor capture la fachada exterior.',
                        description: parsed.description,
                    };
                case 'OTHER':
                default:
                    return {
                        isValid: false,
                        category: 'OTHER',
                        confidence: typeof parsed.confidence === 'number' && parsed.confidence > 0 ? parsed.confidence : 0.90,
                        status: 'REJECTED',
                        reason: 'La imagen no muestra la fachada exterior de un establecimiento comercial.',
                        description: parsed.description,
                    };
            }
        }
        catch (err) {
            this.logger.warn(`[OFFLINE_FALLBACK] Falla de inferencia externa o partición de red (${err.message}). Degradando a modo heurístico PENDING_AUDIT (§45).`);
            return {
                isValid: true,
                category: 'STOREFRONT',
                confidence: 0.5,
                status: 'PENDING_AUDIT',
                reason: 'Verificación encolada para auditoría manual por contingencia de red',
            };
        }
    }
    resolveBufferFromUrlOrPath(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') {
            throw new common_1.BadRequestException('La ruta o URL de la imagen es requerida.');
        }
        if (imageUrl.startsWith('data:')) {
            const match = imageUrl.match(/^data:([^;]+);base64,(.*)$/);
            if (!match) {
                throw new common_1.BadRequestException('Formato DataURL no válido.');
            }
            return {
                buffer: Buffer.from(match[2], 'base64'),
                mimeType: match[1] || 'image/jpeg',
            };
        }
        let filePath = imageUrl;
        if (!fs.existsSync(filePath)) {
            const cleanPath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
            const candidates = [
                path.resolve(process.cwd(), cleanPath),
                path.resolve(process.cwd(), 'uploads', path.basename(imageUrl)),
                path.resolve(process.cwd(), 'uploads', 'addresses', path.basename(imageUrl)),
                path.resolve(config_1.UPLOAD_PATH, 'addresses', path.basename(imageUrl)),
                path.resolve(config_1.UPLOAD_PATH, path.basename(imageUrl)),
            ];
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    filePath = candidate;
                    break;
                }
            }
        }
        if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
            };
            return {
                buffer,
                mimeType: mimeMap[ext] || 'image/jpeg',
            };
        }
        throw new common_1.BadRequestException(`No se pudo resolver el archivo de imagen en la ruta: ${imageUrl}`);
    }
};
exports.FacadeVisionService = FacadeVisionService;
exports.FacadeVisionService = FacadeVisionService = FacadeVisionService_1 = __decorate([
    (0, common_1.Injectable)()
], FacadeVisionService);
//# sourceMappingURL=facade-vision.service.js.map