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
exports.AddressGeocache = void 0;
const typeorm_1 = require("typeorm");
let AddressGeocache = class AddressGeocache {
    id;
    address_hash;
    raw_query;
    formatted_address;
    lat;
    lng;
    city;
    state;
    zip;
    created_at;
};
exports.AddressGeocache = AddressGeocache;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AddressGeocache.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AddressGeocache.prototype, "address_hash", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AddressGeocache.prototype, "raw_query", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AddressGeocache.prototype, "formatted_address", void 0);
__decorate([
    (0, typeorm_1.Column)('double precision'),
    __metadata("design:type", Number)
], AddressGeocache.prototype, "lat", void 0);
__decorate([
    (0, typeorm_1.Column)('double precision'),
    __metadata("design:type", Number)
], AddressGeocache.prototype, "lng", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AddressGeocache.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AddressGeocache.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AddressGeocache.prototype, "zip", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AddressGeocache.prototype, "created_at", void 0);
exports.AddressGeocache = AddressGeocache = __decorate([
    (0, typeorm_1.Entity)('address_geocache')
], AddressGeocache);
//# sourceMappingURL=address-geocache.entity.js.map