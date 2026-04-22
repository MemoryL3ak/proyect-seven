import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'access_scans', schema: 'core' })
export class AccessScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'scanned_by_id', type: 'uuid' })
  scannedById: string;

  @Column({ name: 'scanned_by_name', type: 'text', nullable: true })
  scannedByName?: string | null;

  @Column({ name: 'target_type', type: 'text' })
  targetType: string;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null;

  @Column({ name: 'target_name', type: 'text', nullable: true })
  targetName?: string | null;

  @Column({ name: 'target_code', type: 'text' })
  targetCode: string;

  @Column({ type: 'text', nullable: true })
  location?: string | null;

  @Column({ type: 'boolean', default: false })
  authorized: boolean;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ name: 'scanned_at', type: 'timestamptz' })
  scannedAt: Date;
}
