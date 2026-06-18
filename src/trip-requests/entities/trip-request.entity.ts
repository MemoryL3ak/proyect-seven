import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Solicitud de viaje T1/VIP originada desde la app.
 * Tabla propia (transport.trip_requests), independiente de transport.trips.
 */
@Entity({ name: 'trip_requests', schema: 'transport' })
export class TripRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'client_type', length: 10, type: 'varchar' })
  clientType: string;

  @Column({ length: 32, default: 'REQUESTED' })
  status: string;

  @Column({ name: 'requester_athlete_id', type: 'uuid', nullable: true })
  requesterAthleteId?: string | null;

  @Column({ length: 150, type: 'varchar', nullable: true })
  origin?: string | null;

  @Column({ length: 150, type: 'varchar', nullable: true })
  destination?: string | null;

  @Column({ name: 'destination_venue_id', type: 'uuid', nullable: true })
  destinationVenueId?: string | null;

  @Column({ name: 'destination_hotel_id', type: 'uuid', nullable: true })
  destinationHotelId?: string | null;

  @Column({ name: 'requested_vehicle_type', length: 60, type: 'varchar', nullable: true })
  requestedVehicleType?: string | null;

  @Column({ name: 'passenger_count', type: 'int', nullable: true })
  passengerCount?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ name: 'passenger_lat', type: 'float', nullable: true })
  passengerLat?: number | null;

  @Column({ name: 'passenger_lng', type: 'float', nullable: true })
  passengerLng?: number | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'requested_at', type: 'timestamptz', nullable: true })
  requestedAt?: Date | null;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId?: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null;

  @Column({ name: 'vehicle_plate', length: 20, type: 'varchar', nullable: true })
  vehiclePlate?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
