import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const userIdHeader = (req.headers['x-user-id'] as string) || '';
    const userId = userIdHeader.trim();
    if (userId) {
      return `user:${userId}`;
    }
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const ip = forwarded.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
