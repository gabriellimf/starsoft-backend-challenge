import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(
    @Inject('ELASTIC_CLIENT') private readonly client: Client,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy() {
    try {
      await this.client.close();
    } catch (err: any) {
      this.logger.debug(`Error closing Elasticsearch client: ${err?.message || err}`);
    }
  }

  async indexEvent(index: string, body: Record<string, any>) {
    try {
      await this.client.index({ index, body });
    } catch (err: any) {
      const env = this.config.get<string>('NODE_ENV') || 'development';
      const msg = `Failed to index event in '${index}': ${err?.message || err}`;
      if (env === 'production') {
        this.logger.error(msg);
      } else {
        this.logger.warn(msg);
      }
    }
  }
}
