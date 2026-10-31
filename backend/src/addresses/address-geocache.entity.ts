import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('address_geocache')
export class AddressGeocache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  address_hash: string;

  @Column()
  raw_query: string;

  @Column()
  formatted_address: string;

  @Column('double precision')
  lat: number;

  @Column('double precision')
  lng: number;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zip: string;

  @CreateDateColumn()
  created_at: Date;
}
