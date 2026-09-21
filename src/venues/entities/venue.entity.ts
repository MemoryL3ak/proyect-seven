import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'venues', schema: 'logistics' })
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  /** SEDE (competencia) o COMEDOR: cambia dónde se ofrece y cómo se lista. */
  @Column({ name: 'venue_type', type: 'text', default: 'SEDE' })
  venueType: string;

  @Column({ type: 'text', nullable: true })
  region?: string | null;

  @Column({ type: 'text', nullable: true })
  commune?: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl?: string | null;

  /**
   * Deportes que se compiten en esta sede. Se asignan al editar la sede: antes
   * el portal los deducía calzando el nombre del recinto con `venue_name` de
   * las pruebas, y bastaba renombrar la sede para que se perdieran.
   */
  @Column({ name: 'discipline_ids', type: 'uuid', array: true, default: () => "'{}'::uuid[]" })
  disciplineIds: string[];

  // Coordinador de sede: lo ven los jefes de misión junto al Coordinador General.
  /**
   * Participante con rol COORDINADOR_SEDE a cargo del recinto. Los dos campos
   * de abajo son la copia de su ficha, para que quien ya los lee no tenga que
   * resolver la persona en una segunda consulta.
   */
  @Column({ name: 'coordinator_id', type: 'uuid', nullable: true })
  coordinatorId?: string | null;

  @Column({ name: 'coordinator_name', type: 'text', nullable: true })
  coordinatorName?: string | null;

  @Column({ name: 'coordinator_phone', type: 'text', nullable: true })
  coordinatorPhone?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
