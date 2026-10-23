import { checkDatabaseConnection, disconnectDatabase } from '../db/prisma';
import { logger } from '../lib/logger';

async function main(): Promise<void> {
  logger.info('Starting database connectivity verification...');
  const result = await checkDatabaseConnection();

  if (result.connected) {
    logger.info('Database connection verified successfully', {
      latencyMs: result.latencyMs,
    });
    await disconnectDatabase();
    process.exit(0);
  } else {
    logger.error('Database connection verification failed', {
      error: result.error,
    });
    await disconnectDatabase();
    process.exit(1);
  }
}

main().catch(async (err) => {
  logger.error('Unexpected error during database verification', {
    error: err instanceof Error ? err.message : String(err),
  });
  await disconnectDatabase();
  process.exit(1);
});
