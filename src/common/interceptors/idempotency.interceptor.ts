import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { CacheService } from '../../shared/cache/cache.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { userId?: string }>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = (req.method || 'GET').toUpperCase();
    const path = req.originalUrl || req.url || '';
    const headerMap = (req.headers || {}) as Record<string, string | string[]>;
    const rawKey =
      (typeof (req as any).get === 'function'
        ? (req as any).get('Idempotency-Key')
        : headerMap['idempotency-key'] || headerMap['Idempotency-Key']) || undefined;
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || method !== 'POST') {
      return next.handle();
    }

    const cacheKey = `idem:${key}:${method}:${path}`;

    return from(this.cache.get<unknown>(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          res.setHeader('Idempotency-Replay', 'true');
          return from(Promise.resolve(cached));
        }

        const startedAt = Date.now();
        return next.handle().pipe(
          tap((data) => {
            void this.cache.set(cacheKey, data, 5 * 60);
            res.setHeader('Idempotency-Stored-In', `${Date.now() - startedAt}ms`);
          }),
        );
      }),
    );
  }
}
