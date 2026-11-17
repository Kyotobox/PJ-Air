import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../order.entity';
import { User } from '../../users/user.entity';

@Entity('delivery_incidents')
export class DeliveryIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  order_id: string;

  @Column({ type: 'varchar' })
  user_id: string;

  @Column({ type: 'int' })
  product_id: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 50 })
  reason_category: string; // 'missing_kitchen' | 'transit_damage' | 'quality_defect' | 'wrong_item'

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  photo_url: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  voucher_code: string;

  @Column({ type: 'varchar', length: 30, default: 'pending_review' })
  status: string; // 'pending_review' | 'approved' | 'rejected'

  @Column({ type: 'varchar', nullable: true })
  reviewed_by: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
