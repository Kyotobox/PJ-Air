import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signup(body: any): Promise<{
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
        message: string;
        email: string;
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
}
