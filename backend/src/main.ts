import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    methods: ['GET', 'POST', 'DELETE'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = config.get<number>('app.port') ?? 3000;
  const host = config.get<string>('app.host') ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Fun-Walk API running on http://127.0.0.1:${port}`);
}

bootstrap();
