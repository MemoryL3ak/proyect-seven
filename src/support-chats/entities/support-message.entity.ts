import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'support_messages', schema: 'core' })
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @Column({ name: 'sender_type', type: 'text' })
  senderType: string;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId?: string | null;

  @Column({ name: 'sender_name', type: 'text', nullable: true })
  senderName?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attachments: unknown[];

  @Column({ name: 'is_internal_note', type: 'boolean', default: false })
  isInternalNote: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
