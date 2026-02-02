import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';

class FakeCache {}

function makeContextNoKey(method = 'GET') {
  const req: any = { method, originalUrl: '/reservations', headers: {} };
  const res: any = { setHeader: (_k: string, _v: string) => {} };
  const ctx: any = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as ExecutionContext;
  return ctx;
}

describe('IdempotencyInterceptor (no key)', () => {
  it('passes through when no Idempotency-Key or method not POST', async () => {
    const interceptor = new IdempotencyInterceptor(new FakeCache() as any);
    const ctx = makeContextNoKey('GET');
    const next: CallHandler = { handle: () => of({ ok: true }) } as any;
    const res = await new Promise<any>((resolve) =>
      interceptor.intercept(ctx, next).subscribe(resolve),
    );
    expect(res).toEqual({ ok: true });
  });
});
