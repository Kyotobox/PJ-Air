"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const user_entity_1 = require("../users/user.entity");
const profile_entity_1 = require("../users/profile.entity");
const vision_validation_service_1 = require("./vision-validation.service");
exports.NYS_DTF_LEGEND_PREFIX = 'Exempt from NY State and Local Sales and Use Tax under NYS DTF Form ST-120 (Resale Certificate) - Purchases are exclusively for resale in the regular course of business.';
let TaxService = class TaxService {
    static { TaxService_1 = this; }
    userRepository;
    profileRepository;
    visionValidationService;
    logger = new common_1.Logger(TaxService_1.name);
    static NY_STANDARD_SALES_TAX_RATE = 8.875;
    constructor(userRepository, profileRepository, visionValidationService) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.visionValidationService = visionValidationService;
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
        const documentUrl = user.profile?.st120_document_url || user.st120_document_url;
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
};
exports.TaxService = TaxService;
exports.TaxService = TaxService = TaxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(profile_entity_1.Profile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        vision_validation_service_1.VisionValidationService])
], TaxService);
//# sourceMappingURL=tax.service.js.map