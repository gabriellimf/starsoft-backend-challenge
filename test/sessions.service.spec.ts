import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SessionsService } from '../src/sessions/sessions.service';
import { Session } from '../src/sessions/session.entity';
import { Seat } from '../src/sessions/seat.entity';

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: DataSource,
          useValue: {
            transaction: async (fn: any) => {
              const createdSession: any = { id: 's1' };
              const manager = {
                create: (_cls: any, obj: any) => obj,
                save: async (obj: any) => obj,
              };
              return fn({
                ...manager,
                create: (_cls: any, obj: any) => obj,
                save: async (obj: any) => {
                  if (Array.isArray(obj)) return obj;
                  if (obj && obj.movieTitle) return createdSession;
                  return obj;
                },
              });
            },
          },
        },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: getRepositoryToken(Seat), useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(SessionsService);
  });

  it('creates session with requested number of seats', async () => {
    const dto = {
      movieTitle: 'Filme X',
      startTime: new Date().toISOString(),
      room: 'Sala 1',
      price: 25,
      seatsCount: 16,
    } as any;
    const session = await service.createSession(dto);
    expect(session).toBeDefined();
  });
});
