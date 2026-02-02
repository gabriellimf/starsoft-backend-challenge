import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { KafkaService } from './kafka.service';

@Global()
@Module({
  providers: [
    KafkaService,
    {
      provide: 'KAFKA_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        clientId: config.get<string>('KAFKA.CLIENT_ID'),
        brokers: config.get<string[]>('KAFKA.BROKERS'),
        mock: config.get<boolean>('KAFKA.MOCK'),
        dlqTopic: config.get<string>('KAFKA.DLQ_TOPIC') || 'cinema-dlq',
      }),
    },
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
