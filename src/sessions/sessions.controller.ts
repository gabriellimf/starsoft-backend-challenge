import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';
import { AvailabilityService } from './sessionsAvailability.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Post()
  async create(@Body() dto: CreateSessionDto) {
    const session = await this.sessionsService.createSession(dto);
    return session;
  }

  @Get(':id/availability')
  async availability(@Param('id') id: string) {
    return this.availabilityService.getAvailability(id);
  }
}
