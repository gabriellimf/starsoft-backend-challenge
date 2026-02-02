import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Reservation, Sale } from '../src/reservations/reservation.entity';
import { ReservationsService } from '../src/reservations/reservations.service';
import { Seat } from '../src/sessions/seat.entity';
import { Session } from '../src/sessions/session.entity';
import { KafkaService } from '../src/shared/kafka/kafka.service';
import { LockService } from '../src/shared/locks/locks.service';
import { MetricsService } from '../src/metrics/metrics.service';

class InMemoryManager {
  reservations: any[] = [];
  sales: any[] = [];
  session = { id: 's1', price: '25.00' };

  async findBy(cls: any, where: any) {
    if (cls === Sale) {
      return this.sales.filter(
        (s) => where.seatId.value.includes(s.seatId) && s.sessionId === where.sessionId,
      );
    }
    return [];
  }

  async find(cls: any, opts: any) {
    if (cls === Reservation) {
      const clause = Array.isArray(opts.where) ? opts.where[0] : opts.where;
      const seatIds = clause.seatId?.value || clause.seatId || [];
      const sessionId = clause.sessionId;
      return this.reservations.filter(
        (r) => seatIds.includes(r.seatId) && r.sessionId === sessionId && r.status === 'PENDING',
      );
    }
    return [];
  }

  async findOne(cls: any, opts: any) {
    if (cls === Reservation) {
      return this.reservations.find((r) => r.id === opts.where.id) || null;
    }
    return null;
  }

  async findOneByOrFail(cls: any, where: any) {
    if (cls === Session) return this.session;
    throw new Error('not found');
  }

  async save(obj: any) {
    if (Array.isArray(obj)) {
      obj.forEach((o) => {
        o.id = o.id || `r-${Math.random().toString(16).slice(2)}`;
        this.reservations.push(o);
      });
      return obj;
    }
    if (obj && obj.reservationId && obj.seatId) {
      obj.id = obj.id || `sale-${Math.random().toString(16).slice(2)}`;
      this.sales.push(obj);
      return obj;
    }
    const idx = this.reservations.findIndex((r) => r.id === obj.id);
    if (idx >= 0) this.reservations[idx] = obj;
    return obj;
  }

  create(_cls: any, o: any) {
    return { ...o };
  }
}

class FakeLockService {
  private locks = new Set<string>();
  async withLocks(keys: string[], _ttlMs: number, fn: () => Promise<any>) {
    const resources = [...keys].sort().map((k) => `lock:${k}`);
    const key = resources.join('|');
    while (this.locks.has(key)) {
      await new Promise((r) => setTimeout(r, 1));
    }
    this.locks.add(key);
    try {
      const result = await fn();
      await new Promise((r) => setTimeout(r, 15));
      return result;
    } finally {
      this.locks.delete(key);
    }
  }
}

describe('ReservationsService concurrency', () => {
  it('prevents double reservation for the same seat (simulated concurrency)', async () => {
    const manager = new InMemoryManager();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: async (fn: any) => fn(manager),
          },
        },
        { provide: LockService, useValue: new FakeLockService() },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        {
          provide: getRepositoryToken(Seat),
          useValue: { find: async () => [{ id: 'seat-1', sessionId: 's1', code: 'S1' }] },
        },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);

    const res1 = await svc.reserve('user1', 's1', ['seat-1'], 30);
    await expect(svc.reserve('user2', 's1', ['seat-1'], 30)).rejects.toThrow(
      /reserved|sold/,
    );
    expect(res1.reservationIds).toHaveLength(1);
  });
});
