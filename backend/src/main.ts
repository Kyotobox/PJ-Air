import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { initialize, PORT, UPLOAD_PATH } from './config';
import { ValidationPipe } from '@nestjs/common';

try {
    initialize();
} catch (error: any) {
    console.error(error.message);
    process.exit(1);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // Enable CORS for development
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const uploadsPath = resolve(UPLOAD_PATH);
  console.log('UPLOADS PATH RESOLVED TO:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });

  await app.listen(PORT);
}
bootstrap();
