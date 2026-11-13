import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("./user.entity").User[]>;
    findOne(id: string): Promise<import("./user.entity").User>;
    updateUser(id: string, data: any): Promise<import("./user.entity").User>;
    updateProfile(id: string, profileData: any): Promise<import("./profile.entity").Profile>;
    updateB2BTerms(id: string, data: any): Promise<import("./user.entity").User>;
    updateRole(id: string, body: {
        role: string;
    }): Promise<import("./user.entity").User>;
    approveAccount(id: string, body: any): Promise<import("./user.entity").User>;
    uploadAvatar(id: string, file: Express.Multer.File): Promise<import("./profile.entity").Profile>;
    uploadSt120(id: string, file: Express.Multer.File, taxId?: string): Promise<import("./profile.entity").Profile>;
    updateGeneralDiscount(id: string, body: {
        discount: number;
    }): Promise<void>;
    updateDeliveryFee(id: string, body: {
        fee: number;
    }): Promise<void>;
    updateMinOrderAmount(id: string, body: {
        min_order_amount: number | null;
    }): Promise<{
        success: boolean;
        min_order_amount: number | null;
    }>;
    updateCredit(id: string, body: {
        account_type?: 'cash' | 'credit';
        credit_limit?: number;
        credit_override?: boolean;
        check_enabled?: boolean;
        ach_enabled?: boolean;
    }): Promise<import("./user.entity").User>;
    getCreditSummary(id: string): Promise<{
        account_type: "cash" | "credit";
        credit_limit: number;
        credit_override: boolean;
        check_enabled: boolean;
        ach_enabled: boolean;
        used_credit: number;
        available_credit: number;
        is_overdraft: boolean;
        can_order: boolean;
        credit_balance?: number;
    }>;
    getProductDiscounts(id: string): Promise<import("./product-discount.entity").ProductDiscount[]>;
    setProductDiscount(id: string, body: {
        productId: number;
        discount_percentage?: number;
        special_price?: number;
    }): Promise<import("./product-discount.entity").ProductDiscount>;
    deleteProductDiscount(discountId: string): Promise<void>;
}
