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
exports.AddressesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const fs = __importStar(require("fs"));
const config_1 = require("../config");
const addresses_service_1 = require("./addresses.service");
const address_validation_service_1 = require("./address-validation.service");
const auth_guard_1 = require("../auth/auth.guard");
const resource_ownership_guard_1 = require("../auth/resource-ownership.guard");
let AddressesController = class AddressesController {
    addressesService;
    addressValidationService;
    constructor(addressesService, addressValidationService) {
        this.addressesService = addressesService;
        this.addressValidationService = addressValidationService;
    }
    async uploadPhoto(file) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded or file type not allowed');
        }
        return { url: `/uploads/addresses/${file.filename}` };
    }
    async validateAddress(body) {
        if (!body?.address) {
            throw new common_1.BadRequestException('El campo "address" es obligatorio para la validación.');
        }
        if (!this.addressValidationService) {
            return { valid: true, address: body.address };
        }
        const result = await this.addressValidationService.validateAndGeocode(body.address, body.lat, body.lng);
        return { valid: true, ...result };
    }
    async create(body, req) {
        const targetUserId = (req.user?.role === 'admin' && body.userId) ? body.userId : req.user.id;
        const { userId, ...addressData } = body;
        return this.addressesService.create(targetUserId, addressData);
    }
    async findByUser(userId, req) {
        if (req.user?.role !== 'admin' && req.user?.id !== userId) {
            throw new common_1.ForbiddenException('Cannot access other user addresses');
        }
        return this.addressesService.findByUser(userId);
    }
    async update(id, body, req) {
        const address = await this.addressesService.findOne(id);
        if (req.user?.role !== 'admin' && address.user_id !== req.user.id) {
            throw new common_1.ForbiddenException('Cannot modify other user addresses');
        }
        const { userId, ...addressData } = body;
        return this.addressesService.update(id, addressData);
    }
    async delete(id, req) {
        const address = await this.addressesService.findOne(id);
        if (req.user?.role !== 'admin' && address.user_id !== req.user.id) {
            throw new common_1.ForbiddenException('Cannot delete other user addresses');
        }
        return this.addressesService.delete(id);
    }
};
exports.AddressesController = AddressesController;
__decorate([
    (0, common_1.Post)('upload-photo'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (req, file, cb) => {
                const uploadPath = (0, path_1.join)((0, path_1.resolve)(config_1.UPLOAD_PATH), 'addresses');
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
            }
        })
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "uploadPhoto", null);
__decorate([
    (0, common_1.Post)('validate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "validateAddress", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    (0, common_1.UseGuards)(resource_ownership_guard_1.ResourceOwnershipGuard),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "findByUser", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AddressesController.prototype, "delete", null);
exports.AddressesController = AddressesController = __decorate([
    (0, common_1.Controller)('addresses'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [addresses_service_1.AddressesService,
        address_validation_service_1.AddressValidationService])
], AddressesController);
//# sourceMappingURL=addresses.controller.js.map