export declare const ColumnNumericTransformer: {
    to: (data: number | null | undefined) => number | null;
    from: (data: string | number | null | undefined) => number | null;
};
export declare class DeliveryZone {
    id: string;
    name: string;
    zip_codes: string;
    base_fee: number;
    min_free_delivery_amount: number | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
