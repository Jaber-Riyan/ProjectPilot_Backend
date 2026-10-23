import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

/**
 * Initializes request correlation context (Request ID) and records request performance.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.trim().length > 0
    ? incomingId.trim()
    : randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

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

export const requestContext = requestContextMiddleware;
