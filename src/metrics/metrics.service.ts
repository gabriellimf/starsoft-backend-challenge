import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  private readonly requestCounter: Counter<string>;
  private readonly requestDuration: Histogram<string>;
  private readonly reservationEvents: Counter<string>;
  private readonly dlqMessages: Counter<string>;

  constructor() {
    this.registry = register;
    collectDefaultMetrics({ register: this.registry });

    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.reservationEvents = new Counter({
      name: 'reservation_events_total',
      help: 'Count of reservation-related events',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.dlqMessages = new Counter({
      name: 'dlq_messages_total',
      help: 'Count of messages forwarded to DLQ',
      labelNames: ['original_topic', 'reason'],
      registers: [this.registry],
    });
  }

  incrementRequest(method: string, path: string, statusCode: number) {
    this.requestCounter.labels(method, path, String(statusCode)).inc();
  }

  observeRequestDuration(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number,
  ) {
    this.requestDuration.labels(method, path, String(statusCode)).observe(durationSeconds);
  }

  incrementReservationEvent(
    eventType: 'reservation.created' | 'reservation.expired' | 'payment.confirmed',
  ) {
    this.reservationEvents.labels(eventType).inc();
  }

  incrementDlq(originalTopic: string, reason: string) {
    this.dlqMessages.labels(originalTopic, reason).inc();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
