import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export const ColumnNumericTransformer = {
  to: (data: number | null | undefined): number | null => (data === undefined || data === null ? null : Number(data)),
  from: (data: string | number | null | undefined): number | null => (data === null || data === undefined ? null : Number(data)),
};

@Entity('delivery_zones')
export class DeliveryZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  zip_codes: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: ColumnNumericTransformer,
  })
  base_fee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
    transformer: ColumnNumericTransformer,
  })
  min_free_delivery_amount: number | null;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
