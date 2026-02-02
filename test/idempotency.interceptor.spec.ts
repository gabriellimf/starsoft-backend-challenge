import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';

class FakeCache {
  store = new Map<string, any>();
  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) ?? null) as T | null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}

function makeContext(headers: Record<string, string>) {
  const req: any = { method: 'POST', originalUrl: '/reservations', headers };
  const resHeaders: Record<string, string> = {};
  const res: any = { setHeader: (k: string, v: string) => (resHeaders[k] = v) };
  const ctx: any = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as ExecutionContext;
  return { ctx, resHeaders };
}

describe('IdempotencyInterceptor', () => {
  it('caches response and replays on same Idempotency-Key', async () => {
    const cache = new FakeCache();
    const interceptor = new IdempotencyInterceptor(cache as any);

    const { ctx, resHeaders } = makeContext({ 'idempotency-key': 'abc123' });
    const next: CallHandler = { handle: () => of({ ok: true }) } as any;

    const first = await new Promise<any>((resolve) =>
      interceptor.intercept(ctx, next).subscribe(resolve),
    );
    expect(first).toEqual({ ok: true });

    const replayCtx = makeContext({ 'idempotency-key': 'abc123' }).ctx;
    const replay = await new Promise<any>((resolve) =>
      interceptor.intercept(replayCtx, next).subscribe(resolve),
    );
    expect(replay).toEqual({ ok: true });
    expect(resHeaders['Idempotency-Stored-In']).toBeDefined();
  });
});
