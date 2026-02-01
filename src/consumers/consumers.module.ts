import { Module } from '@nestjs/common';

import { ConsumersService } from './consumers.service';

@Module({
  providers: [ConsumersService],
})
export class ConsumersModule {}
