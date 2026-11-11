import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Profile } from './profile.entity';
import { ProductDiscount } from './product-discount.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(ProductDiscount)
    private productDiscountRepository: Repository<ProductDiscount>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({ relations: ['profile', 'addresses', 'orders'] });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ 
      where: { id },
      relations: ['profile', 'addresses', 'orders', 'orders.items', 'orders.items.product', 'productDiscounts', 'productDiscounts.product'] 
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, profileData: Partial<Profile>): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { id: userId } });
    if (!profile) {
      // If profile doesn't exist, create it
      const newProfile = this.profileRepository.create({ ...profileData, id: userId });
      return this.profileRepository.save(newProfile);
    }
    
    if (profileData.phone !== undefined && profileData.phone !== profile.phone && profileData.phone_verified === undefined) {
      profile.phone_verified = false;
    }

    Object.assign(profile, profileData);
    return this.profileRepository.save(profile);
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalized })
      .getOne();
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    if (!identifier) return null;
    const normalized = identifier.trim().toLowerCase();
    const userByEmail = await this.findByEmail(normalized);
    if (userByEmail) return userByEmail;

    // Check username
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.profile', 'profile')
      .where('LOWER(profile.username) = LOWER(:username)', { username: normalized })
      .getOne();
  }

  async create(userData: any): Promise<User> {
    const user = this.userRepository.create(userData);
    const result = await this.userRepository.save(user);
    return Array.isArray(result) ? result[0] : result;
  }

  async createProfile(profileData: Partial<Profile>): Promise<Profile> {
    const profile = this.profileRepository.create(profileData);
    const result = await this.profileRepository.save(profile);
    return Array.isArray(result) ? result[0] : result;
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { id: userId } });
    if (!profile) {
      const newProfile = this.profileRepository.create({ id: userId, avatar_url: avatarUrl });
      return this.profileRepository.save(newProfile);
    }
    profile.avatar_url = avatarUrl;
    return this.profileRepository.save(profile);
  }

  async updateSt120Document(userId: string, documentUrl: string, taxId?: string): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { id: userId } });
    if (!profile) {
      const newProfile = this.profileRepository.create({
        id: userId,
        st120_document_url: documentUrl,
        st120_status: 'PENDING',
        ...(taxId ? { tax_id: taxId } : {}),
      });
      await this.profileRepository.save(newProfile);
    } else {
      profile.st120_document_url = documentUrl;
      profile.st120_status = 'PENDING';
      if (taxId) profile.tax_id = taxId;
      await this.profileRepository.save(profile);
    }

    await this.userRepository.update(userId, {
      st120_document_url: documentUrl,
      st120_status: 'PENDING',
      ...(taxId ? { tax_id: taxId } : {}),
    });

    return (await this.profileRepository.findOne({ where: { id: userId } }))!;
  }

  async updateRole(id: string, role: string): Promise<User> {
    const user = await this.findOne(id);
    user.role = role;
    const result = await this.userRepository.save(user);
    return Array.isArray(result) ? result[0] : result;
  }

  async findByEmailWithRole(email: string): Promise<User | null> {
    return this.findByEmail(email);
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.userRepository.update(userId, { password: newPassword });
  }

  async setResetPasswordToken(userId: string, token: string, expires: Date): Promise<void> {
    await this.userRepository.update(userId, {
      reset_password_token: token,
      reset_password_expires: expires,
    });
  }

  async findByResetPasswordToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { reset_password_token: token },
    });
  }

  async clearResetPasswordToken(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      reset_password_token: null,
      reset_password_expires: null,
    });
  }

  async updateGeneralDiscount(userId: string, discount: number): Promise<void> {
    await this.userRepository.update(userId, { general_discount: discount });
  }

  async updateDeliveryFee(userId: string, fee: number): Promise<void> {
    await this.userRepository.update(userId, { delivery_fee: fee });
  }

  async updateMinOrderAmount(userId: string, minAmount: number | null): Promise<void> {
    await this.userRepository.update(userId, { min_order_amount: minAmount !== null && minAmount !== undefined ? Number(minAmount) : null });
  }

  async updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await this.userRepository.update(userId, { stripe_customer_id: stripeCustomerId });
  }

  async updateCreditSettings(
    userId: string, 
    data: { account_type?: 'cash' | 'credit'; credit_limit?: number; credit_override?: boolean; check_enabled?: boolean; ach_enabled?: boolean }
  ): Promise<User> {
    const user = await this.findOne(userId);
    if (data.account_type !== undefined) user.account_type = data.account_type;
    if (data.credit_limit !== undefined) user.credit_limit = Number(data.credit_limit) || 0;
    if (data.credit_override !== undefined) user.credit_override = Boolean(data.credit_override);
    if (data.check_enabled !== undefined) user.check_enabled = Boolean(data.check_enabled);
    if (data.ach_enabled !== undefined) user.ach_enabled = Boolean(data.ach_enabled);
    
    await this.userRepository.save(user);
    return this.findOne(userId);
  }

  async getUserCreditSummary(userId: string): Promise<{
    account_type: 'cash' | 'credit';
    credit_limit: number;
    credit_override: boolean;
    check_enabled: boolean;
    ach_enabled: boolean;
    used_credit: number;
    available_credit: number;
    is_overdraft: boolean;
    can_order: boolean;
    credit_balance?: number;
  }> {
    const user = await this.findOne(userId);
    const unpaidOrders = (user.orders || []).filter(
      (o: any) => o.payment_status !== 'paid' && o.payment_status !== 'refunded' && o.status !== 'cancelled' && o.status !== 'Cancelado'
    );
    const used_credit = unpaidOrders.reduce((acc: number, o: any) => {
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
      used_credit: Math.round(used_credit * 100) / 100,
      available_credit: Math.round(available_credit * 100) / 100,
      is_overdraft,
      can_order,
      credit_balance: Number(user.credit_balance || 0),
    };
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
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
    if (data.general_discount !== undefined) {
      user.general_discount = Number(data.general_discount);
    }
    if (data.delivery_fee !== undefined) {
      user.delivery_fee = Number(data.delivery_fee);
    }
    return this.userRepository.save(user);
  }

  async setProductDiscount(userId: string, productId: number, data: { discount_percentage?: number; special_price?: number }): Promise<ProductDiscount> {
    let discount = await this.productDiscountRepository.findOne({ where: { user_id: userId, product_id: productId } });
    if (discount) {
      Object.assign(discount, data);
    } else {
      discount = this.productDiscountRepository.create({ user_id: userId, product_id: productId, ...data });
    }
    return this.productDiscountRepository.save(discount);
  }

  async deleteProductDiscount(discountId: string): Promise<void> {
    await this.productDiscountRepository.delete(discountId);
  }

  async getProductDiscounts(userId: string): Promise<ProductDiscount[]> {
    return this.productDiscountRepository.find({
      where: { user_id: userId },
      relations: ['product']
    });
  }

  async updateB2BTerms(userId: string, data: Partial<User>): Promise<User> {
    const user = await this.findOne(userId);
    const allowedFields: (keyof User)[] = [
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
    ];
    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        (user as any)[field] = (data as any)[field];
      }
    }
    const result = await this.userRepository.save(user);
    return Array.isArray(result) ? result[0] : result;
  }
}
