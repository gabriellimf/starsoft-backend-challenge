import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { Reservation } from '../reservations/reservation.entity';

import { Seat } from './seat.entity';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Seat) private readonly seatsRepo: Repository<Seat>,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
  ) {}

  async getAvailability(sessionId: string) {
    const seats = await this.seatsRepo.find({ where: { sessionId } });
    const now = new Date();
    const reservations = await this.reservationsRepo.find({
      where: [
        { sessionId, status: 'PENDING', expiresAt: MoreThan(now) },
        { sessionId, status: 'CONFIRMED' },
      ],
    });
    const bySeat = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const arr = bySeat.get(r.seatId) || [];
      arr.push(r);
      bySeat.set(r.seatId, arr);
    }
    const items = seats.map((seat) => {
      const r = bySeat.get(seat.id) || [];
      const confirmed = r.find((x) => x.status === 'CONFIRMED');
      if (confirmed) return { seatId: seat.id, code: seat.code, status: 'SOLD' };
      const pending = r.find((x) => x.status === 'PENDING' && x.expiresAt > now);
      if (pending)
        return {
          seatId: seat.id,
          code: seat.code,
          status: 'RESERVED',
          expiresAt: pending.expiresAt,
        };
      return { seatId: seat.id, code: seat.code, status: 'AVAILABLE' };
    });
    return { sessionId, items };
  }
}
