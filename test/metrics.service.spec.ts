import { MetricsService } from '../src/metrics/metrics.service';

describe('MetricsService', () => {
  it('increments counters and returns metrics', async () => {
    const m = new MetricsService();
    m.incrementRequest('GET', '/sessions', 200);
    m.observeRequestDuration('GET', '/sessions', 200, 0.01);
    m.incrementReservationEvent('reservation.created');
    m.incrementDlq('topic', 'reason');
    const metrics = await m.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('reservation_events_total');
  });
});
