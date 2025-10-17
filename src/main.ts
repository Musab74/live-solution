import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/interceptors/login.interceptor';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Increase body parser limits for file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // GraphQL file upload disabled due to ES module compatibility issues
  // try {
  //   const { graphqlUploadExpress } = require('graphql-upload');
  //   app.use(graphqlUploadExpress({ maxSize: 50000000, maxFiles: 10 }));
  // } catch (error) {
  // }

  // Static file serving
  app.use('/uploads', express.static('./uploads'));

  // WebSocket adapter

  app.useWebSocketAdapter(new IoAdapter(app));

  // Health check endpoint using Express instance
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    });
  });

  // Add Socket.IO endpoint health check
  expressApp.get('/socket.io/health', (req, res) => {
    res.json({
      status: 'Socket.IO server active',
      timestamp: new Date().toISOString(),
      namespaces: ['/signaling'],
    });
  });

  await app.listen(process.env.PORT ?? 3007);

}
bootstrap();
