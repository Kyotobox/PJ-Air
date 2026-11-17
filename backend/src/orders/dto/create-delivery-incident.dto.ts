import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsIn } from 'class-validator';

export class CreateDeliveryIncidentDto {
  @IsOptional()
  @IsString()
  order_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsNotEmpty({ message: 'product_id es requerido' })
  @IsNumber({}, { message: 'product_id debe ser numérico' })
  product_id: number;

  @IsNotEmpty({ message: 'quantity es requerido' })
  @IsNumber({}, { message: 'quantity debe ser numérico' })
  @IsPositive({ message: 'quantity debe ser mayor a 0' })
  quantity: number;

  @IsNotEmpty({ message: 'reason_category es requerido' })
  @IsString()
  @IsIn(['missing_kitchen', 'transit_damage', 'quality_defect', 'wrong_item'], {
    message: 'reason_category debe ser missing_kitchen, transit_damage, quality_defect o wrong_item',
  })
  reason_category: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsNumber({}, { message: 'amount debe ser numérico' })
  amount?: number;

  @IsOptional()
  @IsString()
  voucher_code?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  reviewed_by?: string;
}
