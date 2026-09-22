import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AccommodationCoordinatorDto } from '../dto/create-accommodation.dto';

@Entity({ name: 'accommodations', schema: 'logistics' })
export class Accommodation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'accommodation_type', length: 20, default: 'HOTEL' })
  accommodationType: string;

  @Column({ length: 50, type: 'varchar', nullable: true })
  tower?: string | null;

  @Column({ length: 200, type: 'varchar', nullable: true })
  address?: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl?: string | null;

  @Column({
    name: 'geo_location',
    type: 'geometry',
    nullable: true,
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  geoLocation?: unknown | null;

  @Column({ name: 'total_capacity', type: 'int', default: 0 })
  totalCapacity: number;

  @Column({ name: 'room_inventory', type: 'jsonb', default: () => "'{}'::jsonb" })
  roomInventory: Record<string, number>;

  @Column({ name: 'bed_inventory', type: 'jsonb', default: () => "'{}'::jsonb" })
  bedInventory: Record<string, number>;

  @Column({ name: 'check_in', type: 'timestamptz', nullable: true })
  checkIn?: Date | string | null;

  @Column({ name: 'check_out', type: 'timestamptz', nullable: true })
  checkOut?: Date | string | null;

  /**
   * Coordinadores y apoyos del hotel. Es una lista y no un par de columnas
   * como en las sedes porque la planilla de operaciones tiene hoteles con dos
   * coordinadores y con gente de apoyo por turno.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  coordinators: AccommodationCoordinatorDto[];

  /**
   * Deportes que se alojan acá. No es una columna: se calcula en el listado
   * desde la planilla de distribución (logistics.delegation_hotels), igual
   * que las disciplinas de una sede, que sí son columna propia.
   */
  disciplineIds?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
