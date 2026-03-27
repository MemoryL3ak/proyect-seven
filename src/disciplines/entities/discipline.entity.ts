import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disciplines', schema: 'core' })
export class Discipline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string | null;

  @Column({ type: 'text', nullable: true })
  category?: string | null;

  @Column({ type: 'text', nullable: true })
  gender?: string | null;

  /** UUID del deporte padre (null = es un deporte raíz) */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  /** Fecha y hora programada de la prueba */
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  /** Nombre del recinto donde se realiza */
  @Column({ name: 'venue_name', type: 'text', nullable: true })
  venueName?: string | null;
}
