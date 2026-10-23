import { Request, Response } from 'express';
import { healthService } from './health.service';
import { ApiResponse } from '../../errors/app-error';
import { asyncHandler } from '../../lib/async-handler';

export class HealthController {
  getHealth = (_req: Request, res: Response): void => {
    const data = healthService.getLiveness();
    res.status(200).json({
      success: true,
      data,
    });
  };

  getReadiness = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const data = await healthService.getReadiness();
    const isReady = data.status === 'ok';

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json({
      success: isReady,
      data,
      ...(!isReady && data.error ? { error: { code: 'DATABASE_UNAVAILABLE', message: data.error } } : {}),
    } as unknown as ApiResponse<typeof data>);
  });
}

export const healthController = new HealthController();
