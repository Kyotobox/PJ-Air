import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { SystemConfig } from '../system-configs/system-config.entity';
export declare class AuthService {
    private usersService;
    private systemConfigRepository;
    constructor(usersService: UsersService, systemConfigRepository: Repository<SystemConfig>);
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
    login(identifierInput: string, password: string): Promise<any>;
    recoverPassword(identifier: string): Promise<{
        message: string;
        email: string;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
    verifyPhone(userId: string, body: {
        phone: string;
        verificationCode?: string;
        idToken?: string;
    }): Promise<{
        success: boolean;
        phone_verified: boolean;
        phone: string;
    }>;
}
