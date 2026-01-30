import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disciplines', schema: 'core' })
export class Discipline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;
}
