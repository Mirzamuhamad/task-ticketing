import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppErrorFilter } from './common/app-error.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const origin = (config.get<string>('CLIENT_ORIGIN') ?? 'http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin,
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AppErrorFilter());

  const port = config.get<number>('SERVER_PORT') ?? 4000;
  await app.listen(port);
}

bootstrap();
