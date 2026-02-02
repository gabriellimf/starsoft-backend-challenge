import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SessionsService } from '../src/sessions/sessions.service';
import { Session } from '../src/sessions/session.entity';
import { Seat } from '../src/sessions/seat.entity';

describe('SessionsService.findById', () => {
  it('returns session when found', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Session), useValue: { findOne: async () => ({ id: 's1' }) } },
        { provide: getRepositoryToken(Seat), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(SessionsService);
    const s = await svc.findById('s1');
    expect(s.id).toBe('s1');
  });

  it('throws NotFound when missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Session), useValue: { findOne: async () => null } },
        { provide: getRepositoryToken(Seat), useValue: {} },
      ],
    }).compile();

    const svc = moduleRef.get(SessionsService);
    await expect(svc.findById('missing')).rejects.toThrow('Session not found');
  });
});
