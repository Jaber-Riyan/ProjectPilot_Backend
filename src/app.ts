import express, { Express } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware';
import { v1Routes } from './routes';
import { AppError } from './errors/app-error';

export function createApp(): Express {
  const app: Express = express();

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

  // 3. Body Parsing with reasonable size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Request Correlation (Request ID)
  app.use(requestIdMiddleware);

  // 5. Request Logging (Structured logs without secrets)
  app.use(requestLoggerMiddleware);

  // 6. Mount Versioned API Routes
  app.use('/api/v1', v1Routes);

  // 7. Catch-all 404 Handler for Unknown Routes
  app.use(notFoundMiddleware);

  // 8. Centralized Error Handling Middleware
  app.use(errorHandlerMiddleware);

  return app;
}

export const app: Express = createApp();
export default app;
