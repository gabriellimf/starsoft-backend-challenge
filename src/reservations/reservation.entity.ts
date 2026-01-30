import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Seat } from '../sessions/seat.entity';
import { Session } from '../sessions/session.entity';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

@Entity('reservations')
@Index(['seatId', 'status'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  sessionId!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  session!: Session;

  @Column()
  seatId!: string;

  @ManyToOne(() => Seat, { onDelete: 'CASCADE' })
  seat!: Seat;

  @Column({ type: 'varchar' })
  status!: ReservationStatus;

  @Column('timestamptz')
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('sales')
@Index(['seatId'], { unique: true })
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  reservationId!: string;

  @OneToOne(() => Reservation)
  @JoinColumn({ name: 'reservationId' })
  reservation!: Reservation;

  @Column()
  sessionId!: string;

  @Column()
  seatId!: string;

  @Column('numeric', { precision: 10, scale: 2 })
  price!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
