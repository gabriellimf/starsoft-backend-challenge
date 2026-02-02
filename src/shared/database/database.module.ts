import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const ssl = config.get<boolean>('DB_SSL');
        const env = config.get<string>('NODE_ENV') || 'development';
        const synchronizeFromEnv = config.get<boolean>('DB_SYNCHRONIZE');
        const synchronize = env === 'development' ? !!synchronizeFromEnv : false;
        const logging = config.get<boolean>('DB_LOGGING');
        const options: TypeOrmModuleOptions = {
          type: 'postgres',
          url,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize,
          migrationsRun: true,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          logging,
        };
        return options;
      },
    }),
  ],
})
export class DatabaseModule {}
