import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const ssl = config.get<boolean>('DB_SSL');
        const synchronize = config.get<boolean>('DB_SYNCHRONIZE');
        const logging = config.get<boolean>('DB_LOGGING');
        return {
          type: 'postgres',
          url,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize,
          logging,
        } as any;
      },
    }),
  ],
})
export class DatabaseModule {}
