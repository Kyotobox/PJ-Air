import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(body: any): Promise<{
        address?: import("../addresses/address.entity").Address | undefined;
        message: string;
        user: {
            id: any;
            email: any;
            app_metadata: {};
            user_metadata: {
                full_name: any;
            };
            aud: string;
            created_at: string;
        };
        session: {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            token_type: string;
            user: {
                id: any;
                email: any;
            };
        };
    }>;
    login(body: any): Promise<any>;
    recoverPassword(body: {
        identifier: string;
    }): Promise<{
        success: boolean;
        message: string;
        email: string;
    }>;
    resetPassword(body: {
        token: string;
        newPassword: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    changePassword(body: any): Promise<{
        message: string;
    }>;
    verifyPhone(req: any, body: {
        phone: string;
        verificationCode?: string;
        idToken?: string;
    }): Promise<{
        success: boolean;
        phone_verified: boolean;
        phone: string;
    }>;
    verifyPhoneToken(req: any, body: {
        phone: string;
        verificationCode?: string;
        idToken?: string;
    }): Promise<{
        success: boolean;
        phone_verified: boolean;
        phone: string;
    }>;
    sendSmsOtp(body: {
        phone: string;
    }): Promise<{
        success: boolean;
        verificationId: string;
        phone: string;
        message: string;
    }>;
    verifySmsOtp(body: {
        phone: string;
        code: string;
        verificationId?: string;
    }): Promise<{
        success: boolean;
        idToken: string;
        phone: string;
    }>;
}
