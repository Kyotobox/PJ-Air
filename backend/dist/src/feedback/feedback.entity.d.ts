import { User } from '../users/user.entity';
export declare class Feedback {
    id: string;
    user_id?: string;
    category: string;
    message: string;
    status: string;
    created_at: Date;
    user: User;
}
