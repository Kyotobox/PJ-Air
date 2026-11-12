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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TaxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxService = exports.NYS_DTF_LEGEND_PREFIX = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
const user_entity_1 = require("../users/user.entity");
const profile_entity_1 = require("../users/profile.entity");
const vision_validation_service_1 = require("./vision-validation.service");
const st120_generator_service_1 = require("./st120-generator.service");
exports.NYS_DTF_LEGEND_PREFIX = 'Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business.';
let TaxService = class TaxService {
    static { TaxService_1 = this; }
    userRepository;
    profileRepository;
    visionValidationService;
    st120GeneratorService;
    logger = new common_1.Logger(TaxService_1.name);
    static NY_STANDARD_SALES_TAX_RATE = 8.875;
    constructor(userRepository, profileRepository, visionValidationService, st120GeneratorService) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.visionValidationService = visionValidationService;
        this.st120GeneratorService = st120GeneratorService;
    }
    getGenerator() {
        return this.st120GeneratorService || new st120_generator_service_1.St120GeneratorService();
    }
    getOfficialNysDtfLegend(taxId) {
        const cleanTaxId = taxId ? taxId.trim() : 'N/A';
        return `${exports.NYS_DTF_LEGEND_PREFIX} NY Resale / Tax ID: ${cleanTaxId}`;
    }
    calculateOrderTax(user, subtotal) {
        const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
        const taxId = user?.tax_id || user?.profile?.tax_id || null;
        if (isExempt) {
            return {
                tax_amount: 0.0,
                tax_rate: 0.0,
                tax_exempt: true,
                tax_legend: this.getOfficialNysDtfLegend(taxId),
            };
        }
        const standardRate = TaxService_1.NY_STANDARD_SALES_TAX_RATE;
        const calculatedAmount = Math.round(((Number(subtotal) || 0) * (standardRate / 100) + Number.EPSILON) * 100) / 100;
        return {
            tax_amount: calculatedAmount,
            tax_rate: standardRate,
            tax_exempt: false,
            tax_legend: null,
        };
    }
    async auditUserST120(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userId} not found`);
        }
        const documentUrl = user.st120_pdf_url || user.profile?.st120_document_url || user.st120_document_url;
        if (!documentUrl) {
            throw new common_1.NotFoundException(`User ${userId} does not have an uploaded ST-120 document`);
        }
        const taxId = user.profile?.tax_id || user.tax_id || '';
        const companyName = user.profile?.company_name || '';
        const result = await this.visionValidationService.analyzeDocument(documentUrl, {
            tax_id: taxId,
            company_name: companyName,
        });
        this.logger.log(`Audit ST-120 completed for user ${userId}. Verdict: ${result.verdict}`);
        return result;
    }
    async approveExemption(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.userRepository.update(userId, {
            st120_status: 'APPROVED',
            tax_exempt: true,
        });
        if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
                st120_status: 'APPROVED',
                tax_exempt: true,
            });
        }
        const updatedUser = (await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        }));
        this.logger.log(`ST-120 approved for user ${userId}. tax_exempt set to true.`);
        return { success: true, user: updatedUser };
    }
    async rejectExemption(userId, reason) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.userRepository.update(userId, {
            st120_status: 'REJECTED',
            tax_exempt: false,
        });
        if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
                st120_status: 'REJECTED',
                tax_exempt: false,
            });
        }
        const updatedUser = (await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        }));
        this.logger.warn(`ST-120 rejected for user ${userId}. Reason: ${reason || 'Audit rejection'}`);
        return { success: true, user: updatedUser };
    }
    async generateDigitalST120(userId, requestingUser, dto) {
        if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
            throw new common_1.ForbiddenException('Cannot generate ST-120 for another user');
        }
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile', 'addresses'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userId} not found`);
        }
        const legalBusinessName = (dto?.legal_business_name && dto.legal_business_name.trim()) ||
            (dto?.legalBusinessName && dto.legalBusinessName.trim()) ||
            (user.legal_business_name && user.legal_business_name.trim()) ||
            (user.profile?.company_name && user.profile.company_name.trim());
        if (!legalBusinessName) {
            throw new common_1.BadRequestException('Razón Social (Legal Business Name) es requerida para el Formulario ST-120');
        }
        const ein = (dto?.ein && dto.ein.trim()) ||
            (user.ein && user.ein.trim()) ||
            (dto?.tax_id && dto.tax_id.trim()) ||
            (dto?.taxId && dto.taxId.trim()) ||
            (user.tax_id && user.tax_id.trim()) ||
            (user.profile?.tax_id && user.profile.tax_id.trim());
        if (!ein) {
            throw new common_1.BadRequestException('Federal EIN / Tax ID es requerido para el Formulario ST-120');
        }
        const signerName = (dto?.signer_name && dto.signer_name.trim()) ||
            (dto?.signerName && dto.signerName.trim()) ||
            (user.signer_name && user.signer_name.trim()) ||
            (user.profile?.full_name && user.profile.full_name.trim());
        if (!signerName) {
            throw new common_1.BadRequestException('Nombre del firmante es requerido para el Formulario ST-120');
        }
        const signerTitle = (dto?.signer_title && dto.signer_title.trim()) ||
            (dto?.signerTitle && dto.signerTitle.trim()) ||
            user.signer_title ||
            'Authorized Representative';
        const signatureText = (dto?.signature_text && dto.signature_text.trim()) ||
            (dto?.signatureText && dto.signatureText.trim()) ||
            user.signature_text ||
            signerName;
        const dba = dto?.dba !== undefined
            ? (dto.dba ? dto.dba.trim() : null)
            : (user.dba || user.profile?.company_name || null);
        const businessAddress = (dto?.business_address && dto.business_address.trim()) ||
            (dto?.businessAddress && dto.businessAddress.trim()) ||
            user.business_address ||
            (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');
        const taxId = (dto?.tax_id && dto.tax_id.trim()) ||
            (dto?.taxId && dto.taxId.trim()) ||
            user.tax_id ||
            user.profile?.tax_id ||
            ein;
        const acceptedAt = user.accepted_at || new Date();
        const ipAddress = user.ip_address || '127.0.0.1';
        const generator = this.getGenerator();
        const pdfData = {
            userId: user.id,
            legalBusinessName,
            dba,
            businessAddress,
            taxId,
            ein,
            signerName,
            signerTitle,
            signatureText,
            acceptedAt,
            ipAddress,
        };
        const pdfResult = generator.generateDigitalSt120Pdf
            ? await generator.generateDigitalSt120Pdf(pdfData)
            : await generator.generateST120Pdf(pdfData);
        await this.userRepository.update(userId, {
            st120_status: 'APPROVED',
            tax_exempt: true,
            st120_document_url: pdfResult.relativeUrl,
            st120_pdf_url: pdfResult.relativeUrl,
            legal_business_name: legalBusinessName,
            ein,
            tax_id: taxId,
            signer_name: signerName,
            signer_title: signerTitle,
            signature_text: signatureText,
            dba,
            business_address: businessAddress,
            accepted_at: acceptedAt,
        });
        if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
                st120_status: 'APPROVED',
                tax_exempt: true,
                st120_document_url: pdfResult.relativeUrl,
                ...(taxId ? { tax_id: taxId } : {}),
                company_name: legalBusinessName,
            });
        }
        const updatedUser = (await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile', 'addresses'],
        }));
        this.logger.log(`Digital ST-120 generated and approved for user ${userId}. URL: ${pdfResult.relativeUrl}`);
        return {
            success: true,
            documentUrl: pdfResult.relativeUrl,
            st120_pdf_url: pdfResult.relativeUrl,
            auditHash: pdfResult.auditHash,
            user: updatedUser,
        };
    }
    async signST120(userId, signData, clientIp, requestingUser) {
        if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
            throw new common_1.ForbiddenException('Cannot sign ST-120 for another user');
        }
        if (!signData?.signature_text || !signData.signature_text.trim()) {
            throw new common_1.BadRequestException('El campo signature_text es obligatorio para la firma digital del ST-120');
        }
        if (!signData?.signer_name || !signData.signer_name.trim()) {
            throw new common_1.BadRequestException('El campo signer_name es obligatorio para la firma digital del ST-120');
        }
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile', 'addresses'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userId} not found`);
        }
        const now = new Date();
        const effectiveIp = clientIp || user.ip_address || '127.0.0.1';
        const legalName = (signData.legal_business_name && signData.legal_business_name.trim()) ||
            user.legal_business_name ||
            user.profile?.company_name ||
            user.email;
        const dba = signData.dba !== undefined ? (signData.dba ? signData.dba.trim() : null) : (user.dba || null);
        const bAddress = (signData.business_address && signData.business_address.trim()) ||
            user.business_address ||
            (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');
        const taxId = (signData.tax_id && signData.tax_id.trim()) ||
            user.tax_id ||
            user.profile?.tax_id ||
            user.ein ||
            'PENDING';
        const ein = (signData.ein && signData.ein.trim()) || user.ein || taxId;
        const signerName = signData.signer_name.trim();
        const signerTitle = (signData.signer_title && signData.signer_title.trim()) ||
            user.signer_title ||
            'Authorized Representative';
        const signatureText = signData.signature_text.trim();
        const generator = this.getGenerator();
        const pdfData = {
            userId: user.id,
            legalBusinessName: legalName,
            dba,
            businessAddress: bAddress,
            taxId,
            ein,
            signerName,
            signerTitle,
            signatureText,
            acceptedAt: now,
            ipAddress: effectiveIp,
        };
        const pdfResult = generator.generateDigitalSt120Pdf
            ? await generator.generateDigitalSt120Pdf(pdfData)
            : await generator.generateST120Pdf(pdfData);
        await this.userRepository.update(userId, {
            legal_business_name: legalName,
            dba,
            business_address: bAddress,
            tax_id: taxId,
            ein,
            signer_name: signerName,
            signer_title: signerTitle,
            signature_text: signatureText,
            accepted_at: now,
            ip_address: effectiveIp,
            st120_status: 'APPROVED',
            tax_exempt: true,
            st120_document_url: pdfResult.relativeUrl,
            st120_pdf_url: pdfResult.relativeUrl,
        });
        if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
                st120_status: 'APPROVED',
                tax_exempt: true,
                st120_document_url: pdfResult.relativeUrl,
                ...(taxId ? { tax_id: taxId } : {}),
                company_name: legalName,
            });
        }
        const updatedUser = (await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile', 'addresses'],
        }));
        this.logger.log(`ST-120 digitally signed and approved for user ${userId}. URL: ${pdfResult.relativeUrl}`);
        return {
            success: true,
            documentUrl: pdfResult.relativeUrl,
            st120_pdf_url: pdfResult.relativeUrl,
            user: updatedUser,
        };
    }
    async uploadST120(userId, file, taxId, requestingUser, status) {
        if (requestingUser && requestingUser.role !== 'admin' && requestingUser.id !== userId) {
            throw new common_1.ForbiddenException('Cannot upload ST-120 for another user');
        }
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded or file type not allowed');
        }
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userId} not found`);
        }
        const relativeUrl = `/uploads/st120/${file.filename}`;
        const cleanTaxId = taxId && taxId.trim() ? taxId.trim() : undefined;
        const targetStatus = status && status.toUpperCase() === 'APPROVED' ? 'APPROVED' : 'PENDING';
        const isExempt = targetStatus === 'APPROVED';
        await this.userRepository.update(userId, {
            st120_document_url: relativeUrl,
            st120_pdf_url: relativeUrl,
            st120_status: targetStatus,
            ...(isExempt ? { tax_exempt: true } : {}),
            ...(cleanTaxId ? { tax_id: cleanTaxId } : {}),
        });
        if (user.profile) {
            await this.profileRepository.update(user.profile.id, {
                st120_document_url: relativeUrl,
                st120_status: targetStatus,
                ...(isExempt ? { tax_exempt: true } : {}),
                ...(cleanTaxId ? { tax_id: cleanTaxId } : {}),
            });
        }
        const updatedUser = (await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        }));
        this.logger.log(`ST-120 document uploaded for user ${userId}: ${relativeUrl} (${targetStatus})`);
        return {
            success: true,
            url: relativeUrl,
            documentUrl: relativeUrl,
            st120_pdf_url: relativeUrl,
            user: updatedUser,
        };
    }
    async getSt120Pdf(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userId} not found`);
        }
        const documentUrl = user.st120_pdf_url ||
            user.st120_document_url ||
            user.profile?.st120_document_url;
        if (!documentUrl) {
            throw new common_1.NotFoundException(`User ${userId} does not have an ST-120 document on file`);
        }
        const cleanRelative = documentUrl.replace(/^\/uploads\/?/, '');
        const filePath = path.join(path.resolve(config_1.UPLOAD_PATH), cleanRelative);
        if (!fs.existsSync(filePath)) {
            throw new common_1.NotFoundException(`ST-120 physical file not found on disk at: ${cleanRelative}`);
        }
        const buffer = fs.readFileSync(filePath);
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
        return {
            filePath,
            buffer,
            filename,
            mimeType,
        };
    }
    async backfillAllPending() {
        const pendingUsers = await this.userRepository.find({
            where: [{ st120_status: 'PENDING' }],
            relations: ['profile', 'addresses'],
        });
        let processedCount = 0;
        const errors = [];
        const generator = this.getGenerator();
        for (const user of pendingUsers) {
            try {
                const legalBusinessName = (user.legal_business_name && user.legal_business_name.trim()) ||
                    (user.profile?.company_name && user.profile.company_name.trim()) ||
                    user.email;
                const taxId = user.tax_id || user.profile?.tax_id || user.ein;
                if (legalBusinessName || taxId || user.signature_text) {
                    const dba = user.dba || user.profile?.company_name || null;
                    const businessAddress = user.business_address ||
                        (user.addresses && user.addresses.length > 0 ? user.addresses[0].address : 'Address on file');
                    const signerName = user.signer_name || user.profile?.full_name || user.email;
                    const signerTitle = user.signer_title || 'Authorized Representative';
                    const signatureText = user.signature_text || user.signer_name || user.profile?.full_name || 'Digitally Certified';
                    const acceptedAt = user.accepted_at || new Date();
                    const ipAddress = user.ip_address || '127.0.0.1';
                    const pdfResult = await generator.generateST120Pdf({
                        userId: user.id,
                        legalBusinessName,
                        dba,
                        businessAddress,
                        taxId: taxId || 'PENDING',
                        ein: user.ein || null,
                        signerName,
                        signerTitle,
                        signatureText,
                        acceptedAt,
                        ipAddress,
                    });
                    await this.userRepository.update(user.id, {
                        st120_status: 'APPROVED',
                        tax_exempt: true,
                        st120_document_url: pdfResult.relativeUrl,
                        st120_pdf_url: pdfResult.relativeUrl,
                        ...(user.signature_text ? {} : { signature_text: signatureText }),
                        ...(user.signer_name ? {} : { signer_name: signerName }),
                    });
                    if (user.profile) {
                        await this.profileRepository.update(user.profile.id, {
                            st120_status: 'APPROVED',
                            tax_exempt: true,
                            st120_document_url: pdfResult.relativeUrl,
                        });
                    }
                    processedCount++;
                }
            }
            catch (err) {
                this.logger.error(`Failed backfill for user ${user.id}: ${err.message}`);
                errors.push({ userId: user.id, error: err.message });
            }
        }
        this.logger.log(`Backfill completed: ${processedCount}/${pendingUsers.length} users processed.`);
        return {
            success: true,
            processedCount,
            totalPending: pendingUsers.length,
            errors,
        };
    }
};
exports.TaxService = TaxService;
exports.TaxService = TaxService = TaxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(profile_entity_1.Profile)),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        vision_validation_service_1.VisionValidationService,
        st120_generator_service_1.St120GeneratorService])
], TaxService);
//# sourceMappingURL=tax.service.js.map