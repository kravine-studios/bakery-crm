import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { httpLogStream } from './utils/logger';
import { notFound, errorHandler } from './middleware/errorHandler';
import routes from './routes';

export function createApp(): Application {
  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // HTTP request logging
  app.use(morgan('combined', { stream: httpLogStream }));

  // Global rate limiter (login route has its own stricter limiter)
  app.use(
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', routes);

  // 404 + error handler (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
