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

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

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
