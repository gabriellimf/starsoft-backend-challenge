import 'reflect-metadata';
import { DataSource } from 'typeorm';

const databaseUrl =
  process.env['DATABASE_URL'] || 'postgresql://cinema:cinema123@localhost:5432/cinemadb';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: (process.env['DB_SSL'] || 'false') === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: (process.env['DB_SYNCHRONIZE'] || 'true') === 'true',
  logging: (process.env['DB_LOGGING'] || 'true') === 'true',
  entities: [__dirname + '/../../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});

export default AppDataSource;
