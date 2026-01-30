import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import type Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
