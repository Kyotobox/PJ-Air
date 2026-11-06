import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { Address } from '../addresses/address.entity';
import { Order } from '../orders/order.entity';
import { ProductDiscount } from './product-discount.entity';
import { Profile } from './profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Hide password by default
  password: string;

  @Column({ default: 'client' })
  role: string;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile: Profile;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  general_discount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  delivery_fee: number;

  @Column({ default: 'cash' })
  account_type: 'cash' | 'credit';

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  credit_limit: number;

  @Column({ default: false })
  credit_override: boolean;

  @Column({ default: false })
  credit_blocked: boolean;

  @Column({ nullable: true })
  stripe_customer_id: string;

  @Column({ type: 'varchar', nullable: true })
  tax_id?: string | null;

  @Column({ type: 'varchar', default: 'NONE' })
  st120_status: string;

  @Column({ type: 'varchar', nullable: true })
  st120_document_url?: string | null;

  @Column({ type: 'boolean', default: false })
  tax_exempt: boolean;

  @Column({ type: 'varchar', nullable: true })
  legal_business_name?: string | null;

  @Column({ type: 'varchar', nullable: true })
  dba?: string | null;

  @Column({ type: 'varchar', nullable: true })
  ein?: string | null;

  @Column({ type: 'text', nullable: true })
  business_address?: string | null;

  @Column({ type: 'varchar', nullable: true })
  signer_name?: string | null;

  @Column({ type: 'varchar', nullable: true })
  signer_title?: string | null;

  @Column({ type: 'varchar', nullable: true })
  signer_phone?: string | null;

  @Column({ type: 'varchar', nullable: true })
  signer_email?: string | null;

  @Column({ type: 'varchar', default: 'v2026.10.29', nullable: true })
  terms_version?: string | null;

  @Column({ type: 'datetime', nullable: true })
  accepted_at?: Date | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address?: string | null;

  @Column({ type: 'varchar', nullable: true })
  signature_text?: string | null;

  @Column({ type: 'varchar', nullable: true })
  card_last4?: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_payment_method_id?: string | null;

  @Column({ type: 'boolean', default: false })
  check_enabled: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  credit_balance: number;

  @OneToMany(() => ProductDiscount, (pd) => pd.user)
  productDiscounts: ProductDiscount[];
}
