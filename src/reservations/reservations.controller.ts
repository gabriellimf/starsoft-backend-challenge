import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  async reserve(@Body() dto: CreateReservationDto) {
    return this.reservationsService.reserve(
      dto.userId,
      dto.sessionId,
      dto.seatIds,
      dto.ttlSeconds ?? 30,
    );
  }

  @Post(':id/confirm-payment')
  async confirm(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.reservationsService.confirmPayment(id, body.userId);
  }
}
