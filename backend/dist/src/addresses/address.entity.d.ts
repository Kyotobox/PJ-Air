import { User } from '../users/user.entity';
export declare class Address {
    id: string;
    user_id: string;
    alias: string;
    address: string;
    zone: string;
    notes: string;
    city: string;
    lat: number;
    lng: number;
    refined_lat: number;
    refined_lng: number;
    is_default: boolean;
    is_temporary: boolean;
    access_code: string;
    has_key: boolean;
    key_location: string;
    fridge_access_required: boolean;
    delivery_photos_json: string;
    user: User;
}
