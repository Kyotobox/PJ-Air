import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('scheduled_orders')
export class ScheduledOrder {
  @PrimaryColumn('varchar')
  id: string;

  @Column('varchar')
  user_id: string;

  @Column('varchar', { default: 'Pedido Recurrente Semanal' })
  title: string;

  @Column('text')
  items_json: string; // JSON array of items: [{ productId, productName, quantity, price }]

  @Column('text')
  delivery_days_json: string; // JSON array of days e.g. ["mon", "wed", "fri"]

  @Column('varchar', { default: '08:00' })
  delivery_time: string;

  @Column('varchar', { default: 'saved' })
  delivery_type: string;

  @Column('varchar', { nullable: true })
  address_id?: string | null;

  @Column('varchar', { default: 'credit' })
  payment_method: string;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @Column('datetime', { nullable: true })
  last_run?: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
