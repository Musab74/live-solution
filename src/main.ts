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

  // CORS configuration for cross-domain SSO
  const allowedOrigins = [
    process.env.PHP_WEBSITE_URL || 'https://livekit1.hrdeedu.com',  // PHP website domain
    process.env.NESTJS_FRONTEND_URL || 'https://live.hrdeedu.co.kr', // NestJS frontend domain
    'http://localhost:3000',  // Development frontend
    'http://localhost:3001',  // Alternative dev frontend
    'http://localhost:3007',  // Development backend
    'http://127.0.0.1:3000',  // Alternative localhost
    'http://127.0.0.1:3001',  // Alternative localhost
    'http://127.0.0.1:3007',  // Alternative localhost
    'null',  // For file:// protocol requests
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Allow localhost and 127.0.0.1 for development
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return         callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'apollo-require-preflight',
      'x-apollo-operation-name',
      'apollo-query-plan-experimental',
    ],
    exposedHeaders: ['Authorization'],
    credentials: true,
    optionsSuccessStatus: 200, // For legacy browser support
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

  const port = process.env.PORT ?? 3007;
  await app.listen(port);

}
bootstrap();
