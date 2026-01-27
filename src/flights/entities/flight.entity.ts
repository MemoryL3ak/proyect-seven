import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'flights', schema: 'logistics' })
export class Flight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'flight_number', length: 20 })
  flightNumber: string;

  @Column({ length: 100 })
  airline: string;

  @Column({ name: 'arrival_time', type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ length: 100 })
  origin: string;

  @Column({ length: 50, nullable: true })
  terminal?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
