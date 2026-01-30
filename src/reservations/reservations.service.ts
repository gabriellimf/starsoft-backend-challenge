import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';

import { Seat } from '../sessions/seat.entity';
import { Session } from '../sessions/session.entity';
import { KafkaService } from '../shared/kafka/kafka.service';
import { LockService } from '../shared/locks/locks.service';

import { Reservation, Sale } from './reservation.entity';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly locks: LockService,
    private readonly kafka: KafkaService,
    @InjectRepository(Reservation) private readonly reservationsRepo: Repository<Reservation>,
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    @InjectRepository(Seat) private readonly seatsRepo: Repository<Seat>,
    @InjectRepository(Session) private readonly sessionsRepo: Repository<Session>,
  ) {}

  async reserve(userId: string, sessionId: string, seatIds: string[], ttlSeconds = 30) {
    const seats = await this.seatsRepo.find({ where: { id: In(seatIds), sessionId } });
    if (seats.length !== seatIds.length) {
      throw new BadRequestException('One or more seats not found in session');
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const lockKeys = seatIds.map((id) => `session:${sessionId}:seat:${id}`);
    return this.locks.withLocks(lockKeys, 2000, async () => {
      return this.dataSource.transaction(async (manager) => {
        const sold = await manager.findBy(Sale, { seatId: In(seatIds), sessionId });
        if (sold.length > 0) {
          throw new BadRequestException('One or more seats already sold');
        }

        const active = await manager.find(Reservation, {
          where: { seatId: In(seatIds), sessionId, status: 'PENDING', expiresAt: MoreThan(now) },
        });
        if (active.length > 0) {
          throw new BadRequestException('One or more seats already reserved');
        }

        const reservations = seatIds.map((seatId) =>
          manager.create(Reservation, {
            userId,
            sessionId,
            seatId,
            status: 'PENDING' as const,
            expiresAt,
          }),
        );
        const saved = await manager.save(reservations);
        await this.kafka.publish('reservation.created', {
          sessionId,
          userId,
          reservationIds: saved.map((r) => r.id),
          seatIds,
          expiresAt,
        });
        return { reservationIds: saved.map((r) => r.id), expiresAt };
      });
    });
  }

  async confirmPayment(reservationId: string, userId: string) {
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const r = await manager.findOne(Reservation, { where: { id: reservationId } });
      if (!r) throw new NotFoundException('Reservation not found');
      if (r.userId !== userId) throw new BadRequestException('Reservation does not belong to user');
      if (r.status !== 'PENDING') throw new BadRequestException('Reservation is not pending');
      if (r.expiresAt <= now) throw new BadRequestException('Reservation expired');

      const session = await manager.findOneByOrFail(Session, { id: r.sessionId });
      const sale = manager.create(Sale, {
        userId,
        reservationId: r.id,
        sessionId: r.sessionId,
        seatId: r.seatId,
        price: session.price,
      });
      await manager.save(sale);

      r.status = 'CONFIRMED';
      await manager.save(r);

      await this.kafka.publish('payment.confirmed', {
        reservationId: r.id,
        sessionId: r.sessionId,
        seatId: r.seatId,
        userId,
      });
      return { saleId: sale.id };
    });
  }

  async expirePending(now = new Date()) {
    const expired = await this.reservationsRepo.find({
      where: { status: 'PENDING', expiresAt: MoreThan(new Date(0)) },
    });
    const toExpire = expired.filter((r) => r.expiresAt <= now);
    if (toExpire.length === 0) return 0;
    for (const r of toExpire) {
      r.status = 'EXPIRED';
      await this.reservationsRepo.save(r);
      await this.kafka.publish('reservation.expired', {
        reservationId: r.id,
        sessionId: r.sessionId,
        seatId: r.seatId,
      });
    }
    return toExpire.length;
  }
}
