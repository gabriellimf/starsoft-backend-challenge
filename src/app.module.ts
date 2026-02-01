import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { ReservationsModule } from './reservations/reservations.module';
import { SessionsModule } from './sessions/sessions.module';
import { CacheModule as RedisCacheModule } from './shared/cache/cache.module';
import configuration from './shared/config/configuration';
import { DatabaseModule } from './shared/database/database.module';
import { KafkaModule } from './shared/kafka/kafka.module';
import { LocksModule } from './shared/locks/locks.module';
import { LoggingModule } from './shared/logging/logging.module';
import { UsersModule } from './users/users.module';
import { ElasticsearchModule } from './shared/elasticsearch/elasticsearch.module';
import { EmailModule } from './shared/email/email.module';
import { ConsumersModule } from './consumers/consumers.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggingModule,
    DatabaseModule,
    TypeOrmModule.forFeature([]),
    RedisCacheModule,
    KafkaModule,
    LocksModule,
  UsersModule,
  ElasticsearchModule,
  EmailModule,
  ConsumersModule,
    MetricsModule,
    SessionsModule,
    ReservationsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
