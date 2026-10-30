"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../users/user.entity");
const profile_entity_1 = require("../users/profile.entity");
const tax_service_1 = require("./tax.service");
const vision_validation_service_1 = require("./vision-validation.service");
const tax_controller_1 = require("./tax.controller");
let TaxModule = class TaxModule {
};
exports.TaxModule = TaxModule;
exports.TaxModule = TaxModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, profile_entity_1.Profile])],
        controllers: [tax_controller_1.TaxController],
        providers: [tax_service_1.TaxService, vision_validation_service_1.VisionValidationService],
        exports: [tax_service_1.TaxService, vision_validation_service_1.VisionValidationService],
    })
], TaxModule);
//# sourceMappingURL=tax.module.js.map