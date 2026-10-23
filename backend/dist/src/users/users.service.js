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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./user.entity");
const profile_entity_1 = require("./profile.entity");
const product_discount_entity_1 = require("./product-discount.entity");
let UsersService = class UsersService {
    userRepository;
    profileRepository;
    productDiscountRepository;
    constructor(userRepository, profileRepository, productDiscountRepository) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.productDiscountRepository = productDiscountRepository;
    }
    async findAll() {
        return this.userRepository.find({ relations: ['profile', 'addresses', 'orders'] });
    }
    async findOne(id) {
        const user = await this.userRepository.findOne({
            where: { id },
            relations: ['profile', 'addresses', 'orders', 'orders.items', 'orders.items.product', 'productDiscounts', 'productDiscounts.product']
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async updateProfile(userId, profileData) {
        const profile = await this.profileRepository.findOne({ where: { id: userId } });
        if (!profile) {
            const newProfile = this.profileRepository.create({ ...profileData, id: userId });
            return this.profileRepository.save(newProfile);
        }
        Object.assign(profile, profileData);
        return this.profileRepository.save(profile);
    }
    async findByEmail(email) {
        return this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'role'],
            relations: ['profile']
        });
    }
    async findByIdentifier(identifier) {
        const userByEmail = await this.findByEmail(identifier);
        if (userByEmail)
            return userByEmail;
        return this.userRepository.findOne({
            where: { profile: { username: identifier } },
            select: ['id', 'email', 'password', 'role'],
            relations: ['profile']
        });
    }
    async create(userData) {
        const user = this.userRepository.create(userData);
        const result = await this.userRepository.save(user);
        return Array.isArray(result) ? result[0] : result;
    }
    async createProfile(profileData) {
        const profile = this.profileRepository.create(profileData);
        const result = await this.profileRepository.save(profile);
        return Array.isArray(result) ? result[0] : result;
    }
    async updateAvatar(userId, avatarUrl) {
        const profile = await this.profileRepository.findOne({ where: { id: userId } });
        if (!profile) {
            const newProfile = this.profileRepository.create({ id: userId, avatar_url: avatarUrl });
            return this.profileRepository.save(newProfile);
        }
        profile.avatar_url = avatarUrl;
        return this.profileRepository.save(profile);
    }
    async updateRole(id, role) {
        const user = await this.findOne(id);
        user.role = role;
        const result = await this.userRepository.save(user);
        return Array.isArray(result) ? result[0] : result;
    }
    async findByEmailWithRole(email) {
        return this.userRepository.findOne({
            where: { email },
            select: ['id', 'email', 'password', 'role'],
            relations: ['profile']
        });
    }
    async updatePassword(userId, newPassword) {
        await this.userRepository.update(userId, { password: newPassword });
    }
    async updateGeneralDiscount(userId, discount) {
        await this.userRepository.update(userId, { general_discount: discount });
    }
    async updateDeliveryFee(userId, fee) {
        await this.userRepository.update(userId, { delivery_fee: fee });
    }
    async updateCreditSettings(userId, data) {
        const user = await this.findOne(userId);
        if (data.account_type !== undefined)
            user.account_type = data.account_type;
        if (data.credit_limit !== undefined)
            user.credit_limit = Number(data.credit_limit) || 0;
        if (data.credit_override !== undefined)
            user.credit_override = Boolean(data.credit_override);
        await this.userRepository.save(user);
        return this.findOne(userId);
    }
    async getUserCreditSummary(userId) {
        const user = await this.findOne(userId);
        const unpaidOrders = (user.orders || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado');
        const used_credit = unpaidOrders.reduce((acc, o) => {
            const netDebt = Math.max(0, (Number(o.total) || 0) - (Number(o.refunded_amount) || 0));
            return acc + netDebt;
        }, 0);
        const credit_limit = Number(user.credit_limit || 0);
        const available_credit = Math.max(0, credit_limit - used_credit);
        const is_overdraft = used_credit > credit_limit;
        const can_order = user.account_type === 'cash' || !is_overdraft || Boolean(user.credit_override);
        return {
            account_type: user.account_type || 'cash',
            credit_limit,
            credit_override: Boolean(user.credit_override),
            used_credit: Math.round(used_credit * 100) / 100,
            available_credit: Math.round(available_credit * 100) / 100,
            is_overdraft,
            can_order,
        };
    }
    async setProductDiscount(userId, productId, data) {
        let discount = await this.productDiscountRepository.findOne({ where: { user_id: userId, product_id: productId } });
        if (discount) {
            Object.assign(discount, data);
        }
        else {
            discount = this.productDiscountRepository.create({ user_id: userId, product_id: productId, ...data });
        }
        return this.productDiscountRepository.save(discount);
    }
    async deleteProductDiscount(discountId) {
        await this.productDiscountRepository.delete(discountId);
    }
    async getProductDiscounts(userId) {
        return this.productDiscountRepository.find({
            where: { user_id: userId },
            relations: ['product']
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(profile_entity_1.Profile)),
    __param(2, (0, typeorm_1.InjectRepository)(product_discount_entity_1.ProductDiscount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map