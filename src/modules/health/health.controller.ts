import { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service';
import { ApiResponseSuccess } from '../../errors/app-error';

export class HealthController {
  getHealth(_req: Request, res: Response, next: NextFunction): void {
    try {
      const data = healthService.getLiveness();
      const response: ApiResponseSuccess<typeof data> = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getReadiness(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await healthService.getReadiness();
      const response: ApiResponseSuccess<typeof data> = {
        success: true,
        data,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
