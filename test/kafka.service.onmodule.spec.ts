import { KafkaService } from '../src/shared/kafka/kafka.service';

jest.mock('kafkajs', () => {
  const producerStub = {
    connect: async () => {},
    disconnect: async () => {},
    send: async () => {},
  };
  const consumerStub = {
    connect: async () => {},
    disconnect: async () => {},
    subscribe: async () => {},
    run: async () => {},
  };
  class KafkaMock {
    producer() {
      return producerStub as any;
    }
    consumer() {
      return consumerStub as any;
    }
  }
  return { Kafka: KafkaMock, logLevel: { NOTHING: 0 } };
});

describe('KafkaService onModuleInit (mocked Kafka)', () => {
  it('creates Kafka, connects producer/consumer', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: ['b1'], mock: false } as any);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });
});
