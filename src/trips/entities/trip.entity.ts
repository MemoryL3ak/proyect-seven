import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'trips', schema: 'transport' })
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ length: 150, nullable: true })
  destination?: string | null;

  @Column({ length: 150, nullable: true })
  origin?: string | null;

  @Column({ name: 'trip_type', length: 50, nullable: true })
  tripType?: string | null;

  @Column({ name: 'client_type', length: 50, nullable: true })
  clientType?: string | null;

  @Column({ length: 32, default: 'SCHEDULED' })
  status: string;

  @Column({
    name: 'route_geometry',
    type: 'geometry',
    nullable: true,
    spatialFeatureType: 'LineString',
    srid: 4326,
  })
  routeGeometry?: unknown | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  athleteIds?: string[];

  athleteNames?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
