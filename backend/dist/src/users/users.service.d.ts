import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Profile } from './profile.entity';
import { ProductDiscount } from './product-discount.entity';
export declare class UsersService {
    private userRepository;
    private profileRepository;
    private productDiscountRepository;
    constructor(userRepository: Repository<User>, profileRepository: Repository<Profile>, productDiscountRepository: Repository<ProductDiscount>);
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User>;
    updateProfile(userId: string, profileData: Partial<Profile>): Promise<Profile>;
    findByEmail(email: string): Promise<User | null>;
    findByIdentifier(identifier: string): Promise<User | null>;
    create(userData: any): Promise<User>;
    createProfile(profileData: Partial<Profile>): Promise<Profile>;
    updateAvatar(userId: string, avatarUrl: string): Promise<Profile>;
    updateRole(id: string, role: string): Promise<User>;
    findByEmailWithRole(email: string): Promise<User | null>;
    updatePassword(userId: string, newPassword: string): Promise<void>;
    updateGeneralDiscount(userId: string, discount: number): Promise<void>;
    updateDeliveryFee(userId: string, fee: number): Promise<void>;
    updateStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>;
    updateCreditSettings(userId: string, data: {
        account_type?: 'cash' | 'credit';
        credit_limit?: number;
        credit_override?: boolean;
    }): Promise<User>;
    getUserCreditSummary(userId: string): Promise<{
        account_type: 'cash' | 'credit';
        credit_limit: number;
        credit_override: boolean;
        used_credit: number;
        available_credit: number;
        is_overdraft: boolean;
        can_order: boolean;
    }>;
    setProductDiscount(userId: string, productId: number, data: {
        discount_percentage?: number;
        special_price?: number;
    }): Promise<ProductDiscount>;
    deleteProductDiscount(discountId: string): Promise<void>;
    getProductDiscounts(userId: string): Promise<ProductDiscount[]>;
}
