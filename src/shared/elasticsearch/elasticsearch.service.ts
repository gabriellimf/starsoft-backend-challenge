import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleDestroy {
  constructor(@Inject('ELASTIC_CLIENT') private readonly client: Client) {}

  async onModuleDestroy() {
    try {
      await this.client.close();
    } catch {
      // ignore
    }
  }

  async indexEvent(index: string, body: Record<string, any>) {
    try {
      await this.client.index({ index, body });
    } catch {
      // Ignore indexing failures in dev; in prod, add logging/metrics
    }
  }
}
