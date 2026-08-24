import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment o'zgaruvchisi production muhitida majburiy (standart qiymat bilan ishga tushirish xavfsiz emas).",
    );
  }

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Production'da (folioone.uz kabi) CORS_ORIGIN orqali aniq ro'yxatga
  // cheklanadi — aks holda (dev/Codespace) istalgan origin qabul qilinadi.
  const allowedOrigins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da yo'q maydonlarni tashlab yuboradi
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API ${port}-portda ishga tushdi (http://localhost:${port}/api)`);
}
bootstrap();
