import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Session } from './session.entity';

@Entity('seats')
@Index(['sessionId', 'code'], { unique: true })
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sessionId!: string;

  @ManyToOne(() => Session, (session) => session.seats, { onDelete: 'CASCADE' })
  session!: Session;

  @Column()
  code!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
