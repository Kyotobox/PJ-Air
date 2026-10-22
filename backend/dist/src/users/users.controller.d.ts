import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("./user.entity").User[]>;
    findOne(id: string): Promise<import("./user.entity").User>;
    updateProfile(id: string, profileData: any): Promise<import("./profile.entity").Profile>;
    updateRole(id: string, body: {
        role: string;
    }): Promise<import("./user.entity").User>;
    uploadAvatar(id: string, file: Express.Multer.File): Promise<import("./profile.entity").Profile>;
    updateGeneralDiscount(id: string, body: {
        discount: number;
    }): Promise<void>;
    updateDeliveryFee(id: string, body: {
        fee: number;
    }): Promise<void>;
    updateCredit(id: string, body: {
        account_type?: 'cash' | 'credit';
        credit_limit?: number;
        credit_override?: boolean;
    }): Promise<import("./user.entity").User>;
    getCreditSummary(id: string): Promise<{
        account_type: "cash" | "credit";
        credit_limit: number;
        credit_override: boolean;
        used_credit: number;
        available_credit: number;
        is_overdraft: boolean;
        can_order: boolean;
    }>;
    getProductDiscounts(id: string): Promise<import("./product-discount.entity").ProductDiscount[]>;
    setProductDiscount(id: string, body: {
        productId: number;
        discount_percentage?: number;
        special_price?: number;
    }): Promise<import("./product-discount.entity").ProductDiscount>;
    deleteProductDiscount(discountId: string): Promise<void>;
}
