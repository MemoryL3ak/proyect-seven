import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'trip_messages', schema: 'transport' })
export class TripMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'sender_type', type: 'varchar', length: 20 })
  senderType: 'DRIVER' | 'PASSENGER';

  @Column({ name: 'sender_name', type: 'varchar', length: 150 })
  senderName: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
