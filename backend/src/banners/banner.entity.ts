import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('banners')
export class Banner {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ nullable: true })
    title_en?: string;

    @Column({ type: 'text', nullable: true })
    subtitle?: string;

    @Column({ type: 'text', nullable: true })
    subtitle_en?: string;

    @Column({ nullable: true })
    badge?: string;

    @Column({ nullable: true })
    badge_en?: string;

    @Column({ nullable: true })
    tag?: string;

    @Column({ nullable: true })
    tag_en?: string;

    @Column()
    image_url: string;

    @Column({ nullable: true, default: '#catalogo' })
    link_url?: string;

    @Column({ nullable: true, default: 'Ver Productos' })
    button_text?: string;

    @Column({ nullable: true, default: 'Browse Catalog' })
    button_text_en?: string;

    @Column({ type: 'integer', default: 0 })
    display_order: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
