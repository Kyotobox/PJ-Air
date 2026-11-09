import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { Address } from '../addresses/address.entity';
import { SystemConfig } from '../system-configs/system-config.entity';
import { SmsService } from '../sms/sms.service';
export declare class AuthService {
    private usersService;
    private systemConfigRepository;
    private smsService?;
    private addressRepository?;
    private otpStore;
    constructor(usersService: UsersService, systemConfigRepository: Repository<SystemConfig>, smsService?: SmsService | undefined, addressRepository?: Repository<Address> | undefined);
    signup(body: any): Promise<{
        address?: Address | undefined;
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
    register(body: any): Promise<{
        address?: Address | undefined;
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
    verifyFirebasePhoneToken(phone: string, idToken?: string): Promise<boolean>;
    verifyPhone(userId: string, body: {
        phone: string;
        verificationCode?: string;
        idToken?: string;
    }): Promise<{
        success: boolean;
        phone_verified: boolean;
        phone: string;
    }>;
    sendSmsOtp(input: string | {
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
