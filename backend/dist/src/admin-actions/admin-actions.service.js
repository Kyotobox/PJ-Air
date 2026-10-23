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
exports.AdminActionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const system_config_entity_1 = require("../system-configs/system-config.entity");
const crypto_util_1 = require("../auth/crypto.util");
const bcrypt = __importStar(require("bcryptjs"));
let AdminActionsService = class AdminActionsService {
    userRepository;
    systemConfigRepository;
    constructor(userRepository, systemConfigRepository) {
        this.userRepository = userRepository;
        this.systemConfigRepository = systemConfigRepository;
    }
    async resetPassword(targetUserId, newPassword) {
        const user = await this.userRepository.findOne({ where: { id: targetUserId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        if (user.role === 'admin') {
            throw new common_1.ForbiddenException('No se puede restablecer la contraseña de otro administrador');
        }
        const hashedPassword = (0, crypto_util_1.hashPassword)(newPassword);
        await this.userRepository.update(targetUserId, { password: hashedPassword });
        let config = await this.systemConfigRepository.findOne({ where: { key: `force_pwd_change:${targetUserId}` } });
        if (config) {
            config.value = 'true';
        }
        else {
            config = this.systemConfigRepository.create({
                key: `force_pwd_change:${targetUserId}`,
                value: 'true',
            });
        }
        await this.systemConfigRepository.save(config);
        return {
            success: true,
            message: 'Contraseña restablecida. El usuario deberá cambiarla en su próximo acceso.',
        };
    }
    async changeOwnPassword(userId, currentPassword, newPassword) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'password'],
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        let isMatch = false;
        const dbPassword = user.password;
        if (dbPassword && dbPassword.includes(':')) {
            isMatch = (0, crypto_util_1.verifyPassword)(currentPassword, dbPassword);
        }
        else if (dbPassword && (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2y$'))) {
            const hashToCompare = dbPassword.startsWith('$2y$')
                ? dbPassword.replace(/^\$2y\$/, '$2a$')
                : dbPassword;
            isMatch = bcrypt.compareSync(currentPassword, hashToCompare);
        }
        else {
            isMatch = dbPassword === currentPassword;
        }
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Contraseña actual incorrecta');
        }
        const hashedNewPassword = (0, crypto_util_1.hashPassword)(newPassword);
        await this.userRepository.update(userId, { password: hashedNewPassword });
        await this.systemConfigRepository.delete({ key: `force_pwd_change:${userId}` });
        return {
            success: true,
            message: 'Contraseña actualizada correctamente.',
        };
    }
};
exports.AdminActionsService = AdminActionsService;
exports.AdminActionsService = AdminActionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(system_config_entity_1.SystemConfig)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AdminActionsService);
//# sourceMappingURL=admin-actions.service.js.map