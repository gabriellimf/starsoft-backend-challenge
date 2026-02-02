import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Seat } from '../sessions/seat.entity';
import { Session } from '../sessions/session.entity';

import { Reservation, Sale } from './reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ExpirationProcessor } from './tasks/expiration.processor';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Sale, Seat, Session]),
    ScheduleModule.forRoot(),
    MetricsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ExpirationProcessor],
  exports: [ReservationsService],
})
export class ReservationsModule {}
