import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '@config/env';
import { errorHandler, notFoundHandler } from '@middlewares/error.middleware';
import routes from './routes';
import { logger } from '@utils/logger';


export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      // origin: (origin, callback) => {
      //   if (!origin) return callback(null, true);
      //   const allowedOrigins = config.cors.origin;
      //   console.log('Allowed Origin:', allowedOrigins)
      //   if (allowedOrigins.includes(origin)) {
      //     return callback(null, true);
      //   }

      //   return callback(new Error(`CORS blocked: ${origin}`));
      // },
      credentials: true,
    })
  );
  app.options('*', cors());
  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/v1', limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging in development
  if (config.env === 'development') {
    app.use((req, _res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  // API routes
  app.use('/api/v1', routes);

  // Root route
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Kirana Server API',
      version: '1.0.0',
      documentation: '/api/v1/health',
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
