import { User } from './user.entity';
export declare class Profile {
    id: string;
    full_name: string;
    username: string;
    nickname: string;
    phone: string;
    phone_verified: boolean;
    company_name: string;
    avatar_url: string;
    user: User;
}
