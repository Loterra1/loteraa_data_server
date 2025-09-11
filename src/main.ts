import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { config } from 'dotenv';
config()

const port = process.env.PORT || 4000

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(bodyParser.json({ limit: '15mb' }));      // for JSON bodies
  app.use(bodyParser.urlencoded({ limit: '15mb', extended: true }));


  app.enableCors({
    origin: ['https://loteraa.xyz/', 'https://www.loteraa.xyz/', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in the DTO
      forbidNonWhitelisted: true, // throws error if extra properties
      transform: true, // transforms plain JSON into class instances
    }),
  );

  // Set global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(port);
}
bootstrap();
