import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ReservationsService } from '../reservations.service';

@Injectable()
export class ExpirationProcessor {
  private readonly logger = new Logger(ExpirationProcessor.name);

  constructor(private readonly reservationsService: ReservationsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleExpiration() {
    const count = await this.reservationsService.expirePending(new Date());
    if (count > 0) {
      this.logger.log(`Expired ${count} reservations`);
    }
  }
}
