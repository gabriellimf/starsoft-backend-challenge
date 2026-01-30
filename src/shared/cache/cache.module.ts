import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        return new Redis(url as string);
      },
    },
    CacheService,
  ],
  exports: ['REDIS', CacheService],
})
export class CacheModule {}
