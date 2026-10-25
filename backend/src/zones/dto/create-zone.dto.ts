export class CreateZoneDto {
  name: string;
  zip_codes: string;
  base_fee?: number;
  min_free_delivery_amount?: number | null;
  is_active?: boolean;
}

export class UpdateZoneDto {
  name?: string;
  zip_codes?: string;
  base_fee?: number;
  min_free_delivery_amount?: number | null;
  is_active?: boolean;
}
