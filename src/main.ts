import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  app.use(require('express').json({ limit: '5mb' }));
  app.use(require('express').urlencoded({ limit: '5mb', extended: true }));
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'https://proyect-seven-q9q8jgx37-ariels-projects-b6125cb2.vercel.app',
    'https://proyect-seven-cqgvzzv14-ariels-projects-b6125cb2.vercel.app'
  ]);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization', 'x-refresh-token'],
    credentials: true,
  });
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on ${port}`);
}
bootstrap();
