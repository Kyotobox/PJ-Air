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
        if (profileData.phone !== undefined && profileData.phone !== profile.phone && profileData.phone_verified === undefined) {
            profile.phone_verified = false;
        }
        Object.assign(profile, profileData);
        return this.profileRepository.save(profile);
    }
    async findByEmail(email) {
        if (!email)
            return null;
        const normalized = email.trim().toLowerCase();
        return this.userRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .leftJoinAndSelect('user.profile', 'profile')
            .where('LOWER(user.email) = LOWER(:email)', { email: normalized })
            .getOne();
    }
    async findByIdentifier(identifier) {
        if (!identifier)
            return null;
        const normalized = identifier.trim().toLowerCase();
        const userByEmail = await this.findByEmail(normalized);
        if (userByEmail)
            return userByEmail;
        return this.userRepository
            .createQueryBuilder('user')
            .addSelect('user.password')
            .leftJoinAndSelect('user.profile', 'profile')
            .where('LOWER(profile.username) = LOWER(:username)', { username: normalized })
            .getOne();
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
    async updateSt120Document(userId, documentUrl, taxId) {
        const profile = await this.profileRepository.findOne({ where: { id: userId } });
        if (!profile) {
            const newProfile = this.profileRepository.create({
                id: userId,
                st120_document_url: documentUrl,
                st120_status: 'PENDING',
                ...(taxId ? { tax_id: taxId } : {}),
            });
            await this.profileRepository.save(newProfile);
        }
        else {
            profile.st120_document_url = documentUrl;
            profile.st120_status = 'PENDING';
            if (taxId)
                profile.tax_id = taxId;
            await this.profileRepository.save(profile);
        }
        await this.userRepository.update(userId, {
            st120_document_url: documentUrl,
            st120_status: 'PENDING',
            ...(taxId ? { tax_id: taxId } : {}),
        });
        return (await this.profileRepository.findOne({ where: { id: userId } }));
    }
    async updateRole(id, role) {
        const user = await this.findOne(id);
        user.role = role;
        const result = await this.userRepository.save(user);
        return Array.isArray(result) ? result[0] : result;
    }
    async findByEmailWithRole(email) {
        return this.findByEmail(email);
    }
    async updatePassword(userId, newPassword) {
        await this.userRepository.update(userId, { password: newPassword });
    }
    async setResetPasswordToken(userId, token, expires) {
        await this.userRepository.update(userId, {
            reset_password_token: token,
            reset_password_expires: expires,
        });
    }
    async findByResetPasswordToken(token) {
        return this.userRepository.findOne({
            where: { reset_password_token: token },
        });
    }
    async clearResetPasswordToken(userId) {
        await this.userRepository.update(userId, {
            reset_password_token: null,
            reset_password_expires: null,
        });
    }
    async updateGeneralDiscount(userId, discount) {
        const parsed = Number(discount);
        if (isNaN(parsed) || parsed < 0 || parsed > 50) {
            throw new common_1.BadRequestException('El porcentaje de descuento no puede exceder el 50%');
        }
        await this.userRepository.update(userId, { general_discount: parsed });
    }
    async updateDeliveryFee(userId, fee) {
        const parsed = Number(fee);
        if (isNaN(parsed) || parsed < 0 || parsed > 1500) {
            throw new common_1.BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $1500.00');
        }
        await this.userRepository.update(userId, { delivery_fee: parsed });
    }
    async updateMinOrderAmount(userId, minAmount) {
        await this.userRepository.update(userId, { min_order_amount: minAmount !== null && minAmount !== undefined ? Number(minAmount) : null });
    }
    async updateStripeCustomerId(userId, stripeCustomerId) {
        await this.userRepository.update(userId, { stripe_customer_id: stripeCustomerId });
    }
    async updateCreditSettings(userId, data) {
        const user = await this.findOne(userId);
        if (data.account_type !== undefined)
            user.account_type = data.account_type;
        if (data.credit_limit !== undefined)
            user.credit_limit = Number(data.credit_limit) || 0;
        if (data.credit_override !== undefined)
            user.credit_override = Boolean(data.credit_override);
        if (data.check_enabled !== undefined)
            user.check_enabled = Boolean(data.check_enabled);
        if (data.ach_enabled !== undefined)
            user.ach_enabled = Boolean(data.ach_enabled);
        if (data.zelle_enabled !== undefined)
            user.zelle_enabled = Boolean(data.zelle_enabled);
        if (data.free_delivery_enabled !== undefined)
            user.free_delivery_enabled = Boolean(data.free_delivery_enabled);
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
            check_enabled: Boolean(user.check_enabled),
            ach_enabled: Boolean(user.ach_enabled),
            zelle_enabled: Boolean(user.zelle_enabled),
            free_delivery_enabled: Boolean(user.free_delivery_enabled),
            used_credit: Math.round(used_credit * 100) / 100,
            available_credit: Math.round(available_credit * 100) / 100,
            is_overdraft,
            can_order,
            credit_balance: Number(user.credit_balance || 0),
        };
    }
    async updateUser(id, data) {
        const user = await this.findOne(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (data.is_active !== undefined) {
            user.is_active = Boolean(data.is_active);
        }
        if (data.credit_balance !== undefined) {
            user.credit_balance = Number(data.credit_balance);
        }
        if (data.role !== undefined) {
            user.role = data.role;
        }
        if (data.account_type !== undefined) {
            user.account_type = data.account_type;
        }
        if (data.credit_limit !== undefined) {
            user.credit_limit = Number(data.credit_limit);
        }
        if (data.credit_override !== undefined) {
            user.credit_override = Boolean(data.credit_override);
        }
        if (data.check_enabled !== undefined) {
            user.check_enabled = Boolean(data.check_enabled);
        }
        if (data.ach_enabled !== undefined) {
            user.ach_enabled = Boolean(data.ach_enabled);
        }
        if (data.zelle_enabled !== undefined) {
            user.zelle_enabled = Boolean(data.zelle_enabled);
        }
        if (data.free_delivery_enabled !== undefined) {
            user.free_delivery_enabled = Boolean(data.free_delivery_enabled);
        }
        if (data.general_discount !== undefined) {
            user.general_discount = Number(data.general_discount);
        }
        if (data.delivery_fee !== undefined) {
            user.delivery_fee = Number(data.delivery_fee);
        }
        if (data.account_status !== undefined) {
            user.account_status = data.account_status;
        }
        return this.userRepository.save(user);
    }
    async approveAccount(id, body) {
        const user = await this.findOne(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.account_status = body?.account_status || 'APPROVED';
        if (body?.delivery_fee !== undefined) {
            const parsed = Number(body.delivery_fee);
            if (isNaN(parsed) || parsed < 0 || parsed > 1500) {
                throw new common_1.BadRequestException('La tarifa de entrega debe ser un monto válido entre $0.00 y $1500.00');
            }
            user.delivery_fee = parsed;
        }
        if (body?.payment_terms) {
            user.account_type = (body.payment_terms === 'NET15' || body.payment_terms === 'NET30') ? 'credit' : 'cash';
        }
        return this.userRepository.save(user);
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
    async updateB2BTerms(userId, data) {
        const user = await this.findOne(userId);
        const allowedFields = [
            'legal_business_name',
            'dba',
            'ein',
            'business_address',
            'signer_name',
            'signer_title',
            'signer_phone',
            'signer_email',
            'terms_version',
            'accepted_at',
            'ip_address',
            'signature_text',
            'card_last4',
            'stripe_payment_method_id',
            'check_enabled',
            'ach_enabled',
            'zelle_enabled',
            'free_delivery_enabled',
        ];
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                user[field] = data[field];
            }
        }
        const result = await this.userRepository.save(user);
        return Array.isArray(result) ? result[0] : result;
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