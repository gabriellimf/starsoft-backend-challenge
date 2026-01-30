import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from '../reservations/reservation.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
  ) {}

  @Get(':id/purchases')
  async purchases(@Param('id') id: string) {
    const sales = await this.salesRepo.find({ where: { userId: id } });
    return { userId: id, purchases: sales };
  }
}
