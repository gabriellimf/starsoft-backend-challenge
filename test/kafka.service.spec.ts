import { KafkaService } from '../src/shared/kafka/kafka.service';

describe('KafkaService (mock mode)', () => {
  it('does nothing when mock is enabled', async () => {
    const svc = new KafkaService({ clientId: 'test', brokers: [], mock: true } as any);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    await expect(svc.publish('topic', { a: 1 })).resolves.toBeUndefined();
    await expect(svc.subscribe('topic', async () => {})).resolves.toBeUndefined();
    await expect(svc.startConsuming()).resolves.toBeUndefined();
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });
});
