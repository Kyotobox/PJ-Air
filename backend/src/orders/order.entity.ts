import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Address } from '../addresses/address.entity';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 'pending' })
  payment_status: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  delivery_fee_charged: number;

  @Column({ nullable: true })
  stripe_payment_id: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  refunded_amount: number;

  @Column({ nullable: true })
  refund_reason: string;

  @Column({ nullable: true })
  address_id: string;

  @Column({ nullable: true })
  delivery_date: string;

  @Column({ nullable: true })
  payment_due_date: string;

  @Column({ nullable: true })
  delivery_user_id: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, default: 'saved' })
  delivery_type: string; // 'pickup' | 'saved' | 'other'

  @Column({ nullable: true, type: 'text' })
  delivery_address_text: string; // for temporary / other addresses

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delivery_user_id' })
  delivery_user: User;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];
}
