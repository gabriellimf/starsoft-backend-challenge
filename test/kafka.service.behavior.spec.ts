import { KafkaService } from '../src/shared/kafka/kafka.service';

describe('KafkaService behavior (non-mock, stubbed)', () => {
  it('publish, subscribe and startConsuming invoke underlying stubs', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: [], mock: false } as any);
    const sent: any[] = [];
    (svc as any).producer = {
      connect: async () => {},
      disconnect: async () => {},
      send: async ({ topic, messages }: any) => {
        sent.push({ topic, messages });
      },
    };
    const subscribed: string[] = [];
    let runHandler: any;
    (svc as any).consumer = {
      connect: async () => {},
      disconnect: async () => {},
      subscribe: async ({ topic }: any) => {
        subscribed.push(topic);
      },
      run: async ({ eachMessage }: any) => {
        runHandler = eachMessage;
      },
    };

    await svc.subscribe('topic-1', async () => {});
    await svc.startConsuming();

    await runHandler({
      topic: 'topic-1',
      message: { value: Buffer.from(JSON.stringify({ a: 1 })) },
    });
    await svc.publish('topic-1', { a: 2 });

    expect(subscribed).toContain('topic-1');
    expect(sent.length).toBe(1);
  });

  it('handles unknown topic and error branch in handler', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: [], mock: false } as any);
    const sent: any[] = [];
    (svc as any).producer = {
      connect: async () => {},
      disconnect: async () => {},
      send: async ({ topic, messages }: any) => {
        sent.push({ topic, messages });
      },
    };
    let runHandler: any;
    (svc as any).consumer = {
      connect: async () => {},
      disconnect: async () => {},
      subscribe: async ({ topic }: any) => {},
      run: async ({ eachMessage }: any) => {
        runHandler = eachMessage;
        runCalls++;
      },
    };
    let runCalls = 0;

    await svc.subscribe('topic-2', async (_payload) => {
      throw new Error('boom');
    });
    await svc.startConsuming();

    await runHandler({ topic: 'unknown', message: { value: Buffer.from('{}') } });

    await expect(
      runHandler({ topic: 'topic-2', message: { value: Buffer.from('{}') } }),
    ).rejects.toBeDefined();

    await svc.onModuleDestroy();

    await svc.startConsuming();
    expect(runCalls).toBe(1);
  });
});
