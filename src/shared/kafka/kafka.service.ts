import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, logLevel, Producer, Consumer } from 'kafkajs';

type KafkaConfig = { clientId: string; brokers: string[]; mock?: boolean; dlqTopic?: string };

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka?: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private readonly logger = new Logger(KafkaService.name);
  private readonly handlers = new Map<string, (payload: unknown) => Promise<void> | void>();
  private consumingStarted = false;
  private readonly mock: boolean;

  constructor(@Inject('KAFKA_CONFIG') private readonly cfg: KafkaConfig) {
    this.mock = !!cfg.mock;
  }

  async onModuleInit() {
    if (this.mock) return;
    this.kafka = new Kafka({
      clientId: this.cfg.clientId,
      brokers: this.cfg.brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: `${this.cfg.clientId}-group` });
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await Promise.all([this.producer?.disconnect(), this.consumer?.disconnect()]);
  }

  async publish(topic: string, message: unknown) {
    if (this.mock) return;
    await this.producer?.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async subscribe(topic: string, handler: (payload: unknown) => Promise<void> | void) {
    if (this.mock) return;
    this.handlers.set(topic, handler);
    await this.consumer?.subscribe({ topic, fromBeginning: false });
  }

  async startConsuming() {
    if (this.mock || this.consumingStarted) return;
    this.consumingStarted = true;
    await this.consumer?.run({
      eachMessage: async ({ topic, message }) => {
        const handler = this.handlers.get(topic);
        if (!handler) return;
        const payload = message.value ? JSON.parse(message.value.toString()) : null;
        try {
          await handler(payload);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error handling message on topic ${topic}: ${msg}`);

          try {
            await this.producer?.send({
              topic: this.cfg.dlqTopic || 'cinema-dlq',
              messages: [
                {
                  value: JSON.stringify({
                    originalTopic: topic,
                    reason: msg,
                    payload,
                    failedAt: new Date().toISOString(),
                  }),
                },
              ],
            });
          } catch (dlqErr: unknown) {
            const dmsg = dlqErr instanceof Error ? dlqErr.message : String(dlqErr);
            this.logger.error(`Failed to push to DLQ: ${dmsg}`);
          }
          throw err;
        }
      },
    });
    this.logger.log(`Kafka consuming started for topics: ${[...this.handlers.keys()].join(', ')}`);
  }

  private async connectWithRetry(attempts = 10, baseDelayMs = 1000) {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.producer?.connect();
        await this.consumer?.connect();
        this.logger.log('Kafka producer and consumer connected');
        return;
      } catch (err: unknown) {
        lastErr = err;
        const delay = Math.min(baseDelayMs * Math.pow(2, i), 5000);
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Kafka connect attempt ${i + 1}/${attempts} failed: ${msg}. Retrying in ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    this.logger.error(`Kafka connect failed after ${attempts} attempts: ${finalMsg}`);
    throw lastErr;
  }
}
