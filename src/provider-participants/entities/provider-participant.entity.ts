import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'provider_participants', schema: 'core' })
export class ProviderParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ length: 30, type: 'varchar', nullable: true })
  rut?: string | null;

  @Column({ name: 'country_code', type: 'char', length: 3, nullable: true })
  countryCode?: string | null;

  @Column({ name: 'passport_number', type: 'text', nullable: true })
  passportNumber?: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: Date | null;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ name: 'user_type', type: 'text', nullable: true })
  userType?: string | null;

  @Column({ name: 'visa_required', type: 'boolean', nullable: true })
  visaRequired?: boolean | null;

  @Column({ name: 'trip_type', type: 'text', nullable: true })
  tripType?: string | null;

  @Column({ name: 'flight_number', type: 'text', nullable: true })
  flightNumber?: string | null;

  @Column({ type: 'text', nullable: true })
  airline?: string | null;

  @Column({ type: 'text', nullable: true })
  origin?: string | null;

  @Column({ name: 'arrival_time', type: 'timestamptz', nullable: true })
  arrivalTime?: Date | null;

  @Column({ name: 'departure_time', type: 'timestamptz', nullable: true })
  departureTime?: Date | null;

  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  @Column({ length: 32, default: 'REGISTERED' })
  status: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
