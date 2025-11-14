import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  createStaticRoutingMiddleware,
  findPublicDir,
} from './middleware/static-routing.middleware';
import { RequestContextInterceptor } from './common/request-context.interceptor';

// Suppress unhandled promise rejections from Redis connection failures
process.on('unhandledRejection', (reason: unknown) => {
  // Ignore Redis connection errors when Redis is unavailable
  if (
    reason &&
    typeof reason === 'object' &&
    (('code' in reason && reason.code === 'ECONNREFUSED') ||
      ('syscall' in reason && reason.syscall === 'connect') ||
      ('message' in reason &&
        typeof reason.message === 'string' &&
        reason.message.includes('ECONNREFUSED')))
  ) {
    return; // Silently ignore - fallback queue is being used
  }
  // Log other unhandled rejections
  console.error('Unhandled Rejection:', reason);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const appConfig = configService.get('app');
  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://0.0.0.0:3000',
          'http://0.0.0.0:3001',
          'http://127.0.0.1:3000',
        ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Enable ValidationPipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Get port and host from config
  const port = appConfig.port;
  const host = appConfig.host || '0.0.0.0';

  // Serve static files from public directory (JS, CSS, images, etc.)
  const publicDir = findPublicDir();
  app.use(express.static(publicDir));
  app.useGlobalInterceptors(new RequestContextInterceptor());
  // Serve Next.js static HTML files and handle dynamic routing
  app.use(createStaticRoutingMiddleware(publicDir));

  // Configure Swagger documentation
  const swaggerConfig = appConfig.swagger;
  const swaggerOptions = new DocumentBuilder()
    .setTitle(swaggerConfig.title as string)
    .setDescription(swaggerConfig.description as string)
    .setVersion(swaggerConfig.version as string)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer(`http://${host}:${port}`, 'Development server')
    .addServer('https://api.taskosaur.com', 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);

  // Setup Swagger UI at /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port as string | number, host as string);
  logger.log(`Application is running on: http://${host}:${port}`);
  logger.log(
    `Swagger documentation available at: http://${host}:${port}/${swaggerConfig.path as string}`,
  );
}
void bootstrap();
