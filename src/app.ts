import express, { Express } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { env } from './config/env';
import { appConfig } from './config/app-config';
import { requestContextMiddleware } from './middleware/request-context';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';
import { v1ApiRouter } from './api/v1';
import { AppError } from './errors/app-error';

export function createApp(): Express {
  const app: Express = express();

  // Configure reverse proxy trust for accurate client IP resolution (e.g. Vercel)
  app.set('trust proxy', 1);

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS Configuration
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check allowed origins list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // In non-production, permit localhost origins for convenience
      if (env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(
        new AppError(403, 'CORS_FORBIDDEN', `CORS origin '${origin}' is not permitted`)
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // 24 hours preflight cache
  };

  app.use(cors(corsOptions));

  // 3. Body Parsing with configured size limits
  app.use(express.json({ limit: appConfig.security.jsonLimit }));
  app.use(express.urlencoded({ extended: true, limit: appConfig.security.bodyLimit }));

  // 4. Request Correlation & Structured Logging
  app.use(requestContextMiddleware);

  // 5. Mount Versioned API Routes (/api/v1)
  app.use(appConfig.server.apiPrefix, v1ApiRouter);

  // 6. Catch-all 404 Handler for Unknown Routes
  app.use(notFoundHandler);

  // 7. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app: Express = createApp();
export default app;
