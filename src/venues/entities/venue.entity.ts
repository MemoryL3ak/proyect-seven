import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'venues', schema: 'logistics' })
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'text', nullable: true })
  region?: string | null;

  @Column({ type: 'text', nullable: true })
  commune?: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
