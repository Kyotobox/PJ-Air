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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const config_1 = require("../config");
const tax_service_1 = require("./tax.service");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let TaxController = class TaxController {
    taxService;
    constructor(taxService) {
        this.taxService = taxService;
    }
    async validateST120(userId) {
        return this.taxService.auditUserST120(userId);
    }
    async approveExemption(userId) {
        return this.taxService.approveExemption(userId);
    }
    async rejectExemption(userId, reason) {
        return this.taxService.rejectExemption(userId, reason);
    }
    async getStatus(userId) {
        const user = await this.taxService['userRepository'].findOne({
            where: { id: userId },
            relations: ['profile'],
        });
        const isExempt = Boolean(user?.tax_exempt || user?.profile?.tax_exempt);
        const taxId = user?.profile?.tax_id || user?.tax_id || null;
        const st120Status = user?.profile?.st120_status || user?.st120_status || 'NONE';
        const st120DocUrl = user?.profile?.st120_document_url || user?.st120_document_url || null;
        return {
            userId,
            taxId,
            st120Status,
            st120DocumentUrl: st120DocUrl,
            taxExempt: isExempt,
            taxLegend: isExempt ? this.taxService.getOfficialNysDtfLegend(taxId) : null,
        };
    }
    async generateDigitalST120(req, body) {
        const targetUserId = req.user?.role === 'admin' && body?.userId ? body.userId : req.user.id;
        return this.taxService.generateDigitalST120(targetUserId, req.user);
    }
    async signST120(req, body) {
        const targetUserId = req.user?.role === 'admin' && body?.userId ? body.userId : req.user.id;
        const clientIp = (req.headers && req.headers['x-forwarded-for']) ||
            req.socket?.remoteAddress ||
            req.ip ||
            '127.0.0.1';
        return this.taxService.signST120(targetUserId, body, String(clientIp), req.user);
    }
    async uploadST120(req, file, bodyUserId, taxId) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded or file type not allowed');
        }
        const targetUserId = req.user?.role === 'admin' && bodyUserId ? bodyUserId : req.user.id;
        return this.taxService.uploadST120(targetUserId, file, taxId, req.user);
    }
    async backfillAll() {
        return this.taxService.backfillAllPending();
    }
};
exports.TaxController = TaxController;
__decorate([
    (0, common_1.Post)('validate-st120/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "validateST120", null);
__decorate([
    (0, common_1.Post)('approve/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "approveExemption", null);
__decorate([
    (0, common_1.Post)('reject/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "rejectExemption", null);
__decorate([
    (0, common_1.Get)('status/:userId'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('generate-digital-st120'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "generateDigitalST120", null);
__decorate([
    (0, common_1.Post)('sign-st120'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "signST120", null);
__decorate([
    (0, common_1.Post)('upload-st120'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadPath = (0, path_1.join)((0, path_1.resolve)(config_1.UPLOAD_PATH), 'st120');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const randomName = Array(32)
                    .fill(null)
                    .map(() => Math.round(Math.random() * 16).toString(16))
                    .join('');
                cb(null, `${randomName}${(0, path_1.extname)(file.originalname).toLowerCase()}`);
            },
        }),
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
        fileFilter: (req, file, cb) => {
            const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
            const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            const ext = (0, path_1.extname)(file.originalname).toLowerCase();
            const mime = file.mimetype;
            if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(mime)) {
                return cb(new common_1.BadRequestException('Only PDF and image files (.pdf, .jpg, .jpeg, .png, .webp) are allowed'), false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)('userId')),
    __param(3, (0, common_1.Body)('tax_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "uploadST120", null);
__decorate([
    (0, common_1.Post)('backfill-all'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TaxController.prototype, "backfillAll", null);
exports.TaxController = TaxController = __decorate([
    (0, common_1.Controller)('tax'),
    __metadata("design:paramtypes", [tax_service_1.TaxService])
], TaxController);
//# sourceMappingURL=tax.controller.js.map