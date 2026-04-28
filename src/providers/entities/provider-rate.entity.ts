import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'provider_rates', schema: 'core' })
export class ProviderRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_id', type: 'uuid' })
  providerId: string;

  @Column({ name: 'fleet_type', length: 30, type: 'varchar' })
  fleetType: string;

  @Column({ name: 'passenger_range', length: 30, type: 'varchar', nullable: true })
  passengerRange?: string | null;

  @Column({ name: 'trip_type', length: 40, type: 'varchar' })
  tripType: string;

  @Column({ name: 'client_price', type: 'numeric', default: 0 })
  clientPrice: number;

  @Column({ name: 'provider_price', type: 'numeric', default: 0 })
  providerPrice: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
