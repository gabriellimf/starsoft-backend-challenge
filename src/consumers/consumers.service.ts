import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CacheService } from '../shared/cache/cache.service';
import { ElasticsearchService } from '../shared/elasticsearch/elasticsearch.service';
import { EmailService } from '../shared/email/email.service';
import { KafkaService } from '../shared/kafka/kafka.service';
import { MetricsService } from '../metrics/metrics.service';

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

type SeatReleased = {
  reservationId: string;
  sessionId: string;
  seatId: string;
  reason: string;
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
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.eventsIndex = config.get<string>('ELASTIC_EVENTS_INDEX') || 'cinema-events';
    this.emailTo = config.get<string>('ALERTS_EMAIL_TO');
  }

  async onModuleInit() {
    await this.kafka.subscribe('reservation.created', (p) =>
      this.processWithRetry('reservation.created', p, () =>
        this.onReservationCreated(p as ReservationCreated),
      ),
    );
    await this.kafka.subscribe('reservation.expired', (p) =>
      this.processWithRetry('reservation.expired', p, () =>
        this.onReservationExpired(p as ReservationExpired),
      ),
    );
    await this.kafka.subscribe('payment.confirmed', (p) =>
      this.processWithRetry('payment.confirmed', p, () =>
        this.onPaymentConfirmed(p as PaymentConfirmed),
      ),
    );
    await this.kafka.subscribe('seat.released', (p) =>
      this.processWithRetry('seat.released', p, () => this.onSeatReleased(p as SeatReleased)),
    );
    await this.kafka.startConsuming();
    this.logger.log('Kafka consumers registered');
  }

  private async processWithRetry(
    topic: string,
    payload: any,
    handler: () => Promise<void>,
    attempts = 3,
    baseDelayMs = 200,
  ) {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        await handler();
        return;
      } catch (e: any) {
        lastErr = e;
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    const reason = lastErr?.message || 'processing_failed';
    this.logger.error(`Retry attempts exhausted for topic ${topic}: ${reason}`);
    await this.kafka.publish('cinema-dlq', {
      originalTopic: topic,
      failedAt: new Date().toISOString(),
      attempts,
      reason,
      payload,
    });
    this.metrics.incrementDlq(topic, reason);
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

  private async onSeatReleased(payload: SeatReleased) {
    await this.cache.set(`session:${payload.sessionId}:lastReleased`, payload, 60);
    await this.es.indexEvent(this.eventsIndex, {
      type: 'seat.released',
      at: new Date().toISOString(),
      ...payload,
    });
    if (this.emailTo) {
      await this.email.send(
        this.emailTo,
        'Seat released',
        `<p>Seat ${payload.seatId} released for session ${payload.sessionId} (reservation ${payload.reservationId}, reason: ${payload.reason}).</p>`,
      );
    }
  }
}
