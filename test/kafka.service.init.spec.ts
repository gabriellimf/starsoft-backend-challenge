import { KafkaService } from '../src/shared/kafka/kafka.service';

describe('KafkaService connectWithRetry (stubbed producer/consumer)', () => {
  it('retries and eventually connects producer and consumer', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: ['b1'], mock: false } as any);
    const producerStub = {
      connects: 0,
      connect: async function () {
        this.connects++;
        if (this.connects < 3) throw new Error('connect-fail');
      },
      disconnect: async () => {},
      send: async () => {},
    };
    const consumerStub = {
      connects: 0,
      connect: async function () {
        this.connects++;
        if (this.connects < 2) throw new Error('connect-fail');
      },
      disconnect: async () => {},
      subscribe: async () => {},
      run: async () => {},
    };
    (svc as any).producer = producerStub;
    (svc as any).consumer = consumerStub;
    await expect((svc as any).connectWithRetry(4, 1)).resolves.toBeUndefined();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('throws when connection never succeeds', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: ['b1'], mock: false } as any);
    const producerStub = {
      connect: async () => {
        throw new Error('always-fail');
      },
      disconnect: async () => {},
      send: async () => {},
    };
    const consumerStub = {
      connect: async () => {
        throw new Error('always-fail');
      },
      disconnect: async () => {},
      subscribe: async () => {},
      run: async () => {},
    };
    (svc as any).producer = producerStub;
    (svc as any).consumer = consumerStub;
    await expect((svc as any).connectWithRetry(2, 1)).rejects.toBeDefined();
  });
});
