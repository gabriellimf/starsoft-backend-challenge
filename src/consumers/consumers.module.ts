import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';

import { ConsumersService } from './consumers.service';

@Module({
  imports: [MetricsModule],
  providers: [ConsumersService],
})
export class ConsumersModule {}
