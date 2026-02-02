export default () => ({
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  PORT: parseInt(process.env['PORT'] || '3000', 10),
  DATABASE_URL:
    process.env['DATABASE_URL'] || 'postgresql://cinema:cinema123@localhost:5432/cinemadb',
  DB_LOGGING: (process.env['DB_LOGGING'] || 'true') === 'true',
  DB_SSL: (process.env['DB_SSL'] || 'false') === 'true',
  DB_SYNCHRONIZE: (process.env['DB_SYNCHRONIZE'] || 'true') === 'true',
  CORS_ORIGINS: process.env['CORS_ORIGINS'] || 'http://localhost:3000',
  KAFKA: {
    BROKERS: (process.env['KAFKA_BROKERS'] || 'localhost:3002')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    CLIENT_ID: process.env['KAFKA_CLIENT_ID'] || 'cinema-api',
    MOCK: (process.env['KAFKA_MOCK_MODE'] || 'false') === 'true',
  },
  REDIS_URL: process.env['REDIS_URL'] || 'redis://localhost:6379',
  RATE_LIMIT_ENABLED: (process.env['RATE_LIMIT_ENABLED'] || 'true') === 'true',
  RATE_LIMIT_TTL_SECONDS: parseInt(process.env['RATE_LIMIT_TTL_SECONDS'] || '60', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
});
