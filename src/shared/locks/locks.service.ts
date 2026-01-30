import { Inject, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Redlock = require('redlock').default;

import type Redis from 'ioredis';

@Injectable()
export class LockService {
  private redlock: any;

  constructor(@Inject('REDIS') redis: Redis) {
    this.redlock = new Redlock([redis], {
      retryCount: 4,
      retryDelay: 75,
      retryJitter: 50,
    });
  }

  async withLocks<T>(keys: string[], ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const sorted = [...keys].sort();
    const resources = sorted.map((k) => `lock:${k}`);
    const lock = await this.redlock.acquire(resources, ttlMs);
    try {
      const result = await fn();
      return result;
    } finally {
      try {
        await lock.release();
      } catch {
        // ignore release errors
      }
    }
  }
}
