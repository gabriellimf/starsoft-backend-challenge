import { Injectable } from '@nestjs/common';
import pino, { Logger as PinoLoggerType } from 'pino';

@Injectable()
export class AppLogger {
  private readonly logger: PinoLoggerType;

  constructor() {
    this.logger = pino({
      level: process.env['LOG_LEVEL'] || 'info',
      base: { service: 'cinema-api' },
    });
  }

  child(bindings: Record<string, unknown>) {
    return this.logger.child(bindings);
  }

  debug(obj: unknown, msg?: string) {
    this.logger.debug(obj, msg);
  }
  info(obj: unknown, msg?: string) {
    this.logger.info(obj, msg);
  }
  warn(obj: unknown, msg?: string) {
    this.logger.warn(obj, msg);
  }
  error(obj: unknown, msg?: string) {
    this.logger.error(obj, msg);
  }
}
