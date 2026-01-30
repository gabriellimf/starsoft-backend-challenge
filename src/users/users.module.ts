import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from '../reservations/reservation.entity';

import { User } from './user.entity';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Sale])],
  controllers: [UsersController],
})
export class UsersModule {}
