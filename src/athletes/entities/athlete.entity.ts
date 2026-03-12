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

  @Column({ name: 'discipline_id', type: 'uuid', nullable: true })
  disciplineId?: string | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'email', type: 'text', nullable: true })
  email?: string | null;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone?: string | null;

  @Column({ name: 'country_code', type: 'char', length: 3, nullable: true })
  countryCode?: string | null;

  @Column({ name: 'passport_number', type: 'text', nullable: true })
  passportNumber?: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: Date | null;

  @Column({ name: 'dietary_needs', type: 'text', nullable: true })
  dietaryNeeds?: string | null;

  @Column({ name: 'luggage_type', type: 'text', nullable: true })
  luggageType?: string | null;

  // Derived in the service for frontend compatibility until the migration is applied.
  luggageNotes?: string | null;

  @Column({ name: 'bolso_count', type: 'int', default: 0 })
  bolsoCount: number;

  @Column({ name: 'bag_8_count', type: 'int', default: 0 })
  bag8Count: number;

  @Column({ name: 'suitcase_10_count', type: 'int', default: 0 })
  suitcase10Count: number;

  @Column({ name: 'suitcase_15_count', type: 'int', default: 0 })
  suitcase15Count: number;

  @Column({ name: 'suitcase_23_count', type: 'int', default: 0 })
  suitcase23Count: number;

  @Column({ name: 'oversize_text', type: 'text', nullable: true })
  oversizeText?: string | null;

  @Column({ name: 'luggage_volume', type: 'text', nullable: true })
  luggageVolume?: string | null;

  @Column({ name: 'user_type', type: 'text', nullable: true })
  userType?: string | null;

  @Column({ name: 'visa_required', type: 'boolean', nullable: true })
  visaRequired?: boolean | null;

  @Column({ name: 'trip_type', type: 'text', nullable: true })
  tripType?: string | null;

  @Column({ name: 'arrival_flight_id', type: 'uuid', nullable: true })
  arrivalFlightId?: string | null;

  @Column({ name: 'flight_number', type: 'text', nullable: true })
  flightNumber?: string | null;

  @Column({ name: 'airline', type: 'text', nullable: true })
  airline?: string | null;

  @Column({ name: 'origin', type: 'text', nullable: true })
  origin?: string | null;

  @Column({ name: 'arrival_time', type: 'timestamptz', nullable: true })
  arrivalTime?: Date | null;

  @Column({ name: 'departure_time', type: 'timestamptz', nullable: true })
  departureTime?: Date | null;

  @Column({ name: 'departure_gate', type: 'text', nullable: true })
  departureGate?: string | null;

  @Column({ name: 'arrival_baggage', type: 'text', nullable: true })
  arrivalBaggage?: string | null;

  @Column({ name: 'hotel_accommodation_id', type: 'uuid', nullable: true })
  hotelAccommodationId?: string | null;

  @Column({ name: 'room_number', type: 'text', nullable: true })
  roomNumber?: string | null;

  @Column({ name: 'room_type', type: 'text', nullable: true })
  roomType?: string | null;

  @Column({ name: 'bed_type', type: 'text', nullable: true })
  bedType?: string | null;

  @Column({ name: 'wheelchair_user', type: 'boolean', default: false })
  wheelchairUser: boolean;

  @Column({ name: 'wheelchair_standard_count', type: 'int', default: 0 })
  wheelchairStandardCount: number;

  @Column({ name: 'wheelchair_sport_count', type: 'int', default: 0 })
  wheelchairSportCount: number;

  @Column({ name: 'sports_equipment', type: 'text', nullable: true })
  sportsEquipment?: string | null;

  @Column({ name: 'requires_assistance', type: 'boolean', default: false })
  requiresAssistance: boolean;

  @Column({ name: 'observations', type: 'text', nullable: true })
  observations?: string | null;

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

  @Column({ name: 'accreditation_status', type: 'text', default: 'PENDING' })
  accreditationStatus: string;

  @Column({
    name: 'accreditation_validated_at',
    type: 'timestamptz',
    nullable: true,
  })
  accreditationValidatedAt?: Date | null;

  @Column({ name: 'accreditation_validated_by', type: 'text', nullable: true })
  accreditationValidatedBy?: string | null;

  @Column({ name: 'accreditation_notes', type: 'text', nullable: true })
  accreditationNotes?: string | null;

  @Column({ name: 'credential_code', type: 'text', nullable: true })
  credentialCode?: string | null;

  @Column({ name: 'credential_issued_at', type: 'timestamptz', nullable: true })
  credentialIssuedAt?: Date | null;

  @Column({ name: 'credential_issued_by', type: 'text', nullable: true })
  credentialIssuedBy?: string | null;

  @Column({ length: 32, default: 'REGISTERED' })
  status: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
