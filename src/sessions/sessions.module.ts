import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Reservation } from '../reservations/reservation.entity';

import { Seat } from './seat.entity';
import { Session } from './session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { AvailabilityService } from './sessionsAvailability.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Seat, Reservation])],
  controllers: [SessionsController],
  providers: [SessionsService, AvailabilityService],
  exports: [SessionsService],
})
export class SessionsModule {}
