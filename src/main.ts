import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, Request, Response, Application } from 'express';
import pinoHttp from 'pino-http';

import { AppModule } from './app.module';
import { CorrelationIdMiddleware } from './shared/logging/correlation.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  app.enableCors({
    origin: (configService.get<string>('CORS_ORIGINS') || '').split(',').filter(Boolean),
    credentials: true,
  });
  app.use(json({ limit: '1mb' }));
  const correlation = new CorrelationIdMiddleware();
  app.use(correlation.use.bind(correlation));
  app.use(
    pinoHttp({
      genReqId: (req: Request) => (req as Request & { id?: string }).id,
      customLogLevel: function (req: Request, res: Response, err?: Error) {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customProps: function (req: Request) {
        return {
          route: req.url,
          method: req.method,
        };
      },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cinema API')
    .setDescription('API para venda de ingressos com controle de concorrência')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Cinema API Docs',
  });

  // Convenience: redirect root to Swagger UI
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.get('/', (_req: Request, res: Response) => res.redirect('/api-docs'));

  await app.listen(port);
  Logger.log(`🚀 Cinema API is running on http://localhost:${port}`);
}

void bootstrap();
