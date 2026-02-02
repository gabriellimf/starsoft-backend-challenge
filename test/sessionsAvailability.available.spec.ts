import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AvailabilityService } from '../src/sessions/sessionsAvailability.service';
import { Seat } from '../src/sessions/seat.entity';
import { Reservation } from '../src/reservations/reservation.entity';

describe('AvailabilityService AVAILABLE branch', () => {
  it('marks seat as AVAILABLE when no reservations', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: getRepositoryToken(Seat),
          useValue: { find: async () => [{ id: 'seatA', sessionId: 's1', code: 'SA' }] },
        },
        { provide: getRepositoryToken(Reservation), useValue: { find: async () => [] } },
      ],
    }).compile();

    const svc = moduleRef.get(AvailabilityService);
    const res = await svc.getAvailability('s1');
    expect(res.items[0].status).toBe('AVAILABLE');
  });
});
