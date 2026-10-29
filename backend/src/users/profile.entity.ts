import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  phone_verified: boolean;

  @Column({ nullable: true })
  company_name: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ type: 'varchar', nullable: true })
  tax_id?: string | null;

  @Column({ type: 'varchar', default: 'NONE' })
  st120_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'varchar', nullable: true })
  st120_document_url?: string | null;

  @Column({ type: 'boolean', default: false })
  tax_exempt: boolean;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'id' })
  user: User;
}
