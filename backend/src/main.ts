import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { initialize, PORT, UPLOAD_PATH } from './config';

try {
    initialize();
} catch (error: any) {
    console.error(error.message);
    process.exit(1);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.enableCors(); // Enable CORS for development

  
  const uploadsPath = resolve(UPLOAD_PATH);
  console.log('UPLOADS PATH RESOLVED TO:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });

  await app.listen(PORT);
}
bootstrap();
