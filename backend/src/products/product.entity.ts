import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from './category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Category, (category) => category.products, { nullable: true, eager: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: true })
  image: string;

  @Column({ default: false })
  is_deleted: boolean;

  @Column({ nullable: true })
  stripe_product_id: string;

  @Column({ nullable: true })
  stripe_price_id: string;

  @Column({ type: 'varchar', nullable: true })
  production_group: string | null;
}

