import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const path: string = req.path || req.originalUrl || req.url || '';
    if (path === '/metrics') {
      return next.handle();
    }

    const method: string = req.method || 'GET';
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const end = process.hrtime.bigint();
          const durationSeconds = Number(end - start) / 1e9;
          const statusCode = res.statusCode || 200;
          this.metrics.incrementRequest(method, path, statusCode);
          this.metrics.observeRequestDuration(method, path, statusCode, durationSeconds);
        },
        error: () => {
          const end = process.hrtime.bigint();
          const durationSeconds = Number(end - start) / 1e9;
          const statusCode = res.statusCode || 500;
          this.metrics.incrementRequest(method, path, statusCode);
          this.metrics.observeRequestDuration(method, path, statusCode, durationSeconds);
        },
      }),
    );
  }
}
