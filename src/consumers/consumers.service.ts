import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CacheService } from '../shared/cache/cache.service';
import { ElasticsearchService } from '../shared/elasticsearch/elasticsearch.service';
import { EmailService } from '../shared/email/email.service';
import { KafkaService } from '../shared/kafka/kafka.service';

type ReservationCreated = {
  sessionId: string;
  userId: string;
  reservationIds: string[];
  seatIds: string[];
  expiresAt: string | Date;
};

type ReservationExpired = {
  reservationId: string;
  sessionId: string;
  seatId: string;
};

type PaymentConfirmed = {
  reservationId: string;
  sessionId: string;
  seatId: string;
  userId: string;
};

@Injectable()
export class ConsumersService implements OnModuleInit {
  private readonly logger = new Logger(ConsumersService.name);
  private readonly eventsIndex: string;
  private readonly emailTo?: string;

  constructor(
    private readonly kafka: KafkaService,
    private readonly cache: CacheService,
    private readonly es: ElasticsearchService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    this.eventsIndex = config.get<string>('ELASTIC_EVENTS_INDEX') || 'cinema-events';
    this.emailTo = config.get<string>('ALERTS_EMAIL_TO');
  }

  async onModuleInit() {
    await this.kafka.subscribe('reservation.created', (p) =>
      this.retry(() => this.onReservationCreated(p as ReservationCreated)),
    );
    await this.kafka.subscribe('reservation.expired', (p) =>
      this.retry(() => this.onReservationExpired(p as ReservationExpired)),
    );
    await this.kafka.subscribe('payment.confirmed', (p) =>
      this.retry(() => this.onPaymentConfirmed(p as PaymentConfirmed)),
    );
    this.logger.log('Kafka consumers registered');
  }

  private async retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 200): Promise<T> {
    let err: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        err = e;
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    this.logger.error(`Retry attempts exhausted: ${err?.message || err}`);
    throw err;
  }

  private async onReservationCreated(payload: ReservationCreated) {
    await this.cache.set(`session:${payload.sessionId}:lastReservationEvent`, payload, 60);

    await this.es.indexEvent(this.eventsIndex, {
      type: 'reservation.created',
      at: new Date().toISOString(),
      ...payload,
    });

    if (this.emailTo) {
      await this.email.send(
        this.emailTo,
        'Reservation created',
        `<p>Session ${payload.sessionId}: seats ${payload.seatIds.join(', ')} reserved by ${payload.userId}. Expires at ${payload.expiresAt}.</p>`,
      );
    }
  }

  private async onReservationExpired(payload: ReservationExpired) {
    await this.cache.set(`session:${payload.sessionId}:lastExpired`, payload, 60);
    await this.es.indexEvent(this.eventsIndex, {
      type: 'reservation.expired',
      at: new Date().toISOString(),
      ...payload,
    });
    if (this.emailTo) {
      await this.email.send(
        this.emailTo,
        'Reservation expired',
        `<p>Reservation ${payload.reservationId} expired (session ${payload.sessionId}, seat ${payload.seatId}).</p>`,
      );
    }
  }

  private async onPaymentConfirmed(payload: PaymentConfirmed) {
    await this.cache.set(`session:${payload.sessionId}:lastPayment`, payload, 60);
    await this.es.indexEvent(this.eventsIndex, {
      type: 'payment.confirmed',
      at: new Date().toISOString(),
      ...payload,
    });
    if (this.emailTo) {
      await this.email.send(
        this.emailTo,
        'Payment confirmed',
        `<p>Payment confirmed for reservation ${payload.reservationId}, seat ${payload.seatId}, user ${payload.userId}.</p>`,
      );
    }
  }
}
