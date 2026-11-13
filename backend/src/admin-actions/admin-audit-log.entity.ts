import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  admin_id: string;

  @Column({ type: 'varchar' })
  admin_name: string;

  @Column({ type: 'varchar' })
  action: string; // ej. 'ORDER_EDIT', 'FEE_OVERRIDE', 'DISCOUNT_CHANGE', 'CLIENT_RATE_UPDATE'

  @Column({ type: 'varchar' })
  target_entity: string;

  @Column({ type: 'varchar' })
  target_id: string;

  @Column({ type: 'text', nullable: true })
  previous_state_json: string | null;

  @Column({ type: 'text', nullable: true })
  new_state_json: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
