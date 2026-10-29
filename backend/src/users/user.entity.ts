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

  @OneToMany(() => ProductDiscount, (pd) => pd.user)
  productDiscounts: ProductDiscount[];
}
