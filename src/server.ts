import { Server } from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

let server: Server | null = null;
let isShuttingDown = false;

function startServer(): void {
  server = app.listen(env.PORT, () => {
    logger.info(`ProjectPilot LMS API server started`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
    });
  });

  const handleShutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info(`Shutdown signal received (${signal}). Closing HTTP server gracefully...`);

    if (server) {
      // Stop accepting new connections
      server.close((err) => {
        if (err) {
          logger.error('Error while closing HTTP server', { error: err.message });
          process.exit(1);
        }
        logger.info('HTTP server closed successfully.');
        process.exit(0);
      });

      // Force shutdown after 10-second timeout if hanging requests don't close
      const forceExitTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
        process.exit(1);
      }, 10000);

      // Don't keep event loop active solely for timeout
      forceExitTimer.unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection detected', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
    handleShutdown('unhandledRejection');
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown', {
      error: error.message,
      stack: error.stack,
    });
    handleShutdown('uncaughtException');
  });
}

// Start listener when executed directly (and not in Vercel serverless environment)
if (process.env.VERCEL !== '1') {
  startServer();
}

export { startServer, server };

