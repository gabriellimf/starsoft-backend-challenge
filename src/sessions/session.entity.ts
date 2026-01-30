import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Seat } from './seat.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  movieTitle!: string;

  @Column('timestamptz')
  startTime!: Date;

  @Column()
  room!: string;

  @Column('numeric', { precision: 10, scale: 2 })
  price!: string;

  @OneToMany(() => Seat, (seat) => seat.session, { cascade: true })
  seats!: Seat[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
