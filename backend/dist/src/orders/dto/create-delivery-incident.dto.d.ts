export declare class CreateDeliveryIncidentDto {
    order_id?: string;
    user_id?: string;
    product_id: number;
    quantity: number;
    reason_category: string;
    description?: string;
    photo_url?: string;
    amount?: number;
    voucher_code?: string;
    status?: string;
    reviewed_by?: string;
}
