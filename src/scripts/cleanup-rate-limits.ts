import { rateLimitService } from '../modules/rate-limit';
import { disconnectDatabase } from '../db/prisma';
import { logger } from '../lib/logger';
import { appConfig } from '../config/app-config';

async function main(): Promise<void> {
  logger.info('Starting expired rate-limit cleanup...');
  const batchSize = appConfig.rateLimit.cleanupBatchSize;

  try {
    const deletedCount = await rateLimitService.cleanupExpired(batchSize);
    logger.info(`Expired rate-limit cleanup completed successfully`, {
      deletedCount,
      batchSize,
    });
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Failed to clean up expired rate limits', {
      error: err instanceof Error ? err.message : String(err),
    });
    await disconnectDatabase();
    process.exit(1);
  }
}

main().catch(async (err) => {
  logger.error('Unexpected error in cleanup script', {
    error: err instanceof Error ? err.message : String(err),
  });
  await disconnectDatabase();
  process.exit(1);
});
