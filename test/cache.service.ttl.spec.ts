import { CacheService } from '../src/shared/cache/cache.service';

describe('CacheService with TTL', () => {
  it('sets value with ttl', async () => {
    const redis: any = {
      setArgs: [] as any[],
      get: async () => null,
      set: async function (key: string, val: string, ex?: string, ttl?: number) {
        this.setArgs.push([key, val, ex, ttl]);
      },
      del: async () => {},
      quit: async () => {},
    };
    const cache = new CacheService(redis);
    await cache.set('foo', { a: 1 }, 60);
    expect(redis.setArgs[0][2]).toBe('EX');
    expect(redis.setArgs[0][3]).toBe(60);
  });
});
