import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'vehicles', schema: 'transport' })
export class Transport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ length: 20 })
  plate: string;

  @Column({ length: 60 })
  type: string;

  @Column({ length: 60, type: 'varchar', nullable: true })
  brand?: string | null;

  @Column({ length: 60, type: 'varchar', nullable: true })
  model?: string | null;

  @Column({ type: 'int', default: 0 })
  capacity: number;

  @Column({ length: 32, default: 'AVAILABLE' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
