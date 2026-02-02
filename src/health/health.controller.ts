import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      time: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }

  @Get('readiness')
  readiness() {
    return { status: 'ok' };
  }
}
