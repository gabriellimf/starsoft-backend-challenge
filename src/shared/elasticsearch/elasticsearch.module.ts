import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

import { ElasticsearchService } from './elasticsearch.service';

@Global()
@Module({
  providers: [
    {
      provide: 'ELASTIC_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const node = config.get<string>('ELASTICSEARCH_NODE');
        return new Client({ node });
      },
    },
    ElasticsearchService,
  ],
  exports: ['ELASTIC_CLIENT', ElasticsearchService],
})
export class ElasticsearchModule {}
