import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  user_id?: string;

  @Column()
  category: string; // 'sugerencia' | 'reclamo' | 'producto' | 'servicio' | 'otro'

  @Column('text')
  message: string;

  @Column({ default: 'pending' })
  status: string; // 'pending' | 'reviewed' | 'resolved'

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
