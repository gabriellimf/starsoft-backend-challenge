import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { CreateSessionDto } from './dto/create-session.dto';
import { Seat } from './seat.entity';
import { Session } from './session.entity';

@Injectable()
export class SessionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Session) private readonly sessionsRepo: Repository<Session>,
    @InjectRepository(Seat) private readonly seatsRepo: Repository<Seat>,
  ) {}

  async createSession(dto: CreateSessionDto) {
    if (dto.seatsCount < 16) {
      throw new BadRequestException('seatsCount must be at least 16');
    }
    return this.dataSource.transaction(async (manager) => {
      const session = manager.create(Session, {
        movieTitle: dto.movieTitle,
        startTime: new Date(dto.startTime),
        room: dto.room,
        price: String(dto.price),
      });
      await manager.save(session);

      const seats: Seat[] = [];
      for (let i = 1; i <= dto.seatsCount; i++) {
        seats.push(manager.create(Seat, { sessionId: session.id, code: `S${i}` }));
      }
      await manager.save(seats);

      return session;
    });
  }

  async findById(id: string) {
    const session = await this.sessionsRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }
}
