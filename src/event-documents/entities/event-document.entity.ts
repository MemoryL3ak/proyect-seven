import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Públicos que pueden ver un documento en los portales. */
export type DocumentAudience = 'PARTICIPANTE' | 'VIP' | 'CONDUCTOR';

@Entity({ name: 'event_documents', schema: 'core' })
export class EventDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** null = visible en todos los eventos. */
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string | null;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 60, default: 'INFORMATIVO' })
  category: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName?: string | null;

  @Column({ name: 'content_type', type: 'varchar', length: 120, nullable: true })
  contentType?: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes?: number | null;

  @Column({ type: 'text', array: true, default: () => `array['PARTICIPANTE','VIP','CONDUCTOR']` })
  audiences: DocumentAudience[];

  @Column({ type: 'boolean', default: true })
  published: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
