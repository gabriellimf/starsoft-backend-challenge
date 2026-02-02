import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AvailabilityService } from '../src/sessions/sessionsAvailability.service';
import { Seat } from '../src/sessions/seat.entity';
import { Reservation } from '../src/reservations/reservation.entity';

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  beforeEach(async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 60_000);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Seat),
          useValue: {
            find: async () => [
              { id: 'seat1', sessionId: 's1', code: 'S1' },
              { id: 'seat2', sessionId: 's1', code: 'S2' },
            ],
          },
        },
        {
          provide: getRepositoryToken(Reservation),
          useValue: {
            find: async () => [
              { sessionId: 's1', seatId: 'seat1', status: 'CONFIRMED', expiresAt: future },
              { sessionId: 's1', seatId: 'seat2', status: 'PENDING', expiresAt: future },
            ],
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AvailabilityService);
  });

  it('maps seat statuses to SOLD and RESERVED correctly', async () => {
    const res = await service.getAvailability('s1');
    expect(res.items.find((i: any) => i.seatId === 'seat1')?.status).toBe('SOLD');
    expect(res.items.find((i: any) => i.seatId === 'seat2')?.status).toBe('RESERVED');
  });
});
