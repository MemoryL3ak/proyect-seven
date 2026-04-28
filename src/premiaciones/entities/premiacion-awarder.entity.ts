import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'premiacion_awarders', schema: 'core' })
export class PremiacionAwarder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'premiacion_id', type: 'uuid' })
  premiacionId: string;

  @Column({ name: 'athlete_id', type: 'uuid' })
  athleteId: string;

  @Column({ type: 'text', default: 'AWARDER' })
  role: string;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt?: Date | null;

  @Column({ name: 'declined_at', type: 'timestamptz', nullable: true })
  declinedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
