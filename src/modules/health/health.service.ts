import { env } from '../../config/env';

export interface HealthLivenessData {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
}

export interface HealthReadinessData {
  status: 'ok' | 'degraded';
  services: {
    http: 'up';
    database: 'not_configured_phase_1' | 'connected' | 'disconnected';
  };
  timestamp: string;
}

export class HealthService {
  getLiveness(): HealthLivenessData {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
    };
  }

  async getReadiness(): Promise<HealthReadinessData> {
    // In Phase 1, database connectivity is not yet implemented.
    // We report the HTTP service as up and database as Phase 1 placeholder.
    return {
      status: 'ok',
      services: {
        http: 'up',
        database: 'not_configured_phase_1',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
