import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'athletes', schema: 'core' })
export class Athlete {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'delegation_id', type: 'uuid', nullable: true })
  delegationId?: string | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'email', nullable: true })
  email?: string | null;

  @Column({ name: 'country_code', type: 'char', length: 3, nullable: true })
  countryCode?: string | null;

  @Column({ name: 'passport_number', nullable: true })
  passportNumber?: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: Date | null;

  @Column({ name: 'dietary_needs', nullable: true })
  dietaryNeeds?: string | null;

  @Column({ name: 'luggage_type', nullable: true })
  luggageType?: string | null;

  @Column({ name: 'user_type', nullable: true })
  userType?: string | null;

  @Column({ name: 'arrival_flight_id', type: 'uuid', nullable: true })
  arrivalFlightId?: string | null;

  @Column({ name: 'arrival_time', type: 'timestamptz', nullable: true })
  arrivalTime?: Date | null;

  @Column({ name: 'hotel_accommodation_id', type: 'uuid', nullable: true })
  hotelAccommodationId?: string | null;

  @Column({ name: 'room_number', nullable: true })
  roomNumber?: string | null;

  @Column({ name: 'room_type', nullable: true })
  roomType?: string | null;

  @Column({ name: 'bed_type', nullable: true })
  bedType?: string | null;

  @Column({ name: 'is_delegation_lead', type: 'boolean', default: false })
  isDelegationLead: boolean;

  @Column({ name: 'transport_trip_id', type: 'uuid', nullable: true })
  transportTripId?: string | null;

  @Column({ name: 'transport_vehicle_id', type: 'uuid', nullable: true })
  transportVehicleId?: string | null;

  @Column({ name: 'airport_checkin_at', type: 'timestamptz', nullable: true })
  airportCheckinAt?: Date | null;

  @Column({ name: 'hotel_checkin_at', type: 'timestamptz', nullable: true })
  hotelCheckinAt?: Date | null;

  @Column({ name: 'hotel_checkout_at', type: 'timestamptz', nullable: true })
  hotelCheckoutAt?: Date | null;

  @Column({ length: 32, default: 'REGISTERED' })
  status: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
