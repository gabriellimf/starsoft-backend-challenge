import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Reservation, Sale } from '../src/reservations/reservation.entity';
import { ReservationsService } from '../src/reservations/reservations.service';
import { Seat } from '../src/sessions/seat.entity';
import { Session } from '../src/sessions/session.entity';
import { KafkaService } from '../src/shared/kafka/kafka.service';
import { LockService } from '../src/shared/locks/locks.service';

describe('ReservationsService', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findBy: () => [],
                find: () => [],
                findOne: () => null,
                findOneByOrFail: () => ({ price: '25.00' }),
                save: async (x: any) => x,
                create: (_: any, o: any) => o,
              }),
          },
        },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        {
          provide: getRepositoryToken(Sale),
          useValue: { findBy: async () => [], save: async (x: any) => x },
        },
        {
          provide: getRepositoryToken(Seat),
          useValue: { find: async () => [{ id: 'seat-1', sessionId: 's1', code: 'S1' }] },
        },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
  });

  it('reserves a seat when available', async () => {
    const result = await service.reserve('user1', 's1', ['seat-1'], 30);
    expect(result.reservationIds).toHaveLength(1);
  });
});
