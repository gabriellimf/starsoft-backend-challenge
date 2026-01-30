import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { CacheService } from '../../shared/cache/cache.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request & { userId?: string }>();
    const res = context.switchToHttp().getResponse();
    const method = (req.method || 'GET').toUpperCase();
    const path = (req as any).originalUrl || (req as any).url || '';
    const key = (req.headers as any)['idempotency-key'] as string | undefined;

    if (!key || method !== 'POST') {
      return next.handle();
    }

    const cacheKey = `idem:${key}:${method}:${path}`;

    return from(this.cache.get<any>(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          res.setHeader('Idempotency-Replay', 'true');
          return from(Promise.resolve(cached));
        }

        const startedAt = Date.now();
        return next.handle().pipe(
          tap(async (data) => {
            await this.cache.set(cacheKey, data, 5 * 60);
            res.setHeader('Idempotency-Stored-In', `${Date.now() - startedAt}ms`);
          }),
        );
      }),
    );
  }
}
