import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'providers', schema: 'core' })
export class Provider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 80, type: 'varchar', nullable: true })
  type?: string | null;

  @Column({ length: 100, type: 'varchar', nullable: true })
  subtype?: string | null;

  @Column({ length: 150, type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ length: 30, type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ length: 30, type: 'varchar', nullable: true })
  rut?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ length: 100, type: 'varchar', nullable: true })
  city?: string | null;

  @Column({ name: 'contact_name', length: 150, type: 'varchar', nullable: true })
  contactName?: string | null;

  @Column({ name: 'parent_provider_id', type: 'uuid', nullable: true })
  parentProviderId?: string | null;

  @Column({ name: 'invoice_type', length: 30, type: 'varchar', nullable: true })
  invoiceType?: string | null;

  @Column({ name: 'bid_amount', type: 'numeric', nullable: true })
  bidAmount?: number | null;

  @Column({ name: 'bid_trip_count', type: 'int', nullable: true })
  bidTripCount?: number | null;

  @Column({ length: 30, type: 'varchar', default: 'ACTIVE' })
  status?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
