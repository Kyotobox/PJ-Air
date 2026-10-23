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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemConfigsController = void 0;
const common_1 = require("@nestjs/common");
const system_configs_service_1 = require("./system-configs.service");
const auth_guard_1 = require("../auth/auth.guard");
let SystemConfigsController = class SystemConfigsController {
    configsService;
    constructor(configsService) {
        this.configsService = configsService;
    }
    async get(key) {
        const value = await this.configsService.get(key);
        if (value === '') {
            throw new common_1.NotFoundException(`Configuration for key "${key}" not found`);
        }
        return { key, value };
    }
    async update(key, value, req) {
        const userRole = req.user?.role?.toLowerCase();
        if (userRole !== 'admin') {
            throw new common_1.ForbiddenException('Only admin users can modify system configurations');
        }
        return this.configsService.update(key, value);
    }
};
exports.SystemConfigsController = SystemConfigsController;
__decorate([
    (0, common_1.Get)(':key'),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SystemConfigsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':key'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)('value')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SystemConfigsController.prototype, "update", null);
exports.SystemConfigsController = SystemConfigsController = __decorate([
    (0, common_1.Controller)('configs'),
    __metadata("design:paramtypes", [system_configs_service_1.SystemConfigsService])
], SystemConfigsController);
//# sourceMappingURL=system-configs.controller.js.map