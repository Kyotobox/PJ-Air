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
    tax_id?: string | null;
    st120_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
    st120_document_url?: string | null;
    tax_exempt: boolean;
    user: User;
}
