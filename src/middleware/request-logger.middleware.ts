import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Wait until response completes to record duration and status code
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const requestId = req.id;

    const context = {
      requestId,
      method,
      url,
      statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${method} ${url} ${statusCode} - ${duration}ms`, context);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${url} ${statusCode} - ${duration}ms`, context);
    } else {
      logger.info(`HTTP ${method} ${url} ${statusCode} - ${duration}ms`, context);
    }
  });

  next();
}
