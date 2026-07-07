import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'vehicle_positions', schema: 'telemetry' })
export class VehiclePosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  // The driver's active trip at the moment this fix was recorded, if any.
  // Stamped server-side at ingest so the app doesn't need to know the trip.
  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null;

  @Column({ name: 'timestamp', type: 'timestamptz' })
  timestamp: Date;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: unknown;

  @Column({ type: 'float', nullable: true })
  speed?: number | null;

  @Column({ type: 'float', nullable: true })
  heading?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
