import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';
import { ApiResponse } from '../../errors/app-error';

export class HealthController {
  getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const data = healthService.getLiveness();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await healthService.getReadiness();
      const isReady = data.status === 'ok';

      const statusCode = isReady ? 200 : 503;
      res.status(statusCode).json({
        success: isReady,
        data,
        ...(!isReady && data.error ? { error: { code: 'DATABASE_UNAVAILABLE', message: data.error } } : {}),
      } as unknown as ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
