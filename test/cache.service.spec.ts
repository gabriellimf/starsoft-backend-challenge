import { CacheService } from '../src/shared/cache/cache.service';

describe('CacheService', () => {
  it('sets, gets, and deletes values', async () => {
    const redis: any = {
      store: new Map<string, string>(),
      get: async function (key: string) {
        return this.store.get(key) ?? null;
      },
      set: async function (key: string, val: string) {
        this.store.set(key, val);
      },
      del: async function (key: string) {
        this.store.delete(key);
      },
      quit: async () => {},
    };
    const cache = new CacheService(redis);
    await cache.set('foo', { a: 1 });
    const val = await cache.get<any>('foo');
    expect(val).toEqual({ a: 1 });
    await cache.del('foo');
    const missing = await cache.get<any>('foo');
    expect(missing).toBeNull();
  });
});
