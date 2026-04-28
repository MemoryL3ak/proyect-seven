import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'support_chats', schema: 'core' })
export class SupportChat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string | null;

  @Column({ name: 'origin_type', type: 'text' })
  originType: string;

  @Column({ name: 'origin_id', type: 'uuid' })
  originId: string;

  @Column({ name: 'origin_name', type: 'text' })
  originName: string;

  @Column({ type: 'text', default: 'QUERY' })
  category: string;

  @Column({ type: 'text', default: 'NORMAL' })
  priority: string;

  @Column({ type: 'text', nullable: true })
  subject?: string | null;

  @Column({ type: 'text', default: 'OPEN' })
  status: string;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId?: string | null;

  @Column({ name: 'agent_name', type: 'text', nullable: true })
  agentName?: string | null;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt?: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt: Date;

  @Column({ name: 'last_message_preview', type: 'text', nullable: true })
  lastMessagePreview?: string | null;
}
