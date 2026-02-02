import { LockService } from '../src/shared/locks/locks.service';

describe('LockService', () => {
  it('executes function within locks and releases', async () => {
    const fakeRedis: any = {};
    const svc = new LockService(fakeRedis);
    (svc as any).redlock = {
      acquire: async (_resources: string[], _ttl: number) => ({
        release: async () => {},
      }),
    };
    const res = await svc.withLocks(['a', 'b'], 1000, async () => 42);
    expect(res).toBe(42);
  });
});
