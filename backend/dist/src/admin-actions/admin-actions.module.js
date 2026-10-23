"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminActionsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../users/user.entity");
const system_config_entity_1 = require("../system-configs/system-config.entity");
const admin_actions_controller_1 = require("./admin-actions.controller");
const admin_actions_service_1 = require("./admin-actions.service");
let AdminActionsModule = class AdminActionsModule {
};
exports.AdminActionsModule = AdminActionsModule;
exports.AdminActionsModule = AdminActionsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, system_config_entity_1.SystemConfig])],
        controllers: [admin_actions_controller_1.AdminActionsController],
        providers: [admin_actions_service_1.AdminActionsService],
        exports: [admin_actions_service_1.AdminActionsService],
    })
], AdminActionsModule);
//# sourceMappingURL=admin-actions.module.js.map