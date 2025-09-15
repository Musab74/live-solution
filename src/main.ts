import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './libs/interceptors/login.interceptor';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // GraphQL file upload (optional)
  try {
    const { graphqlUploadExpress } = require("graphql-upload");
    app.use(graphqlUploadExpress({ maxSize: 15000000, maxFiles: 10 }));
  } catch (error) {
    console.log('GraphQL upload middleware not available');
  }
  
  // Static file serving
  app.use("/uploads", express.static("./uploads"));
  
  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`GraphQL endpoint: http://localhost:${process.env.PORT ?? 3000}/graphql`);
}
bootstrap();
