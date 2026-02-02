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
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
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

  it('fails to reserve when seat already reserved', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findBy: () => [],
                find: () => [
                  {
                    seatId: 'seat-1',
                    sessionId: 's1',
                    status: 'PENDING',
                    expiresAt: new Date(Date.now() + 10000),
                  },
                ],
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
    await expect(svc.reserve('user1', 's1', ['seat-1'], 30)).rejects.toThrow(
      'One or more seats already reserved',
    );
  });

  it('fails to reserve when seat already sold', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findBy: () => [{ seatId: 'seat-1', sessionId: 's1' }],
                find: () => [],
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
    await expect(svc.reserve('user1', 's1', ['seat-1'], 30)).rejects.toThrow(
      'One or more seats already sold',
    );
  });

  it('confirms payment successfully', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findOne: async (_cls: any, opts: any) => ({
                  id: opts.where.id,
                  userId: 'user1',
                  status: 'PENDING',
                  expiresAt: new Date(Date.now() + 10000),
                  sessionId: 's1',
                  seatId: 'seat-1',
                }),
                findOneByOrFail: async () => ({ id: 's1', price: '25.00' }),
                save: async (obj: any) => {
                  if (obj && obj.reservationId && obj.seatId) {
                    obj.id = 'sale-1';
                  }
                  return obj;
                },
                create: (_cls: any, obj: any) => obj,
              }),
          },
        },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    const res = await svc.confirmPayment('r1', 'user1');
    expect(res.saleId).toBeDefined();
  });

  it('fails to reserve when seat not found in session', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: async (fn: any) =>
              fn({
                findBy: () => [],
                find: () => [],
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
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: { find: async () => [] } },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    await expect(svc.reserve('user1', 's1', ['missing-seat'], 30)).rejects.toThrow(
      'One or more seats not found in session',
    );
  });

  it('confirmPayment errors when status not PENDING', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findOne: async (_cls: any, opts: any) => ({
                  id: opts.where.id,
                  userId: 'user1',
                  status: 'CONFIRMED',
                  expiresAt: new Date(Date.now() + 10000),
                  sessionId: 's1',
                  seatId: 'seat-1',
                }),
                findOneByOrFail: async () => ({ id: 's1', price: '25.00' }),
                save: async (obj: any) => obj,
                create: (_cls: any, obj: any) => obj,
              }),
          },
        },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    await expect(svc.confirmPayment('r1', 'user1')).rejects.toThrow('Reservation is not pending');
  });

  it('expires pending reservations and publishes events', async () => {
    const now = new Date();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: DataSource, useValue: {} },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        {
          provide: getRepositoryToken(Reservation),
          useValue: {
            find: async () => [
              {
                id: 'r1',
                sessionId: 's1',
                seatId: 'seat-1',
                status: 'PENDING',
                expiresAt: new Date(now.getTime() - 1000),
              },
              {
                id: 'r2',
                sessionId: 's1',
                seatId: 'seat-2',
                status: 'PENDING',
                expiresAt: new Date(now.getTime() + 100000),
              },
            ],
            save: async (x: any) => x,
          },
        },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    const count = await svc.expirePending(now);
    expect(count).toBe(1);
  });

  it('confirmPayment errors when expired or wrong user', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findOne: async () => ({
                  id: 'r1',
                  userId: 'userX',
                  status: 'PENDING',
                  expiresAt: new Date(Date.now() - 1000),
                  sessionId: 's1',
                  seatId: 'seat-1',
                }),
                findOneByOrFail: async () => ({ id: 's1', price: '25.00' }),
                save: async (obj: any) => obj,
                create: (_cls: any, obj: any) => obj,
              }),
          },
        },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    await expect(svc.confirmPayment('r1', 'user1')).rejects.toThrow();
  });

  it('confirmPayment errors when reservation not found', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: DataSource,
          useValue: {
            transaction: (fn: any) =>
              fn({
                findOne: async () => null,
                findOneByOrFail: async () => ({ id: 's1', price: '25.00' }),
              }),
          },
        },
        {
          provide: LockService,
          useValue: { withLocks: async (_: string[], __: number, fn: any) => fn() },
        },
        { provide: KafkaService, useValue: { publish: async () => {} } },
        { provide: MetricsService, useValue: { incrementReservationEvent: (_: any) => {} } },
        { provide: getRepositoryToken(Reservation), useValue: {} },
        { provide: getRepositoryToken(Sale), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
        { provide: getRepositoryToken(Session), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(ReservationsService);
    await expect(svc.confirmPayment('missing', 'user1')).rejects.toThrow('Reservation not found');
  });
});
