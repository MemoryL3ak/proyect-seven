import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'premiaciones', schema: 'core' })
export class Premiacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string | null;

  @Column({ name: 'sports_event_id', type: 'uuid', nullable: true })
  sportsEventId?: string | null;

  @Column({ name: 'discipline_id', type: 'uuid', nullable: true })
  disciplineId?: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  discipline?: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'venue_id', type: 'uuid', nullable: true })
  venueId?: string | null;

  @Column({ name: 'venue_name', type: 'text', nullable: true })
  venueName?: string | null;

  @Column({ name: 'location_detail', type: 'text', nullable: true })
  locationDetail?: string | null;

  @Column({ type: 'text', default: 'SCHEDULED' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
