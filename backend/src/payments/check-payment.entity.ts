import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

export type CheckPaymentStatus =
  | 'PENDING_RECEIPT'
  | 'IN_HAND'
  | 'DEPOSITED'
  | 'BOUNCED';

@Entity('check_payments')
export class CheckPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  order_id: string;

  @Column()
  user_id: string;

  @Column()
  check_number: string;

  @Column()
  bank_name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  received_date: string; // YYYY-MM-DD

  @Column()
  clearance_deadline: string; // YYYY-MM-DD (calculated +3 business days)

  @Column({ default: 'PENDING_RECEIPT' })
  status: CheckPaymentStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
