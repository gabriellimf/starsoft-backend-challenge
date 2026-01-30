import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, logLevel, Producer, Consumer } from 'kafkajs';

type KafkaConfig = { clientId: string; brokers: string[]; mock?: boolean };

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka?: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
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
    await this.producer.connect();
    await this.consumer.connect();
  }

  async onModuleDestroy() {
    await Promise.all([this.producer?.disconnect(), this.consumer?.disconnect()]);
  }

  async publish(topic: string, message: any) {
    if (this.mock) return;
    await this.producer?.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }

  async subscribe(topic: string, handler: (payload: any) => Promise<void> | void) {
    if (this.mock) return;
    await this.consumer?.subscribe({ topic, fromBeginning: false });
    await this.consumer?.run({
      eachMessage: async ({ message }) => {
        const payload = message.value ? JSON.parse(message.value.toString()) : null;
        await handler(payload);
      },
    });
  }
}
