import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';

class FakeCache {}

function makeContextPostNoKey() {
  const req: any = { method: 'POST', originalUrl: '/reservations', headers: {} };
  const res: any = { setHeader: (_k: string, _v: string) => {} };
  const ctx: any = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as ExecutionContext;
  return ctx;
}

describe('IdempotencyInterceptor POST without key', () => {
  it('passes through when POST without Idempotency-Key', async () => {
    const interceptor = new IdempotencyInterceptor(new FakeCache() as any);
    const ctx = makeContextPostNoKey();
    const next: CallHandler = { handle: () => of({ ok: true }) } as any;
    const res = await new Promise<any>((resolve) =>
      interceptor.intercept(ctx, next).subscribe(resolve),
    );
    expect(res).toEqual({ ok: true });
  });
});
