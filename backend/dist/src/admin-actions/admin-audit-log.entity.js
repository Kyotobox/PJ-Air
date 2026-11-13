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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuditLog = void 0;
const typeorm_1 = require("typeorm");
let AdminAuditLog = class AdminAuditLog {
    id;
    admin_id;
    admin_name;
    action;
    target_entity;
    target_id;
    previous_state_json;
    new_state_json;
    notes;
    ip_address;
    created_at;
};
exports.AdminAuditLog = AdminAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "admin_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "admin_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "target_entity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AdminAuditLog.prototype, "target_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "previous_state_json", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "new_state_json", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], AdminAuditLog.prototype, "ip_address", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], AdminAuditLog.prototype, "created_at", void 0);
exports.AdminAuditLog = AdminAuditLog = __decorate([
    (0, typeorm_1.Entity)('admin_audit_logs')
], AdminAuditLog);
//# sourceMappingURL=admin-audit-log.entity.js.map